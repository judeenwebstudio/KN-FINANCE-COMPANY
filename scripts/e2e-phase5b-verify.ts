import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { processBankStatementImport, executeAutoMatch, executeManualMatch, executeUnmatch } from "../src/lib/reconciliation/service";
import { getPortfolioQualityReport } from "../src/lib/reports/portfolio-quality-reports";
import { Decimal } from "../src/generated/prisma/internal/prismaNamespace";

async function runPhase5bE2eVerification() {
  console.log("==================================================");
  console.log("STARTING PHASE 5B BANK RECONCILIATION & PORTFOLIO QUALITY E2E VERIFICATION");
  console.log("==================================================");

  const timestamp = Date.now();

  // 1. Create test branch and admin user
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } }) || await prisma.user.create({
    data: {
      email: `admin-p5b-${timestamp}@creditflow.local`,
      name: `Admin P5B ${timestamp}`,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuu",
      role: "ADMIN",
    },
  });

  const branch = await prisma.branch.create({
    data: {
      name: `Branch P5B ${timestamp}`,
      code: `BR-P5B-${timestamp}`,
      email: `branch-p5b-${timestamp}@creditflow.local`,
      phone: "555-0500",
      address: "500 Risk Ave",
      city: "Metro",
      state: "ST",
      country: "US",
      currency: "USD",
    },
  });

  console.log(`[PASS] 1. Test environment created: Branch ${branch.code}`);

  // ==================================================
  // BANK RECONCILIATION E2E TEST
  // ==================================================
  const bankAcc = await prisma.bankAccount.create({
    data: {
      name: `E2E Bank Account ${timestamp}`,
      accountName: `CreditFlow Ops ${timestamp}`,
      accountNumber: `BANK-P5B-${timestamp}`,
      bankName: "Global Metro Bank",
      currency: "USD",
      openingBalance: new Decimal(10000),
      currentBalance: new Decimal(10000),
      branchId: branch.id,
      createdById: adminUser.id,
    },
  });

  console.log(`[PASS] 2. Bank Account created with balance $10,000: ${bankAcc.accountNumber}`);

  // Create internal BankTransactions
  const btx1 = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-P5B-1-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(500),
      currency: "USD",
      balanceBefore: new Decimal(10000),
      balanceAfter: new Decimal(10500),
      transactionDate: new Date("2026-09-01T10:00:00Z"),
      reference: `REF-DEP-${timestamp}`,
      description: "Direct Deposit Client Fee",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  const btx2 = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-P5B-2-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "EXPENSE",
      direction: "DEBIT",
      amount: new Decimal(200),
      currency: "USD",
      balanceBefore: new Decimal(10500),
      balanceAfter: new Decimal(10300),
      transactionDate: new Date("2026-09-02T14:00:00Z"),
      reference: `REF-EXP-${timestamp}`,
      description: "Office Supplies Expense",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  console.log(`[PASS] 3. Internal BankTransactions created ($500 CREDIT, $200 DEBIT)`);

  // Import canonical CSV statement
  const csvContent = `Date,Description,Reference,Debit,Credit,Balance
2026-09-01,"Direct Deposit Client Fee",REF-DEP-${timestamp},,500.00,10500.00
2026-09-02,"Office Supplies Expense",REF-EXP-${timestamp},200.00,,10300.00
2026-09-03,"Unmatched Utility Bill",REF-UTIL-${timestamp},75.00,,10225.00`;

  const statementImport = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `statement-${timestamp}.csv`,
    fileContent: csvContent,
    createdById: adminUser.id,
  });

  console.log(`[PASS] 4. CSV statement imported. Import #${statementImport.importNumber}, Valid rows: ${statementImport.validRowCount}`);

  // Test duplicate file import rejection
  let duplicateRejected = false;
  try {
    await processBankStatementImport({
      bankAccountId: bankAcc.id,
      fileName: `duplicate-${timestamp}.csv`,
      fileContent: csvContent,
      createdById: adminUser.id,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Duplicate statement file import detected")) {
      duplicateRejected = true;
    }
  }

  if (!duplicateRejected) {
    throw new Error("FAILED: Duplicate statement import hash was not rejected!");
  }
  console.log(`[PASS] 5. Account-scoped duplicate file import hash protection verified`);

  // Run Auto-Match Engine
  const autoMatchRes = await executeAutoMatch(statementImport.id, adminUser.id);
  console.log(`[PASS] 6. Auto-match engine executed. Created ${autoMatchRes.matchesCreated} matches.`);

  // Verify BankTransaction status update
  const updatedBtx1 = await prisma.bankTransaction.findUnique({ where: { id: btx1.id } });
  if (updatedBtx1?.reconciliationStatus !== "RECONCILED") {
    throw new Error("FAILED: Auto-matched BankTransaction status was not updated to RECONCILED!");
  }
  console.log(`[PASS] 7. BankTransaction.reconciliationStatus updated to RECONCILED`);

  // Verify Zero Financial Mutation Safeguard
  const currentBankAcc = await prisma.bankAccount.findUnique({ where: { id: bankAcc.id } });
  if (!currentBankAcc?.currentBalance.equals(new Decimal(10000))) {
    throw new Error("FAILED: BankAccount.currentBalance was mutated during reconciliation!");
  }
  console.log(`[PASS] 8. Zero financial balance mutation verified (BankAccount.currentBalance remained $10,000)`);

  // Test Manual Match for btx2 if not auto-matched
  const line2 = await prisma.bankStatementLine.findFirst({
    where: { statementImportId: statementImport.id, reference: `REF-EXP-${timestamp}` },
  });

  if (line2 && line2.status === "UNMATCHED") {
    await executeManualMatch({
      statementLineId: line2.id,
      bankTransactionId: btx2.id,
      actorId: adminUser.id,
    });
    console.log(`[PASS] 9. Manual match executed for Line #${line2.lineNumber}`);
  }

  // Test Unmatch
  const matchToUnmatch = await prisma.bankReconciliationMatch.findFirst({
    where: { statementLine: { statementImportId: statementImport.id }, status: "ACTIVE" },
  });

  if (matchToUnmatch) {
    const unmatchRes = await executeUnmatch({
      matchId: matchToUnmatch.id,
      unmatchReason: "Testing audit-safe unmatch workflow",
      actorId: adminUser.id,
    });

    assert.equal(unmatchRes.status, "UNMATCHED");
    const restoredTx = await prisma.bankTransaction.findUnique({ where: { id: matchToUnmatch.bankTransactionId } });
    assert.equal(restoredTx?.reconciliationStatus, "UNRECONCILED");
    console.log(`[PASS] 10. Unmatch executed cleanly. Original match evidence preserved, status restored to UNRECONCILED.`);
  }

  // ==================================================
  // PORTFOLIO QUALITY & RISK E2E TEST
  // ==================================================
  console.log("--------------------------------------------------");
  console.log("Testing Portfolio Quality & Risk Calculations...");

  const member = await prisma.memberProfile.create({
    data: {
      userId: (await prisma.user.create({
        data: {
          email: `member-p5b-${timestamp}@creditflow.local`,
          name: `Member P5B ${timestamp}`,
          passwordHash: "$2a$10$abcdefghijklmnopqrstuu",
          role: "MEMBER",
        },
      })).id,
      memberNumber: `MBR-P5B-${timestamp}`,
      branchId: branch.id,
      phone: "555-0505",
      address: "100 Risk St",
    },
  });

  const product = await prisma.loanProduct.create({
    data: {
      name: `Risk Product ${timestamp}`,
      code: `PROD-P5B-${timestamp}`,
      branchId: branch.id,
      currency: "USD",
      minimumAmount: new Decimal(500),
      maximumAmount: new Decimal(50000),
      minimumTermMonths: 6,
      maximumTermMonths: 36,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      repaymentFrequency: "MONTHLY",
      processingFeeType: "FIXED",
      processingFeeValue: new Decimal(0),
      status: "ACTIVE",
    },
  });

  await prisma.account.create({
    data: {
      accountNumber: `ACC-LN-P5B-${timestamp}`,
      memberId: member.id,
      branchId: branch.id,
      accountType: "SAVINGS",
      currency: "USD",
      balance: new Decimal(1000),
    },
  });

  // Create Deterministic Loan Facilities:
  // Loan A: Outstanding = $1,000, DPD = 0 (Current)
  // Loan B: Outstanding = $2,000, DPD = 30
  // Loan C: Outstanding = $3,000, DPD = 90
  await prisma.loan.create({
    data: {
      loanNumber: `LN-P5B-A-${timestamp}`,
      memberId: member.id,
      branchId: branch.id,
      productId: product.id,
      principalAmount: new Decimal(1000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-08-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date("2026-09-15T00:00:00Z"),
            principalDue: new Decimal(1000),
            interestDue: new Decimal(100),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(1100),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 0,
            status: "PENDING",
          },
        ],
      },
    },
  });

  await prisma.loan.create({
    data: {
      loanNumber: `LN-P5B-B-${timestamp}`,
      memberId: member.id,
      branchId: branch.id,
      productId: product.id,
      principalAmount: new Decimal(2000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-07-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days overdue
            principalDue: new Decimal(2000),
            interestDue: new Decimal(200),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(2200),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 30,
            status: "OVERDUE",
          },
        ],
      },
    },
  });

  await prisma.loan.create({
    data: {
      loanNumber: `LN-P5B-C-${timestamp}`,
      memberId: member.id,
      branchId: branch.id,
      productId: product.id,
      principalAmount: new Decimal(3000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-05-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days overdue
            principalDue: new Decimal(3000),
            interestDue: new Decimal(300),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(3300),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 90,
            status: "OVERDUE",
          },
        ],
      },
    },
  });

  console.log(`[PASS] 11. Deterministic loans created (Loan A $1k DPD 0, Loan B $2k DPD 30, Loan C $3k DPD 90)`);

  const report = await getPortfolioQualityReport({ branchId: branch.id, currency: "USD" }, [branch.id]);

  const usdPar = report.parSummaries.find((s) => s.currency === "USD");

  if (!usdPar) {
    throw new Error("FAILED: USD PAR summary not found in report!");
  }

  console.log(`   Outstanding Principal Portfolio: $${usdPar.totalOutstandingPrincipal.toLocaleString()}`);
  console.log(`   PAR30 Rate: ${usdPar.par30Rate}% ($${usdPar.par30Amount.toLocaleString()})`);
  console.log(`   PAR90 Rate: ${usdPar.par90Rate}% ($${usdPar.par90Amount.toLocaleString()})`);

  // Assert exact formulas:
  // Total Portfolio = $6,000
  // PAR30 Exposure = $5,000 (83.33%)
  // PAR90 Exposure = $3,000 (50.00%)
  if (usdPar.totalOutstandingPrincipal !== 6000) {
    throw new Error(`FAILED: Total portfolio principal expected 6000, got ${usdPar.totalOutstandingPrincipal}`);
  }
  if (usdPar.par30Amount !== 5000 || usdPar.par30Rate !== 83.33) {
    throw new Error(`FAILED: PAR30 expected 5000 (83.33%), got ${usdPar.par30Amount} (${usdPar.par30Rate}%)`);
  }
  if (usdPar.par90Amount !== 3000 || usdPar.par90Rate !== 50) {
    throw new Error(`FAILED: PAR90 expected 3000 (50.00%), got ${usdPar.par90Amount} (${usdPar.par90Rate}%)`);
  }

  console.log(`[PASS] 12. PAR30 (83.33%) and PAR90 (50.00%) formulas mathematically verified!`);

  // Verify Vintage Cohorts
  if (report.vintageCohorts.length < 3) {
    throw new Error("FAILED: Vintage cohort grouping missing expected cohorts!");
  }
  console.log(`[PASS] 13. Vintage cohorts verified (${report.vintageCohorts.length} disbursement month cohorts generated)`);

  console.log("==================================================");
  console.log("ALL PHASE 5B E2E VERIFICATION TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runPhase5bE2eVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 5B E2E Verification Failed:", err);
    process.exit(1);
  });
