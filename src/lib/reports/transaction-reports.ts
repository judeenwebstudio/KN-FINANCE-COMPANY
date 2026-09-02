import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds, mapTransactionDirection } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type MemberTransactionReportParams = {
  branchId?: string;
  memberId?: string;
  accountId?: string;
  type?: string;
  categoryId?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getMemberTransactionReport(params: MemberTransactionReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const where: Prisma.TransactionWhereInput = {
    branchId: { in: branchIds },
  };

  if (params.memberId && params.memberId !== "ALL") {
    where.memberId = params.memberId;
  }
  if (params.accountId && params.accountId !== "ALL") {
    where.accountId = params.accountId;
  }
  if (params.type && params.type !== "ALL") {
    where.type = params.type as Prisma.EnumTransactionTypeFilter;
  }
  if (params.categoryId && params.categoryId !== "ALL") {
    where.categoryId = params.categoryId;
  }
  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { member: { memberNumber: { contains: q, mode: "insensitive" } } },
      { member: { user: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = start;
    if (end) where.createdAt.lt = end;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      member: { include: { user: true } },
      account: true,
      branch: true,
      category: true,
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [];
  let totalCredit = new Decimal(0);
  let totalDebit = new Decimal(0);

  for (const tx of transactions) {
    const dir = mapTransactionDirection({
      type: tx.type,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
    });

    if (params.direction && params.direction !== "ALL" && dir !== params.direction) {
      continue;
    }

    if (dir === "CREDIT") totalCredit = totalCredit.add(tx.amount);
    else if (dir === "DEBIT") totalDebit = totalDebit.add(tx.amount);

    rows.push({
      id: tx.id,
      transactionNumber: tx.reference,
      date: tx.createdAt.toISOString(),
      memberName: tx.member.user.name,
      memberNumber: tx.member.memberNumber,
      accountNumber: tx.account?.accountNumber ?? "—",
      branchName: tx.branch.name,
      type: tx.type,
      categoryName: tx.category?.name ?? null,
      currency: tx.currency,
      direction: dir,
      debit: dir === "DEBIT" ? tx.amount.toString() : null,
      credit: dir === "CREDIT" ? tx.amount.toString() : null,
      balanceBefore: tx.balanceBefore ? tx.balanceBefore.toString() : null,
      balanceAfter: tx.balanceAfter ? tx.balanceAfter.toString() : null,
      reference: tx.reference,
      status: tx.status,
      createdByName: tx.createdBy?.name ?? null,
    });
  }

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    rows: paginatedRows,
    totalCredit: totalCredit.toString(),
    totalDebit: totalDebit.toString(),
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      generatedAt: new Date().toISOString(),
    },
  };
}

export type LoanRepaymentReportParams = {
  branchId?: string;
  loanId?: string;
  memberId?: string;
  status?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getLoanRepaymentReport(params: LoanRepaymentReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const where: Prisma.LoanRepaymentWhereInput = {
    loan: {
      branchId: { in: branchIds },
      ...(params.currency && params.currency !== "ALL" ? { currency: params.currency.toUpperCase() } : {}),
    },
  };
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { repaymentNumber: { contains: q, mode: "insensitive" } },
      { loan: { loanNumber: { contains: q, mode: "insensitive" } } },
      { member: { memberNumber: { contains: q, mode: "insensitive" } } },
      { member: { user: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (start || end) {
    where.paymentDate = {};
    if (start) where.paymentDate.gte = start;
    if (end) where.paymentDate.lt = end;
  }

  const repayments = await prisma.loanRepayment.findMany({
    where,
    include: {
      loan: { include: { branch: true } },
      member: { include: { user: true } },
      account: true,
      createdBy: true,
      allocations: true,
    },
    orderBy: { paymentDate: "desc" },
  });

  const rows = repayments.map((r) => {
    // Derive penalty, fee, interest, principal from allocations if present
    let penalty = new Decimal(0);
    let fee = new Decimal(0);
    let interest = new Decimal(0);
    let principal = new Decimal(0);

    if (r.allocations && r.allocations.length > 0) {
      for (const alloc of r.allocations) {
        penalty = penalty.add(alloc.penaltyAmount);
        fee = fee.add(alloc.feeAmount);
        interest = interest.add(alloc.interestAmount);
        principal = principal.add(alloc.principalAmount);
      }
    } else {
      penalty = r.penaltyAmount;
      fee = r.feeAmount;
      interest = r.interestAmount;
      principal = r.principalAmount;
    }

    return {
      id: r.id,
      repaymentNumber: r.repaymentNumber,
      paymentDate: r.paymentDate.toISOString(),
      loanNumber: r.loan.loanNumber,
      memberName: r.member.user.name,
      memberNumber: r.member.memberNumber,
      branchName: r.loan.branch.name,
      accountNumber: r.account.accountNumber,
      currency: r.loan.currency,
      totalAmount: r.amount.toString(),
      penalty: penalty.toString(),
      fee: fee.toString(),
      interest: interest.toString(),
      principal: principal.toString(),
      status: r.status,
      createdByName: r.createdBy?.name ?? null,
      reversedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
      reversalReason: r.reversalReason,
    };
  });

  // Group total summary by ISO currency code
  const currencyGrouping = rows.reduce<Record<string, { currency: string; totalAmount: Prisma.Decimal; count: number }>>(
    (acc, r) => {
      const code = r.currency.toUpperCase();
      const row = acc[code] ?? { currency: code, totalAmount: new Decimal(0), count: 0 };
      row.totalAmount = row.totalAmount.add(new Decimal(r.totalAmount));
      row.count += 1;
      acc[code] = row;
      return acc;
    },
    {}
  );

  const summaries = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    totalAmount: c.totalAmount.toString(),
    count: c.count,
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
      allocationSource: "LoanRepaymentAllocation ledger",
      generatedAt: new Date().toISOString(),
    },
  };
}
