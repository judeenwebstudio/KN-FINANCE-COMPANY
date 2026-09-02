import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type ExpenseReportParams = {
  branchId?: string;
  categoryId?: string;
  sourceType?: "ALL" | "CASH" | "BANK";
  sourceAccountId?: string;
  currency?: string;
  status?: "ALL" | "POSTED" | "REVERSED";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getExpenseReport(params: ExpenseReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const where: Prisma.ExpenseWhereInput = {
    branchId: { in: branchIds },
  };

  if (params.categoryId && params.categoryId !== "ALL") {
    where.categoryId = params.categoryId;
  }
  if (params.sourceType && params.sourceType !== "ALL") {
    where.paymentSourceType = params.sourceType;
  }
  if (params.sourceAccountId && params.sourceAccountId !== "ALL") {
    if (params.sourceType === "CASH") where.treasuryAccountId = params.sourceAccountId;
    else if (params.sourceType === "BANK") where.bankAccountId = params.sourceAccountId;
    else {
      where.OR = [
        { treasuryAccountId: params.sourceAccountId },
        { bankAccountId: params.sourceAccountId },
      ];
    }
  }
  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumExpenseStatusFilter;
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { expenseNumber: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (start || end) {
    where.expenseDate = {};
    if (start) where.expenseDate.gte = start;
    if (end) where.expenseDate.lt = end;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      branch: true,
      category: true,
      treasuryAccount: true,
      bankAccount: true,
      createdBy: true,
    },
    orderBy: { expenseDate: "desc" },
  });

  const rows = expenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    expenseDate: e.expenseDate.toISOString(),
    branchName: e.branch.name,
    categoryName: e.category.name,
    categoryCode: e.category.code,
    paymentSourceType: e.paymentSourceType,
    sourceAccountName:
      e.paymentSourceType === "CASH"
        ? e.treasuryAccount?.name ?? "Treasury Cash"
        : e.bankAccount?.name ?? "Bank Account",
    currency: e.currency,
    amount: e.amount.toString(),
    status: e.status,
    reference: e.reference,
    description: e.description,
    createdByName: e.createdBy?.name ?? null,
    reversedAt: e.reversedAt ? e.reversedAt.toISOString() : null,
    reversalReason: e.reversalReason,
  }));

  // Summarize posted vs reversed expenses by ISO currency code
  const currencyGrouping = rows.reduce<Record<string, { currency: string; postedTotal: Prisma.Decimal; reversedTotal: Prisma.Decimal; count: number }>>(
    (acc, r) => {
      const code = r.currency.toUpperCase();
      const row = acc[code] ?? {
        currency: code,
        postedTotal: new Decimal(0),
        reversedTotal: new Decimal(0),
        count: 0,
      };

      const amt = new Decimal(r.amount);
      if (r.status === "POSTED") row.postedTotal = row.postedTotal.add(amt);
      else if (r.status === "REVERSED") row.reversedTotal = row.reversedTotal.add(amt);

      row.count += 1;
      acc[code] = row;
      return acc;
    },
    {}
  );

  const summaries = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    postedTotal: c.postedTotal.toString(),
    reversedTotal: c.reversedTotal.toString(),
    netTotal: c.postedTotal.sub(c.reversedTotal).toString(),
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
      generatedAt: new Date().toISOString(),
    },
  };
}
