import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type TreasuryReportParams = {
  branchId?: string;
  treasuryAccountId?: string;
  type?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getTreasuryReport(params: TreasuryReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const treasuryAccounts = await prisma.treasuryAccount.findMany({
    where: { branchId: { in: branchIds } },
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  const accountSummaries = await Promise.all(
    treasuryAccounts.map(async (acc) => {
      const allTx = await prisma.treasuryTransaction.findMany({
        where: { treasuryAccountId: acc.id },
        select: { direction: true, amount: true },
      });

      let sumCredit = new Decimal(0);
      let sumDebit = new Decimal(0);

      for (const t of allTx) {
        if (t.direction === "CREDIT") sumCredit = sumCredit.add(t.amount);
        else if (t.direction === "DEBIT") sumDebit = sumDebit.add(t.amount);
      }

      const calculatedBalance = sumCredit.sub(sumDebit);
      const isReconciled = acc.balance.equals(calculatedBalance);

      return {
        id: acc.id,
        name: acc.name,
        code: acc.code,
        accountNumber: acc.accountNumber,
        branchName: acc.branch.name,
        currency: acc.currency,
        currentBalance: acc.balance.toString(),
        calculatedBalance: calculatedBalance.toString(),
        reconciliationStatus: isReconciled ? "RECONCILED" : "MISMATCH",
        status: acc.status,
      };
    })
  );

  // Group current balances by ISO currency code
  const currencyGrouping = accountSummaries.reduce<Record<string, { currency: string; totalBalance: Prisma.Decimal; count: number }>>(
    (acc, a) => {
      const code = a.currency.toUpperCase();
      const row = acc[code] ?? { currency: code, totalBalance: new Decimal(0), count: 0 };
      row.totalBalance = row.totalBalance.add(new Decimal(a.currentBalance));
      row.count += 1;
      acc[code] = row;
      return acc;
    },
    {}
  );

  const balancesByCurrency = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    totalBalance: c.totalBalance.toString(),
    count: c.count,
  }));

  // Fetch Treasury Transactions statement
  const txWhere: Prisma.TreasuryTransactionWhereInput = {
    treasuryAccount: { branchId: { in: branchIds } },
  };

  if (params.treasuryAccountId && params.treasuryAccountId !== "ALL") {
    txWhere.treasuryAccountId = params.treasuryAccountId;
  }
  if (params.type && params.type !== "ALL") {
    txWhere.type = params.type as Prisma.EnumTreasuryTransactionTypeFilter;
  }
  if (params.direction && params.direction !== "ALL") {
    txWhere.direction = params.direction as Prisma.EnumFinancialDirectionFilter;
  }
  if (params.currency && params.currency !== "ALL") {
    txWhere.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    txWhere.OR = [
      { treasuryTransactionNumber: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (start || end) {
    txWhere.createdAt = {};
    if (start) txWhere.createdAt.gte = start;
    if (end) txWhere.createdAt.lt = end;
  }

  const transactions = await prisma.treasuryTransaction.findMany({
    where: txWhere,
    include: { treasuryAccount: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  const transactionRows = transactions.map((t) => ({
    id: t.id,
    transactionNumber: t.treasuryTransactionNumber,
    date: t.createdAt.toISOString(),
    accountName: t.treasuryAccount.name,
    accountNumber: t.treasuryAccount.accountNumber,
    type: t.type,
    direction: t.direction,
    currency: t.currency,
    debit: t.direction === "DEBIT" ? t.amount.toString() : null,
    credit: t.direction === "CREDIT" ? t.amount.toString() : null,
    balanceBefore: t.balanceBefore.toString(),
    balanceAfter: t.balanceAfter.toString(),
    reference: t.reference,
    description: t.description,
    createdByName: t.createdBy?.name ?? null,
  }));

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = transactionRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = transactionRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    accountSummaries,
    balancesByCurrency,
    rows: paginatedRows,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      reconciliationFormula: "Current Balance = SUM(CREDIT rows) - SUM(DEBIT rows)",
      generatedAt: new Date().toISOString(),
    },
  };
}
