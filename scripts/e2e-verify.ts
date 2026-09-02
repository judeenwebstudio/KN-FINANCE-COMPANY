import "dotenv/config";
import { LoanStatus, TransactionType, RepaymentScheduleStatus, PenaltyType, PenaltyFrequency, PenaltyBasis, PenaltyRuleStatus } from "../src/generated/prisma/client";
import { calculateLoanPreview, generateRepaymentSchedule } from "../src/lib/loans/calculator";
import { generateLoanNumber } from "../src/lib/loans/number-generator";
import { creditAccount, debitAccount } from "../src/lib/accounts/service";
import { calculateRepaymentAllocation } from "../src/lib/loans/repayment";
import { refreshLoanOverdueStateInTx } from "../src/lib/loans/overdue";
import { prisma } from "../src/lib/prisma";

async function runE2EVerification() {
  console.log("==================================================");
  console.log("Starting Phase 2B-2 Full Live E2E Workflow Verification...");
  console.log("==================================================");

  // 1. Fetch seeded member, branch, and superAdmin
  const memberUser = await prisma.user.findUnique({
    where: { email: "member@creditflow.demo" },
    include: { memberProfile: { include: { accounts: true } } },
  });
  if (!memberUser || !memberUser.memberProfile) {
    throw new Error("Seeded member profile not found");
  }

  const superAdmin = await prisma.user.findUnique({
    where: { email: "superadmin@creditflow.demo" },
  });
  if (!superAdmin) throw new Error("SuperAdmin user not found");

  // 2. Fetch or create a specific penalty rule
  const penaltyRule = await prisma.loanPenaltyRule.upsert({
    where: { code: "E2E-DAILY-PENALTY" },
    update: {},
    create: {
      name: "E2E Daily Overdue Penalty (1%/day)",
      code: "E2E-DAILY-PENALTY",
      description: "1% daily penalty on outstanding installment after 0 days grace period, capped at $100.",
      penaltyType: PenaltyType.PERCENTAGE,
      penaltyFrequency: PenaltyFrequency.DAILY,
      penaltyBasis: PenaltyBasis.OUTSTANDING_INSTALLMENT,
      gracePeriodDays: 0,
      penaltyValue: 1.0,
      maximumPenaltyAmount: 100,
      status: PenaltyRuleStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  // Create product with linked penalty rule
  const product = await prisma.loanProduct.upsert({
    where: { code: "E2E-PENALTY-PROD" },
    update: { penaltyRuleId: penaltyRule.id },
    create: {
      name: "E2E Penalty Test Product",
      code: "E2E-PENALTY-PROD",
      description: "Product for live penalty & collection verification.",
      currency: "USD",
      minimumAmount: 500,
      maximumAmount: 10000,
      minimumTermMonths: 3,
      maximumTermMonths: 12,
      interestRate: 12.0,
      interestType: "DECLINING_BALANCE",
      repaymentFrequency: "MONTHLY",
      processingFeeType: "FIXED",
      processingFeeValue: 20,
      requiresApproval: true,
      status: "ACTIVE",
      penaltyRuleId: penaltyRule.id,
      createdById: superAdmin.id,
    },
  });

  console.log(`✓ Member found: ${memberUser.name} (${memberUser.memberProfile.memberNumber})`);
  console.log(`✓ Penalty Rule & Product linked: ${penaltyRule.code} -> ${product.code}`);

  // 3. Apply for Loan & snapshot penalty configuration
  const principalAmount = 1000;
  const termMonths = 6;
  const preview = calculateLoanPreview({
    principalAmount,
    annualInterestRate: product.interestRate,
    termMonths,
    interestType: product.interestType,
    repaymentFrequency: product.repaymentFrequency,
    feeType: product.processingFeeType,
    feeValue: product.processingFeeValue,
  });

  const loanNumber = generateLoanNumber();
  const loan = await prisma.loan.create({
    data: {
      loanNumber,
      productId: product.id,
      memberId: memberUser.memberProfile.id,
      branchId: memberUser.memberProfile.branchId,
      currency: product.currency,
      principalAmount: preview.principalAmount,
      interestRate: product.interestRate,
      interestType: product.interestType,
      termMonths,
      repaymentFrequency: product.repaymentFrequency,
      processingFee: preview.processingFee,
      totalInterest: preview.totalInterest,
      totalPayable: preview.totalPayable,
      status: LoanStatus.PENDING,
      applicationDate: new Date(),
      // Snapshot penalty rule terms onto Loan
      penaltyRuleId: penaltyRule.id,
      penaltyType: penaltyRule.penaltyType,
      penaltyFrequency: penaltyRule.penaltyFrequency,
      penaltyBasis: penaltyRule.penaltyBasis,
      gracePeriodDays: penaltyRule.gracePeriodDays,
      penaltyValue: penaltyRule.penaltyValue,
      maximumPenaltyAmount: penaltyRule.maximumPenaltyAmount,
      createdById: memberUser.id,
    },
  });

  console.log(`✓ Loan Application Created & Penalty Terms Snapshotted: ${loan.loanNumber}`);

  // 4. Approve & Disburse
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: LoanStatus.APPROVED,
      approvedAmount: loan.principalAmount,
      approvalDate: new Date(),
      approvedById: superAdmin.id,
    },
  });

  const savingsAccount = memberUser.memberProfile.accounts.find((a) => a.accountType === "SAVINGS");
  if (!savingsAccount) throw new Error("Savings account not found");

  const activeLoan = await prisma.$transaction(async (tx) => {
    const targetLoan = await tx.loan.findUnique({ where: { id: loan.id } });
    const disbursementDate = new Date();
    const calc = generateRepaymentSchedule({
      principalAmount: targetLoan!.approvedAmount!,
      annualInterestRate: targetLoan!.interestRate,
      termMonths: targetLoan!.termMonths,
      interestType: targetLoan!.interestType,
      repaymentFrequency: targetLoan!.repaymentFrequency,
      processingFee: targetLoan!.processingFee,
      startDate: disbursementDate,
    });

    await creditAccount(tx, {
      accountId: savingsAccount.id,
      memberId: targetLoan!.memberId,
      branchId: targetLoan!.branchId,
      amount: targetLoan!.approvedAmount!,
      currency: targetLoan!.currency,
      type: TransactionType.LOAN_DISBURSEMENT,
      description: `Disbursement for Loan ${targetLoan!.loanNumber}`,
    });

    await tx.loanRepaymentSchedule.createMany({
      data: calc.schedule.map((row) => ({
        loanId: targetLoan!.id,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        principalDue: row.principalDue,
        interestDue: row.interestDue,
        feeDue: row.feeDue,
        totalDue: row.totalDue,
        status: "PENDING",
      })),
    });

    return tx.loan.update({
      where: { id: targetLoan!.id },
      data: {
        disbursementDate,
        maturityDate: calc.maturityDate,
        disbursedById: superAdmin.id,
        status: LoanStatus.ACTIVE,
      },
      include: { repaymentSchedules: { orderBy: { installmentNumber: "asc" } } },
    });
  });

  console.log(`✓ Loan Disbursed Atomically: ${activeLoan.loanNumber}`);

  // 5. Simulate Overdue Effective Date (5 Days after first installment due date)
  const firstInstDueDate = activeLoan.repaymentSchedules[0].dueDate;
  const simulatedEffectiveDate = new Date(firstInstDueDate.getTime() + 5 * 24 * 60 * 60 * 1000);

  console.log(`✓ Simulating Overdue Effective Date: ${simulatedEffectiveDate.toISOString().slice(0, 10)}`);

  await prisma.$transaction(async (tx) => {
    await refreshLoanOverdueStateInTx(tx, activeLoan.id, simulatedEffectiveDate);
  });

  // Verify LoanPenaltyAssessment Ledger
  const assessments = await prisma.loanPenaltyAssessment.findMany({
    where: { loanId: activeLoan.id, status: "ACTIVE" },
  });

  const updatedSchedule1 = await prisma.loanRepaymentSchedule.findFirst({
    where: { loanId: activeLoan.id, installmentNumber: 1 },
  });

  console.log(`✓ Overdue Refresh Executed. Penalty Assessments Created: ${assessments.length} rows.`);
  console.log(`✓ Schedule 1 Penalty Due: $${updatedSchedule1?.penaltyDue.toString()}`);

  if (assessments.length !== 5) {
    throw new Error(`Expected 5 daily penalty assessment ledger rows, found ${assessments.length}`);
  }

  // 6. Post Repayment (Priority: Penalty -> Fee -> Interest -> Principal)
  const repaymentAmount = 100;
  const postedRepayment = await prisma.$transaction(async (tx) => {
    const l = await tx.loan.findUnique({
      where: { id: activeLoan.id },
      include: { repaymentSchedules: { orderBy: { installmentNumber: "asc" } } },
    });

    const debitRes = await debitAccount(tx, {
      accountId: savingsAccount.id,
      memberId: l!.memberId,
      branchId: l!.branchId,
      amount: repaymentAmount,
      currency: l!.currency,
      type: TransactionType.LOAN_REPAYMENT,
      description: `Repayment for ${l!.loanNumber}`,
    });

    const alloc = calculateRepaymentAllocation(l!.repaymentSchedules, repaymentAmount);

    const repayment = await tx.loanRepayment.create({
      data: {
        repaymentNumber: `REPAY-E2E-PENALTY-${Date.now()}`,
        loanId: l!.id,
        accountId: savingsAccount.id,
        memberId: l!.memberId,
        amount: alloc.totalAmount,
        principalAmount: alloc.principalAmount,
        interestAmount: alloc.interestAmount,
        feeAmount: alloc.feeAmount,
        penaltyAmount: alloc.penaltyAmount,
        paymentDate: new Date(),
        status: "POSTED",
        transactionId: debitRes.transaction.id,
        createdById: superAdmin.id,
      },
    });

    for (const item of alloc.allocations) {
      await tx.loanRepaymentAllocation.create({
        data: {
          repaymentId: repayment.id,
          scheduleId: item.scheduleId,
          penaltyAmount: item.penaltyAllocated,
          feeAmount: item.feeAllocated,
          interestAmount: item.interestAllocated,
          principalAmount: item.principalAllocated,
          totalAmount: item.totalAllocated,
        },
      });

      await tx.loanRepaymentSchedule.update({
        where: { id: item.scheduleId },
        data: {
          penaltyPaid: item.newPenaltyPaid,
          feePaid: item.newFeePaid,
          interestPaid: item.newInterestPaid,
          principalPaid: item.newPrincipalPaid,
          totalPaid: item.newTotalPaid,
          status: item.newStatus as RepaymentScheduleStatus,
          paidAt: item.paidAt,
        },
      });
    }

    return repayment;
  });

  const repAllocations = await prisma.loanRepaymentAllocation.findMany({
    where: { repaymentId: postedRepayment.id },
  });

  console.log(`✓ Repayment Posted: ${postedRepayment.repaymentNumber} ($${repaymentAmount}). Allocation Ledger: ${repAllocations.length} rows.`);
  console.log(`✓ Penalty Paid: $${postedRepayment.penaltyAmount.toString()} | Fee Paid: $${postedRepayment.feeAmount.toString()} | Interest Paid: $${postedRepayment.interestAmount.toString()}`);

  if (Number(postedRepayment.penaltyAmount) <= 0) {
    throw new Error("Penalty should have been paid first under priority order");
  }

  // 7. Test Idempotency: Re-run Overdue Refresh on Same Effective Date
  await prisma.$transaction(async (tx) => {
    await refreshLoanOverdueStateInTx(tx, activeLoan.id, simulatedEffectiveDate);
  });

  const assessmentsAfterIdempotent = await prisma.loanPenaltyAssessment.findMany({
    where: { loanId: activeLoan.id, status: "ACTIVE" },
  });

  console.log(`✓ Idempotency Check: Assessments count before = ${assessments.length}, after repeated refresh = ${assessmentsAfterIdempotent.length}`);
  if (assessmentsAfterIdempotent.length !== assessments.length) {
    throw new Error("Repeated refresh created duplicate penalty assessments!");
  }

  // 8. Reverse Repayment using LoanRepaymentAllocation Ledger
  await prisma.$transaction(async (tx) => {
    const r = await tx.loanRepayment.findUnique({
      where: { id: postedRepayment.id },
      include: {
        loan: true,
        account: true,
        member: true,
        allocations: { include: { schedule: true } },
      },
    });

    await creditAccount(tx, {
      accountId: r!.accountId,
      memberId: r!.memberId,
      branchId: r!.member.branchId,
      amount: r!.amount,
      currency: r!.account.currency,
      type: TransactionType.ADJUSTMENT,
      description: `Reversal of ${r!.repaymentNumber}`,
    });

    for (const alloc of r!.allocations) {
      const s = alloc.schedule;
      await tx.loanRepaymentSchedule.update({
        where: { id: s.id },
        data: {
          penaltyPaid: { decrement: alloc.penaltyAmount },
          feePaid: { decrement: alloc.feeAmount },
          interestPaid: { decrement: alloc.interestAmount },
          principalPaid: { decrement: alloc.principalAmount },
          totalPaid: { decrement: alloc.totalAmount },
          status: "PENDING",
        },
      });
    }

    await tx.loanRepayment.update({
      where: { id: r!.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedById: superAdmin.id,
        reversalReason: "E2E Penalty Reversal Verification",
      },
    });
  });

  const reversedSchedule = await prisma.loanRepaymentSchedule.findFirst({
    where: { loanId: activeLoan.id, installmentNumber: 1 },
  });

  console.log(`✓ Repayment Reversal Executed. Restored Penalty Paid: $${reversedSchedule?.penaltyPaid.toString()} (Must be 0)`);
  if (Number(reversedSchedule?.penaltyPaid) !== 0) {
    throw new Error("Penalty paid was not restored correctly to 0");
  }

  console.log("==================================================");
  console.log("Phase 2B-2 E2E Verification Completed Successfully!");
  console.log("==================================================");
}

runE2EVerification()
  .catch((e) => {
    console.error("Phase 2B-2 E2E Verification Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
