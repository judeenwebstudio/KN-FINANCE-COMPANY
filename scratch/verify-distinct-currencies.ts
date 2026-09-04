import { prisma } from "../src/lib/prisma";

async function verifyDistinctCurrencies() {
  console.log("=== PRODUCTION DISTINCT CURRENCY VALUE AUDIT ===");

  const models = [
    { name: "Branch", fn: () => prisma.branch.findMany({ select: { currency: true } }) },
    { name: "Account", fn: () => prisma.account.findMany({ select: { currency: true } }) },
    { name: "Loan", fn: () => prisma.loan.findMany({ select: { currency: true } }) },
    { name: "LoanProduct", fn: () => prisma.loanProduct.findMany({ select: { currency: true } }) },
    { name: "Transaction", fn: () => prisma.transaction.findMany({ select: { currency: true } }) },
    { name: "Expense", fn: () => prisma.expense.findMany({ select: { currency: true } }) },
    { name: "BankAccount", fn: () => prisma.bankAccount.findMany({ select: { currency: true } }) },
    { name: "TreasuryAccount", fn: () => prisma.treasuryAccount.findMany({ select: { currency: true } }) },
    { name: "Transfer", fn: () => prisma.transfer.findMany({ select: { currency: true } }) },
    { name: "BankStatementImport", fn: () => prisma.bankStatementImport.findMany({ select: { currency: true } }) },
    { name: "AccountTypePolicy", fn: () => prisma.accountTypePolicy.findMany({ select: { currency: true } }) },
    { name: "DepositRequest", fn: () => prisma.depositRequest.findMany({ select: { currency: true } }) },
    { name: "WithdrawalRequest", fn: () => prisma.withdrawalRequest.findMany({ select: { currency: true } }) },
  ];

  for (const m of models) {
    const rows = await m.fn();
    const map: Record<string, number> = {};
    for (const r of rows) {
      const c = (r as any).currency || "NULL";
      map[c] = (map[c] || 0) + 1;
    }
    console.log(`- ${m.name}: total=${rows.length}, distinct=${JSON.stringify(map)}`);
  }

  // Check CompanyProfile locale
  const profiles = await prisma.companyProfile.findMany({ select: { locale: true } });
  console.log(`- CompanyProfile locale:`, profiles);

  // Check NotificationTemplates
  const templates = await prisma.notificationTemplate.findMany({ select: { code: true, subject: true, bodyTemplate: true } });
  const usdTemplates = templates.filter(t => (t.subject && t.subject.includes("USD")) || (t.bodyTemplate && t.bodyTemplate.includes("USD")));
  console.log(`- NotificationTemplates total=${templates.length}, USD_containing=${usdTemplates.length}`);
}

verifyDistinctCurrencies().finally(() => prisma.$disconnect());
