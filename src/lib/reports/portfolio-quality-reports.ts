import { prisma } from "@/lib/prisma";
import { calculateLoanDelinquencySummary } from "@/lib/loans/overdue";
import { normalizeDateRange, resolveAuthorizedBranchIds } from "./filters";
import { Prisma } from "@/generated/prisma/client";

export type ParSummaryByCurrency = {
  currency: string;
  totalActiveLoans: number;
  totalOutstandingPrincipal: number;
  totalOverduePrincipal: number;
  par1Amount: number;
  par1Rate: number;
  par30Amount: number;
  par30Rate: number;
  par60Amount: number;
  par60Rate: number;
  par90Amount: number;
  par90Rate: number;
};

export type AgingBucketBreakdown = {
  bucket: "Current (0 DPD)" | "1-29 DPD" | "30-59 DPD" | "60-89 DPD" | "90+ DPD";
  loanCount: number;
  outstandingPrincipal: number;
  percentageOfPortfolio: number;
};

export type CollectionPerformanceSummary = {
  currency: string;
  startDate: string;
  endDate: string;
  scheduledDueAmount: number;
  penaltyAssessedAmount: number;
  cashCollectedAmount: number;
  collectionRatePercent: number | null; // null if scheduledDue is 0
  payingBorrowersCount: number;
};

export type VintageCohortRow = {
  cohortMonth: string; // YYYY-MM
  loansOriginated: number;
  originalDisbursedPrincipal: number;
  currentOutstandingPrincipal: number;
  par30Amount: number;
  par90Amount: number;
  defaultedCount: number;
  completedCount: number;
};

export type OperationalProvisioningEstimate = {
  currency: string;
  bands: Array<{
    band: string;
    description: string;
    outstandingPrincipal: number;
    provisionPercentage: number | null;
    estimatedProvisionAmount: number | null;
  }>;
  totalEstimatedProvision: number | null;
  disclaimer: string;
};

export type PortfolioQualityReportResult = {
  asOfDate: string;
  parSummaries: ParSummaryByCurrency[];
  agingBucketsByCurrency: Record<string, AgingBucketBreakdown[]>;
  collectionPerformance: CollectionPerformanceSummary[];
  vintageCohorts: VintageCohortRow[];
  provisioningEstimates: OperationalProvisioningEstimate[];
};

/**
 * Calculates authoritative Portfolio Quality and Risk Report metrics strictly by currency code.
 */
export async function getPortfolioQualityReport(params?: {
  branchId?: string;
  productId?: string;
  currency?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}, authorizedBranchIds?: string[]): Promise<PortfolioQualityReportResult> {
  const accessibleBranchIds = await resolveAuthorizedBranchIds(params?.branchId, authorizedBranchIds);
  const targetBranchIds = params?.branchId && params.branchId !== "all"
    ? accessibleBranchIds.filter((id) => id === params.branchId)
    : accessibleBranchIds;

  const now = new Date();
  const dateRange = normalizeDateRange(params?.startDate, params?.endDate);

  // 1. Fetch active portfolio facilities (ACTIVE or DEFAULTED) with schedules & member info
  const loans = await prisma.loan.findMany({
    where: {
      branchId: { in: targetBranchIds },
      ...(params?.productId && params.productId !== "all" ? { productId: params.productId } : {}),
      ...(params?.currency && params.currency !== "all" ? { currency: params.currency.toUpperCase() } : {}),
      status: { in: ["ACTIVE", "DEFAULTED"] },
    },
    include: {
      repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
      branch: true,
      product: true,
    },
  });

  // Group active portfolio facilities by currency
  const loansByCurrency = new Map<string, typeof loans>();
  for (const loan of loans) {
    const list = loansByCurrency.get(loan.currency) || [];
    list.push(loan);
    loansByCurrency.set(loan.currency, list);
  }

  const parSummaries: ParSummaryByCurrency[] = [];
  const agingBucketsByCurrency: Record<string, AgingBucketBreakdown[]> = {};
  const provisioningEstimates: OperationalProvisioningEstimate[] = [];

  for (const [currency, currLoans] of loansByCurrency.entries()) {
    let totalOutstandingPrincipal = new Prisma.Decimal(0);
    let totalOverduePrincipal = new Prisma.Decimal(0);

    let par1Principal = new Prisma.Decimal(0);
    let par30Principal = new Prisma.Decimal(0);
    let par60Principal = new Prisma.Decimal(0);
    let par90Principal = new Prisma.Decimal(0);

    let currentLoanCount = 0;
    let currentPrincipal = new Prisma.Decimal(0);

    let bucket1_29Count = 0;
    let bucket1_29Principal = new Prisma.Decimal(0);

    let bucket30_59Count = 0;
    let bucket30_59Principal = new Prisma.Decimal(0);

    let bucket60_89Count = 0;
    let bucket60_89Principal = new Prisma.Decimal(0);

    let bucket90PlusCount = 0;
    let bucket90PlusPrincipal = new Prisma.Decimal(0);

    for (const loan of currLoans) {
      // Calculate current outstanding principal = total principal due - total principal paid
      let loanPrincipalDue = new Prisma.Decimal(0);
      let loanPrincipalPaid = new Prisma.Decimal(0);
      let loanOverduePrincipal = new Prisma.Decimal(0);

      const mappedSchedules = loan.repaymentSchedules.map((s) => {
        loanPrincipalDue = loanPrincipalDue.add(s.principalDue);
        loanPrincipalPaid = loanPrincipalPaid.add(s.principalPaid);

        if (s.dueDate < now && s.status !== "PAID") {
          const remPrincipal = s.principalDue.sub(s.principalPaid);
          if (remPrincipal.gt(0)) {
            loanOverduePrincipal = loanOverduePrincipal.add(remPrincipal);
          }
        }

        return {
          id: s.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          principalDue: s.principalDue,
          interestDue: s.interestDue,
          feeDue: s.feeDue,
          penaltyDue: s.penaltyDue,
          totalDue: s.totalDue,
          principalPaid: s.principalPaid,
          interestPaid: s.interestPaid,
          feePaid: s.feePaid,
          penaltyPaid: s.penaltyPaid,
          totalPaid: s.totalPaid,
          overdueDays: s.overdueDays,
          status: s.status,
        };
      });

      const outstandingPrincipal = loanPrincipalDue.sub(loanPrincipalPaid);
      if (outstandingPrincipal.lte(0)) continue; // Exclude zero balance loans

      totalOutstandingPrincipal = totalOutstandingPrincipal.add(outstandingPrincipal);
      totalOverduePrincipal = totalOverduePrincipal.add(loanOverduePrincipal);

      const delinq = calculateLoanDelinquencySummary(
        { id: loan.id, loanNumber: loan.loanNumber, status: loan.status, currency: loan.currency },
        mappedSchedules,
        now
      );

      const dpd = delinq.daysPastDue;

      // PAR Cumulative Numerators
      if (dpd >= 1) par1Principal = par1Principal.add(outstandingPrincipal);
      if (dpd >= 30) par30Principal = par30Principal.add(outstandingPrincipal);
      if (dpd >= 60) par60Principal = par60Principal.add(outstandingPrincipal);
      if (dpd >= 90) par90Principal = par90Principal.add(outstandingPrincipal);

      // Mutually Exclusive Aging Buckets
      if (dpd === 0) {
        currentLoanCount++;
        currentPrincipal = currentPrincipal.add(outstandingPrincipal);
      } else if (dpd >= 1 && dpd <= 29) {
        bucket1_29Count++;
        bucket1_29Principal = bucket1_29Principal.add(outstandingPrincipal);
      } else if (dpd >= 30 && dpd <= 59) {
        bucket30_59Count++;
        bucket30_59Principal = bucket30_59Principal.add(outstandingPrincipal);
      } else if (dpd >= 60 && dpd <= 89) {
        bucket60_89Count++;
        bucket60_89Principal = bucket60_89Principal.add(outstandingPrincipal);
      } else {
        bucket90PlusCount++;
        bucket90PlusPrincipal = bucket90PlusPrincipal.add(outstandingPrincipal);
      }
    }

    const totalPortfolioNum = totalOutstandingPrincipal.toNumber();

    parSummaries.push({
      currency,
      totalActiveLoans: currLoans.length,
      totalOutstandingPrincipal: totalPortfolioNum,
      totalOverduePrincipal: totalOverduePrincipal.toNumber(),
      par1Amount: par1Principal.toNumber(),
      par1Rate: totalPortfolioNum > 0 ? Math.round((par1Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      par30Amount: par30Principal.toNumber(),
      par30Rate: totalPortfolioNum > 0 ? Math.round((par30Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      par60Amount: par60Principal.toNumber(),
      par60Rate: totalPortfolioNum > 0 ? Math.round((par60Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      par90Amount: par90Principal.toNumber(),
      par90Rate: totalPortfolioNum > 0 ? Math.round((par90Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
    });

    agingBucketsByCurrency[currency] = [
      {
        bucket: "Current (0 DPD)",
        loanCount: currentLoanCount,
        outstandingPrincipal: currentPrincipal.toNumber(),
        percentageOfPortfolio: totalPortfolioNum > 0 ? Math.round((currentPrincipal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      },
      {
        bucket: "1-29 DPD",
        loanCount: bucket1_29Count,
        outstandingPrincipal: bucket1_29Principal.toNumber(),
        percentageOfPortfolio: totalPortfolioNum > 0 ? Math.round((bucket1_29Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      },
      {
        bucket: "30-59 DPD",
        loanCount: bucket30_59Count,
        outstandingPrincipal: bucket30_59Principal.toNumber(),
        percentageOfPortfolio: totalPortfolioNum > 0 ? Math.round((bucket30_59Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      },
      {
        bucket: "60-89 DPD",
        loanCount: bucket60_89Count,
        outstandingPrincipal: bucket60_89Principal.toNumber(),
        percentageOfPortfolio: totalPortfolioNum > 0 ? Math.round((bucket60_89Principal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      },
      {
        bucket: "90+ DPD",
        loanCount: bucket90PlusCount,
        outstandingPrincipal: bucket90PlusPrincipal.toNumber(),
        percentageOfPortfolio: totalPortfolioNum > 0 ? Math.round((bucket90PlusPrincipal.toNumber() / totalPortfolioNum) * 10000) / 100 : 0,
      },
    ];

    // Operational Provisioning Exposure (Exposure bands only, percentages not configured)
    const bands = [
      { band: "Current (0 DPD)", description: "Performing loans", outstandingPrincipal: currentPrincipal.toNumber(), provisionPercentage: null, estimatedProvisionAmount: null },
      { band: "1-29 DPD", description: "Watch list exposure", outstandingPrincipal: bucket1_29Principal.toNumber(), provisionPercentage: null, estimatedProvisionAmount: null },
      { band: "30-59 DPD", description: "Substandard exposure", outstandingPrincipal: bucket30_59Principal.toNumber(), provisionPercentage: null, estimatedProvisionAmount: null },
      { band: "60-89 DPD", description: "Doubtful exposure", outstandingPrincipal: bucket60_89Principal.toNumber(), provisionPercentage: null, estimatedProvisionAmount: null },
      { band: "90+ DPD", description: "Loss / NPL exposure", outstandingPrincipal: bucket90PlusPrincipal.toNumber(), provisionPercentage: null, estimatedProvisionAmount: null },
    ];

    provisioningEstimates.push({
      currency,
      bands,
      totalEstimatedProvision: null,
      disclaimer: "Operational Provisioning Exposure — percentages not configured.",
    });
  }

  // 2. Collection Performance (Period-based)
  const scheduledInstallments = await prisma.loanRepaymentSchedule.findMany({
    where: {
      loan: { branchId: { in: targetBranchIds } },
      ...(dateRange.start || dateRange.end
        ? {
            dueDate: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lt: dateRange.end } : {}),
            },
          }
        : {}),
    },
    include: { loan: { select: { currency: true } } },
  });

  const penaltyAssessmentsInPeriod = await prisma.loanPenaltyAssessment.findMany({
    where: {
      loan: { branchId: { in: targetBranchIds } },
      status: "ACTIVE",
      ...(dateRange.start || dateRange.end
        ? {
            effectiveDate: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lt: dateRange.end } : {}),
            },
          }
        : {}),
    },
    include: { loan: { select: { currency: true } } },
  });

  const repaymentsInPeriod = await prisma.loanRepayment.findMany({
    where: {
      loan: { branchId: { in: targetBranchIds } },
      ...(dateRange.start || dateRange.end
        ? {
            paymentDate: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lt: dateRange.end } : {}),
            },
          }
        : {}),
    },
    include: { loan: { select: { currency: true } } },
  });

  const collectionByCurrency = new Map<
    string,
    { scheduledDue: Prisma.Decimal; penaltyAssessed: Prisma.Decimal; cashCollected: Prisma.Decimal; borrowers: Set<string> }
  >();

  for (const s of scheduledInstallments) {
    const curr = s.loan.currency;
    const item = collectionByCurrency.get(curr) || {
      scheduledDue: new Prisma.Decimal(0),
      penaltyAssessed: new Prisma.Decimal(0),
      cashCollected: new Prisma.Decimal(0),
      borrowers: new Set(),
    };
    // Contractual scheduled due: principalDue + interestDue + feeDue
    const contractualDue = s.principalDue.add(s.interestDue).add(s.feeDue);
    item.scheduledDue = item.scheduledDue.add(contractualDue);
    collectionByCurrency.set(curr, item);
  }

  for (const pa of penaltyAssessmentsInPeriod) {
    const curr = pa.loan.currency;
    const item = collectionByCurrency.get(curr) || {
      scheduledDue: new Prisma.Decimal(0),
      penaltyAssessed: new Prisma.Decimal(0),
      cashCollected: new Prisma.Decimal(0),
      borrowers: new Set(),
    };
    item.penaltyAssessed = item.penaltyAssessed.add(pa.amount);
    collectionByCurrency.set(curr, item);
  }

  for (const r of repaymentsInPeriod) {
    const curr = r.loan.currency;
    const item = collectionByCurrency.get(curr) || {
      scheduledDue: new Prisma.Decimal(0),
      penaltyAssessed: new Prisma.Decimal(0),
      cashCollected: new Prisma.Decimal(0),
      borrowers: new Set(),
    };
    if (r.status === "POSTED") {
      item.cashCollected = item.cashCollected.add(r.amount);
      item.borrowers.add(r.memberId);
    } else if (r.status === "REVERSED") {
      // Reversal event: subtract in period (Phase 5A event-date semantics)
      item.cashCollected = item.cashCollected.sub(r.amount);
    }
    collectionByCurrency.set(curr, item);
  }

  const collectionPerformance: CollectionPerformanceSummary[] = Array.from(collectionByCurrency.entries()).map(([curr, item]) => {
    const due = item.scheduledDue.toNumber();
    const collected = item.cashCollected.toNumber();
    const rate = due > 0 ? Math.round((collected / due) * 10000) / 100 : null;

    return {
      currency: curr,
      startDate: dateRange.start ? dateRange.start.toISOString().slice(0, 10) : "All Time",
      endDate: dateRange.end ? dateRange.end.toISOString().slice(0, 10) : now.toISOString().slice(0, 10),
      scheduledDueAmount: due,
      penaltyAssessedAmount: item.penaltyAssessed.toNumber(),
      cashCollectedAmount: collected,
      collectionRatePercent: rate,
      payingBorrowersCount: item.borrowers.size,
    };
  });

  // 3. Vintage / Cohort Analysis (Grouped by actual disbursementDate month YYYY-MM)
  const allDisbursedLoans = await prisma.loan.findMany({
    where: {
      branchId: { in: targetBranchIds },
      disbursementDate: { not: null },
    },
    include: { repaymentSchedules: true },
  });

  const cohortMap = new Map<string, {
    loansOriginated: number;
    originalPrincipal: Prisma.Decimal;
    currentPrincipal: Prisma.Decimal;
    par30Principal: Prisma.Decimal;
    par90Principal: Prisma.Decimal;
    defaultedCount: number;
    completedCount: number;
  }>();

  for (const loan of allDisbursedLoans) {
    if (!loan.disbursementDate) continue;

    const cohortMonth = loan.disbursementDate.toISOString().slice(0, 7); // YYYY-MM
    const curr = cohortMap.get(cohortMonth) || {
      loansOriginated: 0,
      originalPrincipal: new Prisma.Decimal(0),
      currentPrincipal: new Prisma.Decimal(0),
      par30Principal: new Prisma.Decimal(0),
      par90Principal: new Prisma.Decimal(0),
      defaultedCount: 0,
      completedCount: 0,
    };

    curr.loansOriginated++;
    curr.originalPrincipal = curr.originalPrincipal.add(loan.principalAmount);

    if (loan.status === "COMPLETED") {
      curr.completedCount++;
    } else if (loan.status === "DEFAULTED") {
      curr.defaultedCount++;
    }

    if (loan.status === "ACTIVE" || loan.status === "DEFAULTED") {
      let principalDue = new Prisma.Decimal(0);
      let principalPaid = new Prisma.Decimal(0);

      const mappedSchedules = loan.repaymentSchedules.map((s) => {
        principalDue = principalDue.add(s.principalDue);
        principalPaid = principalPaid.add(s.principalPaid);
        return {
          id: s.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          principalDue: s.principalDue,
          interestDue: s.interestDue,
          feeDue: s.feeDue,
          penaltyDue: s.penaltyDue,
          totalDue: s.totalDue,
          principalPaid: s.principalPaid,
          interestPaid: s.interestPaid,
          feePaid: s.feePaid,
          penaltyPaid: s.penaltyPaid,
          totalPaid: s.totalPaid,
          overdueDays: s.overdueDays,
          status: s.status,
        };
      });

      const remPrincipal = principalDue.sub(principalPaid);
      if (remPrincipal.gt(0)) {
        curr.currentPrincipal = curr.currentPrincipal.add(remPrincipal);

        const delinq = calculateLoanDelinquencySummary(
          { id: loan.id, loanNumber: loan.loanNumber, status: loan.status, currency: loan.currency },
          mappedSchedules,
          now
        );

        if (delinq.daysPastDue >= 30) curr.par30Principal = curr.par30Principal.add(remPrincipal);
        if (delinq.daysPastDue >= 90) curr.par90Principal = curr.par90Principal.add(remPrincipal);
      }
    }

    cohortMap.set(cohortMonth, curr);
  }

  const vintageCohorts: VintageCohortRow[] = Array.from(cohortMap.entries())
    .map(([cohortMonth, c]) => ({
      cohortMonth,
      loansOriginated: c.loansOriginated,
      originalDisbursedPrincipal: c.originalPrincipal.toNumber(),
      currentOutstandingPrincipal: c.currentPrincipal.toNumber(),
      par30Amount: c.par30Principal.toNumber(),
      par90Amount: c.par90Principal.toNumber(),
      defaultedCount: c.defaultedCount,
      completedCount: c.completedCount,
    }))
    .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));

  return {
    asOfDate: now.toISOString().slice(0, 10),
    parSummaries,
    agingBucketsByCurrency,
    collectionPerformance,
    vintageCohorts,
    provisioningEstimates,
  };
}
