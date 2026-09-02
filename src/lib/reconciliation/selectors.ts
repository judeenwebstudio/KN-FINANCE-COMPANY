import { prisma } from "@/lib/prisma";
import { resolveAuthorizedBranchIds } from "@/lib/reports/filters";
import { Prisma } from "@/generated/prisma/client";

export type ReconciliationDashboardSummary = {
  totalImports: number;
  totalStatementLines: number;
  matchedLinesCount: number;
  unmatchedLinesCount: number;
  ignoredLinesCount: number;
  unreconciledInternalTxCount: number;
  reconciledInternalTxCount: number;
  reconciliationRateCount: number | null; // Matched Eligible Lines / Total Eligible Lines
  reconciliationRateAmount: number | null; // Matched Eligible Amount / Total Eligible Amount
  byBankAccount: Array<{
    bankAccountId: string;
    bankAccountName: string;
    accountNumber: string;
    currency: string;
    matchedLinesCount: number;
    unmatchedLinesCount: number;
    unreconciledTxCount: number;
    reconciliationRatePercent: number | null;
  }>;
};

export async function getReconciliationSummary(filterBranchId?: string): Promise<ReconciliationDashboardSummary> {
  const accessibleBranchIds = await resolveAuthorizedBranchIds();
  const targetBranchIds = filterBranchId && filterBranchId !== "all"
    ? accessibleBranchIds.filter((id) => id === filterBranchId)
    : accessibleBranchIds;

  const scope = { branchId: { in: targetBranchIds } };

  const [bankAccounts, imports, statementLines, bankTxs] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { ...scope, status: "ACTIVE" },
      select: { id: true, name: true, accountNumber: true, currency: true },
    }),
    prisma.bankStatementImport.findMany({
      where: scope,
      select: { id: true, bankAccountId: true, status: true },
    }),
    prisma.bankStatementLine.findMany({
      where: { statementImport: scope },
      select: { id: true, statementImportId: true, amount: true, status: true },
    }),
    prisma.bankTransaction.findMany({
      where: { bankAccount: scope },
      select: { id: true, bankAccountId: true, amount: true, reconciliationStatus: true },
    }),
  ]);


  let matchedLinesCount = 0;
  let unmatchedLinesCount = 0;
  let ignoredLinesCount = 0;

  let matchedLinesAmount = new Prisma.Decimal(0);
  let totalEligibleAmount = new Prisma.Decimal(0);

  const accountStats = new Map<string, { matched: number; unmatched: number }>();

  for (const line of statementLines) {
    if (line.status === "MATCHED") {
      matchedLinesCount++;
      matchedLinesAmount = matchedLinesAmount.add(line.amount);
      totalEligibleAmount = totalEligibleAmount.add(line.amount);
    } else if (line.status === "UNMATCHED") {
      unmatchedLinesCount++;
      totalEligibleAmount = totalEligibleAmount.add(line.amount);
    } else if (line.status === "IGNORED") {
      ignoredLinesCount++;
    }
  }

  const eligibleLinesCount = matchedLinesCount + unmatchedLinesCount;
  const countRate = eligibleLinesCount > 0 ? (matchedLinesCount / eligibleLinesCount) * 100 : null;
  const amountRate = !totalEligibleAmount.isZero() ? matchedLinesAmount.div(totalEligibleAmount).mul(100).toNumber() : null;

  let unreconciledInternalTxCount = 0;
  let reconciledInternalTxCount = 0;
  const accountTxStats = new Map<string, number>();

  for (const tx of bankTxs) {
    if (tx.reconciliationStatus === "RECONCILED") {
      reconciledInternalTxCount++;
    } else {
      unreconciledInternalTxCount++;
      accountTxStats.set(tx.bankAccountId, (accountTxStats.get(tx.bankAccountId) || 0) + 1);
    }
  }

  // Account level stats
  for (const imp of imports) {
    const linesForImport = statementLines.filter((l) => l.statementImportId === imp.id);
    const curr = accountStats.get(imp.bankAccountId) || { matched: 0, unmatched: 0 };

    for (const l of linesForImport) {
      if (l.status === "MATCHED") curr.matched++;
      if (l.status === "UNMATCHED") curr.unmatched++;
    }
    accountStats.set(imp.bankAccountId, curr);
  }

  const byBankAccount = bankAccounts.map((acc) => {
    const stats = accountStats.get(acc.id) || { matched: 0, unmatched: 0 };
    const unreconciledTxCount = accountTxStats.get(acc.id) || 0;
    const totalEligible = stats.matched + stats.unmatched;
    const rate = totalEligible > 0 ? (stats.matched / totalEligible) * 100 : null;

    return {
      bankAccountId: acc.id,
      bankAccountName: acc.name,
      accountNumber: acc.accountNumber,
      currency: acc.currency,
      matchedLinesCount: stats.matched,
      unmatchedLinesCount: stats.unmatched,
      unreconciledTxCount,
      reconciliationRatePercent: rate !== null ? Math.round(rate * 10) / 10 : null,
    };
  });

  return {
    totalImports: imports.length,
    totalStatementLines: statementLines.length,
    matchedLinesCount,
    unmatchedLinesCount,
    ignoredLinesCount,
    unreconciledInternalTxCount,
    reconciledInternalTxCount,
    reconciliationRateCount: countRate !== null ? Math.round(countRate * 10) / 10 : null,
    reconciliationRateAmount: amountRate !== null ? Math.round(amountRate * 10) / 10 : null,
    byBankAccount,
  };
}
