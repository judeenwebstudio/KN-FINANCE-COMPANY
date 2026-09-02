import "dotenv/config";
import { Role, AccountType, LoanStatus, TransactionType, TransactionStatus, InterestType, RepaymentFrequency, FeeType, LoanProductStatus, PenaltyType, PenaltyFrequency, PenaltyBasis, PenaltyRuleStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { hash } from "bcryptjs";
import { bootstrapRBAC } from "../src/lib/auth/bootstrap";
const password = "DemoPass123!";

async function main() {
  const passwordHash = await hash(password, 12);
  const central = await prisma.branch.upsert({ where: { code: "NYC-01" }, update: {}, create: { name: "Central Branch", code: "NYC-01", email: "central@centralcreditflow.demo", phone: "+1 212 555 0100", address: "120 Liberty Street", city: "New York", state: "NY", country: "USA", currency: "USD" } });
  const riverside = await prisma.branch.upsert({ where: { code: "DEL-02" }, update: {}, create: { name: "Riverside Branch", code: "DEL-02", email: "riverside@creditflow.demo", phone: "+91 11 5550 2100", address: "14 Riverside Avenue", city: "New Delhi", state: "Delhi", country: "India", currency: "INR" } });
  const superAdmin = await prisma.user.upsert({ where: { email: "superadmin@creditflow.demo" }, update: { passwordHash }, create: { name: "Avery Morgan", email: "superadmin@creditflow.demo", passwordHash, role: Role.SUPER_ADMIN } });
  await prisma.user.upsert({ where: { email: "admin@creditflow.demo" }, update: { passwordHash }, create: { name: "Jordan Lee", email: "admin@creditflow.demo", passwordHash, role: Role.ADMIN, branchId: central.id } });

  // Seed AccountTypePolicy records (Authoritative for Phase 3)
  const savingsPolicy = await prisma.accountTypePolicy.upsert({
    where: { code: "SAVINGS" },
    update: {},
    create: {
      name: "Standard Savings Account",
      code: "SAVINGS",
      description: "Standard member savings account supporting deposits and withdrawals.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  const checkingPolicy = await prisma.accountTypePolicy.upsert({
    where: { code: "CHECKING" },
    update: {},
    create: {
      name: "Current Checking Account",
      code: "CHECKING",
      description: "Standard checking account for daily operational cash activities.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  await prisma.accountTypePolicy.upsert({
    where: { code: "SETTLEMENT" },
    update: {},
    create: {
      name: "Loan Settlement Account",
      code: "SETTLEMENT",
      description: "Specialized settlement account for loan disbursements and repayments.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  // Seed Transaction Categories
  await prisma.transactionCategory.upsert({
    where: { code: "CASH_DEPOSIT" },
    update: {},
    create: { name: "Cash Deposit", code: "CASH_DEPOSIT", description: "Direct over-the-counter cash deposit", direction: "CREDIT", status: "ACTIVE", createdById: superAdmin.id },
  });

  await prisma.transactionCategory.upsert({
    where: { code: "BANK_DEPOSIT" },
    update: {},
    create: { name: "Bank Deposit", code: "BANK_DEPOSIT", description: "Bank transfer / deposit request approval", direction: "CREDIT", status: "ACTIVE", createdById: superAdmin.id },
  });

  await prisma.transactionCategory.upsert({
    where: { code: "CASH_WITHDRAWAL" },
    update: {},
    create: { name: "Cash Withdrawal", code: "CASH_WITHDRAWAL", description: "Over-the-counter cash withdrawal", direction: "DEBIT", status: "ACTIVE", createdById: superAdmin.id },
  });

  await prisma.transactionCategory.upsert({
    where: { code: "BANK_WITHDRAWAL" },
    update: {},
    create: { name: "Bank Withdrawal", code: "BANK_WITHDRAWAL", description: "Bank transfer withdrawal request approval", direction: "DEBIT", status: "ACTIVE", createdById: superAdmin.id },
  });

  await prisma.transactionCategory.upsert({
    where: { code: "OPENING_BALANCE" },
    update: {},
    create: { name: "Opening Balance", code: "OPENING_BALANCE", description: "Initial opening balance for new account", direction: "CREDIT", status: "ACTIVE", createdById: superAdmin.id },
  });

  await prisma.transactionCategory.upsert({
    where: { code: "ADJUSTMENT" },
    update: {},
    create: { name: "Account Adjustment", code: "ADJUSTMENT", description: "Operational correction or adjustment", direction: "BOTH", status: "ACTIVE", createdById: superAdmin.id },
  });

  // Seed Penalty Rules
  const standardDailyPenaltyRule = await prisma.loanPenaltyRule.upsert({
    where: { code: "STD-DAILY-PENALTY" },
    update: {},
    create: {
      name: "Standard Daily Overdue Penalty (0.1%/day)",
      code: "STD-DAILY-PENALTY",
      description: "0.1% daily penalty on outstanding installment after 3 days grace period, capped at $150.",
      penaltyType: PenaltyType.PERCENTAGE,
      penaltyFrequency: PenaltyFrequency.DAILY,
      penaltyBasis: PenaltyBasis.OUTSTANDING_INSTALLMENT,
      gracePeriodDays: 3,
      penaltyValue: 0.1,
      maximumPenaltyAmount: 150,
      status: PenaltyRuleStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  const fixedLateFeeRule = await prisma.loanPenaltyRule.upsert({
    where: { code: "FIXED-LATE-FEE-25" },
    update: {},
    create: {
      name: "Standard Fixed Late Fee ($25)",
      code: "FIXED-LATE-FEE-25",
      description: "One-time $25 late fee after 5 days grace period.",
      penaltyType: PenaltyType.FIXED,
      penaltyFrequency: PenaltyFrequency.ONE_TIME,
      penaltyBasis: PenaltyBasis.OUTSTANDING_INSTALLMENT,
      gracePeriodDays: 5,
      penaltyValue: 25,
      maximumPenaltyAmount: 25,
      status: PenaltyRuleStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  // Seed Loan Products
  const prodPersonalFlex = await prisma.loanProduct.upsert({
    where: { code: "PFL-USD" },
    update: { penaltyRuleId: standardDailyPenaltyRule.id },
    create: {
      name: "Personal Flex Loan",
      code: "PFL-USD",
      description: "Flexible personal loan for general financial needs with declining balance interest.",
      currency: "USD",
      minimumAmount: 1000,
      maximumAmount: 25000,
      minimumTermMonths: 6,
      maximumTermMonths: 36,
      interestRate: 12.0,
      interestType: InterestType.DECLINING_BALANCE,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.PERCENTAGE,
      processingFeeValue: 1.5,
      requiresApproval: true,
      status: LoanProductStatus.ACTIVE,
      penaltyRuleId: standardDailyPenaltyRule.id,
      createdById: superAdmin.id,
    },
  });

  const prodQuickCash = await prisma.loanProduct.upsert({
    where: { code: "QCL-USD" },
    update: { penaltyRuleId: fixedLateFeeRule.id },
    create: {
      name: "Quick Cash Loan",
      code: "QCL-USD",
      description: "Fast short-term emergency loan with flat interest rate.",
      currency: "USD",
      minimumAmount: 500,
      maximumAmount: 5000,
      minimumTermMonths: 3,
      maximumTermMonths: 12,
      interestRate: 15.0,
      interestType: InterestType.FLAT,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.FIXED,
      processingFeeValue: 50,
      requiresApproval: true,
      status: LoanProductStatus.ACTIVE,
      penaltyRuleId: fixedLateFeeRule.id,
      createdById: superAdmin.id,
    },
  });

  const prodInrBusiness = await prisma.loanProduct.upsert({
    where: { code: "IBL-INR" },
    update: {},
    create: {
      name: "INR Business Loan",
      code: "IBL-INR",
      description: "Dedicated business loan for small and medium enterprises in Riverside Branch.",
      currency: "INR",
      minimumAmount: 50000,
      maximumAmount: 1000000,
      minimumTermMonths: 6,
      maximumTermMonths: 36,
      interestRate: 11.5,
      interestType: InterestType.DECLINING_BALANCE,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.PERCENTAGE,
      processingFeeValue: 2.0,
      requiresApproval: true,
      status: LoanProductStatus.ACTIVE,
      branchId: riverside.id,
      createdById: superAdmin.id,
    },
  });

  const people = [
    ["Maya Patel", "member@creditflow.demo", central.id, "MBR-10001", "USD"],
    ["Noah Williams", "noah@creditflow.demo", central.id, "MBR-10002", "USD"],
    ["Sofia Garcia", "sofia@creditflow.demo", central.id, "MBR-10003", "EUR"],
    ["Arjun Mehta", "arjun@creditflow.demo", riverside.id, "MBR-20001", "INR"],
    ["Isha Rao", "isha@creditflow.demo", riverside.id, "MBR-20002", "INR"],
  ] as const;

  for (let i=0; i<people.length; i++) {
    const [name,email,branchId,memberNumber,currency] = people[i];
    const user = await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { name, email, passwordHash, role: Role.MEMBER, branchId } });
    const profile = await prisma.memberProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, memberNumber, branchId, phone: `+1 555 010${i}`, address: `${100+i} Market Street`, identityNumber: `DEMO-ID-${1000+i}` } });
    
    const savings = await prisma.account.upsert({
      where: { accountNumber: `SAV-${memberNumber.slice(4)}` },
      update: { accountTypeId: savingsPolicy.id },
      create: { accountNumber: `SAV-${memberNumber.slice(4)}`, memberId: profile.id, branchId, accountType: AccountType.SAVINGS, accountTypeId: savingsPolicy.id, currency, balance: i===0 ? 12840.5 : 5000+i*1725, loanGuarantee: i===0 ? 1500 : 500 }
    });

    if (i === 0) {
      await prisma.account.upsert({
        where: { accountNumber: "CHK-10001" },
        update: { accountTypeId: checkingPolicy.id },
        create: { accountNumber: "CHK-10001", memberId: profile.id, branchId, accountType: AccountType.CHECKING, accountTypeId: checkingPolicy.id, currency, balance: 3240.75, loanGuarantee: 0 }
      });
    }

    let productId = prodPersonalFlex.id;
    if (currency === "INR") productId = prodInrBusiness.id;
    if (i === 1) productId = prodQuickCash.id;

    const loan = await prisma.loan.upsert({ where: { loanNumber: `LN-2026-${1001+i}` }, update: { productId }, create: { loanNumber: `LN-2026-${1001+i}`, productId, memberId: profile.id, branchId, principalAmount: currency === "INR" ? 450000+i*25000 : 18000+i*2500, paidAmount: currency === "INR" ? 115000 : 3200+i*400, interestRate: 8.75+i*.25, termMonths: 24, status: i===2 ? LoanStatus.PENDING : LoanStatus.ACTIVE, currency, createdById: superAdmin.id } });
    await prisma.transaction.upsert({ where: { reference: `DEP-DEMO-${i+1}` }, update: {}, create: { accountId: savings.id, memberId: profile.id, branchId, type: TransactionType.DEPOSIT, amount: 750+i*100, currency, reference: `DEP-DEMO-${i+1}`, description: "Branch deposit", status: i===1 ? TransactionStatus.PENDING : TransactionStatus.COMPLETED } });
    if (i===0) await prisma.transaction.upsert({ where: { reference: "WDR-DEMO-1" }, update: {}, create: { accountId: savings.id, memberId: profile.id, branchId, type: TransactionType.WITHDRAWAL, amount: 250, currency, reference: "WDR-DEMO-1", description: "Pending withdrawal request", status: TransactionStatus.PENDING } });
    void loan;
  }

  // Non-destructively populate accountTypeId for any unlinked accounts
  const unlinkedAccounts = await prisma.account.findMany({ where: { accountTypeId: null } });
  for (const acc of unlinkedAccounts) {
    const code = acc.accountType === "SAVINGS" ? "SAVINGS" : "CHECKING";
    const pol = await prisma.accountTypePolicy.findUnique({ where: { code } });
    if (pol) {
      await prisma.account.update({ where: { id: acc.id }, data: { accountTypeId: pol.id } });
    }
  }

  // Execute RBAC bootstrap
  await bootstrapRBAC();

  console.log("Seed complete. Demo password:", password);
}
main().finally(() => prisma.$disconnect());
