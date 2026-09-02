import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export function maskAccountNumber(num: string): string {
  if (!num) return "—";
  if (num.length <= 4) return num;
  return `•••• ${num.slice(-4)}`;
}

export type BankBalancesParams = {
  branchId?: string;
  status?: string;
  currency?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getBankBalancesReport(params: BankBalancesParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);

  const where: Prisma.BankAccountWhereInput = {
    branchId: { in: branchIds },
  };

  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumBankAccountStatusFilter;
  }
  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { bankName: { contains: q, mode: "insensitive" } },
      { accountNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where,
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  const accountSummaries = await Promise.all(
    bankAccounts.map(async (acc) => {
      const allTx = await prisma.bankTransaction.findMany({
        where: { bankAccountId: acc.id },
        select: { direction: true, amount: true },
      });

      let sumCredit = new Decimal(0);
      let sumDebit = new Decimal(0);

      for (const t of allTx) {
        if (t.direction === "CREDIT") sumCredit = sumCredit.add(t.amount);
        else if (t.direction === "DEBIT") sumDebit = sumDebit.add(t.amount);
      }

      const calculatedBalance = sumCredit.sub(sumDebit);
      const isReconciled = acc.currentBalance.equals(calculatedBalance);

      return {
        id: acc.id,
        name: acc.name,
        accountName: acc.accountName,
        accountNumber: acc.accountNumber,
        maskedAccountNumber: maskAccountNumber(acc.accountNumber),
        bankName: acc.bankName,
        branchName: acc.branch.name,
        currency: acc.currency,
        currentBalance: acc.currentBalance.toString(),
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

  const summaries = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    totalBalance: c.totalBalance.toString(),
    count: c.count,
  }));

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = accountSummaries.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = accountSummaries.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    rows: paginatedRows,
    summaries,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      balanceLabel: "Current Bank Account Balance",
      generatedAt: new Date().toISOString(),
    },
  };
}

export type BankTransactionReportParams = {
  branchId?: string;
  bankAccountId?: string;
  type?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  reconciliationStatus?: "ALL" | "UNRECONCILED" | "RECONCILED";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getBankTransactionReport(params: BankTransactionReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const txWhere: Prisma.BankTransactionWhereInput = {
    bankAccount: { branchId: { in: branchIds } },
  };

  if (params.bankAccountId && params.bankAccountId !== "ALL") {
    txWhere.bankAccountId = params.bankAccountId;
  }
  if (params.type && params.type !== "ALL") {
    txWhere.type = params.type as Prisma.EnumBankTransactionTypeFilter;
  }
  if (params.direction && params.direction !== "ALL") {
    txWhere.direction = params.direction as Prisma.EnumFinancialDirectionFilter;
  }
  if (params.reconciliationStatus && params.reconciliationStatus !== "ALL") {
    txWhere.reconciliationStatus = params.reconciliationStatus as Prisma.EnumReconciliationStatusFilter;
  }
  if (params.currency && params.currency !== "ALL") {
    txWhere.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    txWhere.OR = [
      { bankTransactionNumber: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (start || end) {
    txWhere.createdAt = {};
    if (start) txWhere.createdAt.gte = start;
    if (end) txWhere.createdAt.lt = end;
  }

  const transactions = await prisma.bankTransaction.findMany({
    where: txWhere,
    include: {
      bankAccount: { include: { branch: true } },
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = transactions.map((t) => ({
    id: t.id,
    transactionNumber: t.bankTransactionNumber,
    date: t.createdAt.toISOString(),
    accountName: t.bankAccount.name,
    bankName: t.bankAccount.bankName,
    maskedAccountNumber: maskAccountNumber(t.bankAccount.accountNumber),
    branchName: t.bankAccount.branch.name,
    currency: t.currency,
    type: t.type,
    direction: t.direction,
    debit: t.direction === "DEBIT" ? t.amount.toString() : null,
    credit: t.direction === "CREDIT" ? t.amount.toString() : null,
    balanceBefore: t.balanceBefore.toString(),
    balanceAfter: t.balanceAfter.toString(),
    reconciliationStatus: t.reconciliationStatus,
    reference: t.reference,
    description: t.description,
    createdByName: t.createdBy?.name ?? null,
  }));

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    rows: paginatedRows,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      generatedAt: new Date().toISOString(),
    },
  };
}
