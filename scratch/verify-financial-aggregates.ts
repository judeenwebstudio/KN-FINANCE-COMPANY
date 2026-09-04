import { prisma } from "../src/lib/prisma";

async function verifyAggregates() {
  const [accountBalanceAgg, loanPrincipalAgg, loanPaidAgg, txAmountAgg, repaymentAmountAgg] = await Promise.all([
    prisma.account.aggregate({ _sum: { balance: true } }),
    prisma.loan.aggregate({ _sum: { principalAmount: true } }),
    prisma.loan.aggregate({ _sum: { paidAmount: true } }),
    prisma.transaction.aggregate({ _sum: { amount: true } }),
    prisma.loanRepayment.aggregate({ _sum: { amount: true } }),
  ]);

  console.log("=== FINANCIAL AGGREGATE SUMMARY ===");
  console.log("Total Account Balances Sum:", accountBalanceAgg._sum.balance?.toString());
  console.log("Total Loan Principal Sum:", loanPrincipalAgg._sum.principalAmount?.toString());
  console.log("Total Loan Paid Sum:", loanPaidAgg._sum.paidAmount?.toString());
  console.log("Total Transactions Sum:", txAmountAgg._sum.amount?.toString());
  console.log("Total Repayments Sum:", repaymentAmountAgg._sum.amount?.toString());
}

verifyAggregates().finally(() => prisma.$disconnect());
