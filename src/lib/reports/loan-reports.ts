import { prisma } from "@/lib/prisma";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { calculateLoanDelinquencySummary } from "@/lib/loans/overdue";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export type LoanReportParams = {
  branchId?: string;
  productId?: string;
  status?: string;
  currency?: string;
  dateField?: "APPLICATION_DATE" | "DISBURSEMENT_DATE" | "MATURITY_DATE";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getLoanReport(params: LoanReportParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);
  const { start, end } = normalizeDateRange(params.startDate, params.endDate);

  const where: Prisma.LoanWhereInput = {
    branchId: { in: branchIds },
  };

  if (params.productId && params.productId !== "ALL") {
    where.productId = params.productId;
  }
  if (params.status && params.status !== "ALL") {
    where.status = params.status as Prisma.EnumLoanStatusFilter;
  }
  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { loanNumber: { contains: q, mode: "insensitive" } },
      { member: { memberNumber: { contains: q, mode: "insensitive" } } },
      { member: { user: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  // Explicit date field filtering
  if (start || end) {
    const field = params.dateField || "APPLICATION_DATE";
    const dateQuery: Prisma.DateTimeFilter = {};
    if (start) dateQuery.gte = start;
    if (end) dateQuery.lt = end;

    if (field === "APPLICATION_DATE") where.createdAt = dateQuery;
    else if (field === "DISBURSEMENT_DATE") where.disbursementDate = dateQuery;
    else if (field === "MATURITY_DATE") where.maturityDate = dateQuery;
  }

  const loans = await prisma.loan.findMany({
    where,
    include: {
      member: { include: { user: true } },
      branch: true,
      product: true,
      repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const rows = loans.map((loan) => {
    let totalPaid = new Decimal(0);
    let totalOutstanding = new Decimal(0);
    let penaltyOutstanding = new Decimal(0);

    for (const sched of loan.repaymentSchedules) {
      totalPaid = totalPaid.add(sched.totalPaid);
      const remPrincipal = sched.principalDue.sub(sched.principalPaid);
      const remInterest = sched.interestDue.sub(sched.interestPaid);
      const remFee = sched.feeDue.sub(sched.feePaid);
      const remPenalty = sched.penaltyDue.sub(sched.penaltyPaid);

      const remTotal = remPrincipal.add(remInterest).add(remFee).add(remPenalty);
      totalOutstanding = totalOutstanding.add(remTotal);
      penaltyOutstanding = penaltyOutstanding.add(remPenalty);
    }

    const delinq = calculateLoanDelinquencySummary(
      { id: loan.id, loanNumber: loan.loanNumber, status: loan.status, currency: loan.currency },
      loan.repaymentSchedules,
      now
    );

    const appliedAmt = loan.principalAmount;
    const approvedAmt = loan.approvedAmount ?? loan.principalAmount;

    return {
      id: loan.id,
      loanNumber: loan.loanNumber,
      memberNumber: loan.member.memberNumber,
      memberName: loan.member.user.name,
      branchName: loan.branch.name,
      productName: loan.product?.name ?? "Custom Product",
      currency: loan.currency,
      appliedAmount: appliedAmt.toString(),
      approvedAmount: approvedAmt.toString(),
      disbursementDate: loan.disbursementDate ? loan.disbursementDate.toISOString() : null,
      maturityDate: loan.maturityDate ? loan.maturityDate.toISOString() : null,
      status: loan.status,
      totalPaid: totalPaid.toString(),
      outstandingBalance: totalOutstanding.toString(),
      penaltiesOutstanding: penaltyOutstanding.toString(),
      daysPastDue: delinq.daysPastDue,
    };
  });

  // Group summaries by ISO currency code
  const currencyGrouping = rows.reduce<Record<string, { currency: string; totalApplied: Prisma.Decimal; totalDisbursed: Prisma.Decimal; totalOutstanding: Prisma.Decimal; count: number }>>(
    (acc, r) => {
      const code = r.currency.toUpperCase();
      const row = acc[code] ?? {
        currency: code,
        totalApplied: new Decimal(0),
        totalDisbursed: new Decimal(0),
        totalOutstanding: new Decimal(0),
        count: 0,
      };

      row.totalApplied = row.totalApplied.add(new Decimal(r.appliedAmount));
      row.totalDisbursed = row.totalDisbursed.add(new Decimal(r.approvedAmount));
      row.totalOutstanding = row.totalOutstanding.add(new Decimal(r.outstandingBalance));
      row.count += 1;
      acc[code] = row;
      return acc;
    },
    {}
  );

  const summaries = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    totalApplied: c.totalApplied.toString(),
    totalDisbursed: c.totalDisbursed.toString(),
    totalOutstanding: c.totalOutstanding.toString(),
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
      dateBasis: params.dateField || "APPLICATION_DATE",
      generatedAt: new Date().toISOString(),
    },
  };
}

export type LoanAgingParams = {
  branchId?: string;
  currency?: string;
  agingBucket?: "ALL" | "1-30" | "31-60" | "61-90" | "90+";
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getLoanAgingReport(params: LoanAgingParams, authorizedBranchIds?: string[]) {
  const branchIds = await resolveAuthorizedBranchIds(params.branchId, authorizedBranchIds);

  const where: Prisma.LoanWhereInput = {
    branchId: { in: branchIds },
    status: "ACTIVE",
  };

  if (params.currency && params.currency !== "ALL") {
    where.currency = params.currency.toUpperCase();
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { loanNumber: { contains: q, mode: "insensitive" } },
      { member: { memberNumber: { contains: q, mode: "insensitive" } } },
      { member: { user: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  // Batch-fetch all active loans to prevent N+1 query loops
  const activeLoans = await prisma.loan.findMany({
    where,
    include: {
      member: { include: { user: true } },
      branch: true,
      repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const allDelinqRows = [];

  for (const loan of activeLoans) {
    const delinq = calculateLoanDelinquencySummary(
      { id: loan.id, loanNumber: loan.loanNumber, status: loan.status, currency: loan.currency },
      loan.repaymentSchedules,
      now
    );

    if (delinq.isDelinquent) {
      if (params.agingBucket && params.agingBucket !== "ALL" && delinq.agingBucket !== params.agingBucket) {
        continue;
      }

      let totalOutstanding = new Decimal(0);
      for (const s of loan.repaymentSchedules) {
        const rem = s.principalDue
          .sub(s.principalPaid)
          .add(s.interestDue.sub(s.interestPaid))
          .add(s.feeDue.sub(s.feePaid))
          .add(s.penaltyDue.sub(s.penaltyPaid));
        totalOutstanding = totalOutstanding.add(rem);
      }

      allDelinqRows.push({
        id: loan.id,
        loanNumber: loan.loanNumber,
        memberNumber: loan.member.memberNumber,
        memberName: loan.member.user.name,
        branchName: loan.branch.name,
        currency: loan.currency,
        oldestDueDate: delinq.oldestDueDate ? delinq.oldestDueDate.toISOString() : null,
        daysPastDue: delinq.daysPastDue,
        agingBucket: delinq.agingBucket,
        overduePrincipal: delinq.overduePrincipal.toString(),
        overdueInterest: delinq.overdueInterest.toString(),
        overdueFees: delinq.overdueFees.toString(),
        overduePenalties: delinq.overduePenalties.toString(),
        totalOverdue: delinq.totalOverdueAmount.toString(),
        outstandingBalance: totalOutstanding.toString(),
      });
    }
  }

  // Group summary by ISO currency code
  const currencyGrouping = allDelinqRows.reduce<Record<string, { currency: string; totalOverdue: Prisma.Decimal; count: number }>>(
    (acc, r) => {
      const code = r.currency.toUpperCase();
      const row = acc[code] ?? { currency: code, totalOverdue: new Decimal(0), count: 0 };
      row.totalOverdue = row.totalOverdue.add(new Decimal(r.totalOverdue));
      row.count += 1;
      acc[code] = row;
      return acc;
    },
    {}
  );

  const summaries = Object.values(currencyGrouping).map((c) => ({
    currency: c.currency,
    totalOverdue: c.totalOverdue.toString(),
    count: c.count,
  }));

  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const totalRows = allDelinqRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = allDelinqRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    filters: params,
    rows: paginatedRows,
    summaries,
    pagination: { page, pageSize, totalRows, totalPages },
    metadata: {
      readOnlyGuarantee: "Delinquency calculated purely in GET request without state mutation",
      generatedAt: new Date().toISOString(),
    },
  };
}
