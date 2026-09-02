import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds, mapTransactionDirection } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type AccountStatementParams = {
  branchId?: string;
  memberId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export async function getAccountStatementReport(params: AccountStatementParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  if (!params.accountId) {
    return {
      filters: params,
      rows: [],
      account: null,
      openingBalance: null,
      openingBalanceStatus: "NO_ACCOUNT_SELECTED",
      periodTotalCredit: "0.00",
      periodTotalDebit: "0.00",
      closingBalance: null,
      currency: "USD",
      pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
      metadata: { dateBasis: "createdAt", generatedAt: new Date().toISOString() },
    };
  }

  const account = await prisma.account.findFirst({
    where: { id: params.accountId, branchId: { in: branchIds } },
    include: { member: { include: { user: true } }, branch: true },
  });

  if (!account) {
    return {
      filters: params,
      rows: [],
      account: null,
      openingBalance: null,
      openingBalanceStatus: "ACCOUNT_NOT_FOUND_OR_UNAUTHORIZED",
      periodTotalCredit: "0.00",
      periodTotalDebit: "0.00",
      closingBalance: null,
      currency: "USD",
      pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
      metadata: { dateBasis: "createdAt", generatedAt: new Date().toISOString() },
    };
  }

  // Determine Opening Balance strictly according to rules A, B, C:
  let openingBalance: Prisma.Decimal | null = null;
  let openingBalanceStatus: "EXACT_PREVIOUS_SNAPSHOT" | "FIRST_IN_PERIOD_SNAPSHOT" | "UNAVAILABLE" = "UNAVAILABLE";

  if (start) {
    // Rule A: Latest transaction before start date with balanceAfter
    const prevTx = await prisma.transaction.findFirst({
      where: { accountId: account.id, createdAt: { lt: start }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    if (prevTx && prevTx.balanceAfter != null) {
      openingBalance = prevTx.balanceAfter;
      openingBalanceStatus = "EXACT_PREVIOUS_SNAPSHOT";
    } else {
      // Rule B: First transaction inside period with balanceBefore
      const firstInPeriodTx = await prisma.transaction.findFirst({
        where: {
          accountId: account.id,
          createdAt: end ? { gte: start, lt: end } : { gte: start },
          status: "COMPLETED",
        },
        orderBy: { createdAt: "asc" },
      });

      if (firstInPeriodTx && firstInPeriodTx.balanceBefore != null) {
        openingBalance = firstInPeriodTx.balanceBefore;
        openingBalanceStatus = "FIRST_IN_PERIOD_SNAPSHOT";
      } else {
        openingBalanceStatus = "UNAVAILABLE";
      }
    }
  } else {
    // If no start date specified, opening balance is 0.00 or initial snapshot
    const firstTx = await prisma.transaction.findFirst({
      where: { accountId: account.id, status: "COMPLETED" },
      orderBy: { createdAt: "asc" },
    });
    openingBalance = firstTx && firstTx.balanceBefore != null ? firstTx.balanceBefore : new Decimal(0);
    openingBalanceStatus = "EXACT_PREVIOUS_SNAPSHOT";
  }

  // Fetch in-period completed transactions
  const txWhere: Prisma.TransactionWhereInput = {
    accountId: account.id,
    status: "COMPLETED",
  };

  if (start || end) {
    txWhere.createdAt = {};
    if (start) txWhere.createdAt.gte = start;
    if (end) txWhere.createdAt.lt = end;
  }

  const allInPeriodTxs = await prisma.transaction.findMany({
    where: txWhere,
    include: { category: true, createdBy: true },
    orderBy: { createdAt: "asc" },
  });

  let periodTotalCredit = new Decimal(0);
  let periodTotalDebit = new Decimal(0);

  const mappedRows = allInPeriodTxs.map((tx) => {
    const dir = mapTransactionDirection({
      type: tx.type,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
    });

    const amt = tx.amount;

    if (dir === "CREDIT") {
      periodTotalCredit = periodTotalCredit.add(amt);
    } else if (dir === "DEBIT") {
      periodTotalDebit = periodTotalDebit.add(amt);
    }

    return {
      id: tx.id,
      transactionNumber: tx.reference,
      transactionDate: tx.createdAt.toISOString(),
      type: tx.type,
      categoryName: tx.category?.name ?? null,
      direction: dir,
      debit: dir === "DEBIT" ? amt.toString() : null,
      credit: dir === "CREDIT" ? amt.toString() : null,
      balanceBefore: tx.balanceBefore ? tx.balanceBefore.toString() : null,
      balanceAfter: tx.balanceAfter ? tx.balanceAfter.toString() : null,
      reference: tx.reference,
      description: tx.description,
      createdByName: tx.createdBy?.name ?? null,
    };
  });

  // Calculate closing balance
  let closingBalance: string | null = null;
  if (openingBalance != null) {
    const calcClosing = openingBalance.add(periodTotalCredit).sub(periodTotalDebit);
    closingBalance = calcClosing.toString();
  }

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = mappedRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = mappedRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    account: {
      id: account.id,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      currency: account.currency,
      status: account.status,
      currentBalance: account.balance.toString(),
      memberName: account.member.user.name,
      memberNumber: account.member.memberNumber,
      branchName: account.branch.name,
    },
    rows: paginatedRows,
    openingBalance: openingBalance ? openingBalance.toString() : null,
    openingBalanceStatus,
    periodTotalCredit: periodTotalCredit.toString(),
    periodTotalDebit: periodTotalDebit.toString(),
    closingBalance,
    currency: account.currency,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      dateBasis: "createdAt",
      generatedAt: new Date().toISOString(),
      reportMethodology: "Snapshot-backed historical ledger reconciliation",
    },
  };
}

export type AccountBalancesParams = {
  branchId?: string;
  accountType?: string;
  currency?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getAccountBalancesReport(params: AccountBalancesParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);

  const where: Prisma.AccountWhereInput = {
    branchId: { in: branchIds },
  };

  if (params.accountType && params.accountType !== "ALL") {
    where.accountType = params.accountType as Prisma.EnumAccountTypeFilter;
  }
  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumAccountStatusFilter;
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { accountNumber: { contains: q, mode: "insensitive" } },
      { member: { memberNumber: { contains: q, mode: "insensitive" } } },
      { member: { user: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const accounts = await prisma.account.findMany({
    where,
    include: {
      member: { include: { user: true } },
      branch: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Group current balances strictly by ISO currency code
  const currencyGrouping = accounts.reduce<Record<string, { currency: string; totalBalance: Prisma.Decimal; count: number }>>(
    (acc, a) => {
      const code = a.currency.toUpperCase();
      const row = acc[code] ?? { currency: code, totalBalance: new Decimal(0), count: 0 };
      row.totalBalance = row.totalBalance.add(a.balance);
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

  const rows = accounts.map((a) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    memberNumber: a.member.memberNumber,
    memberName: a.member.user.name,
    branchName: a.branch.name,
    accountType: a.accountType,
    currency: a.currency,
    status: a.status,
    currentBalance: a.balance.toString(),
  }));

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    rows: paginatedRows,
    summaries,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      balanceLabel: "Current Account Balance",
      generatedAt: new Date().toISOString(),
    },
  };
}
