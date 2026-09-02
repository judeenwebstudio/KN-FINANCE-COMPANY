import { Prisma, PenaltyType, PenaltyFrequency, PenaltyBasis, type LoanStatus, type RepaymentScheduleStatus } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export function normalizeBusinessDate(date: Date): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function getAgingBucket(daysPastDue: number): "CURRENT" | "1-30" | "31-60" | "61-90" | "90+" {
  if (daysPastDue <= 0) return "CURRENT";
  if (daysPastDue <= 30) return "1-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

export interface AssessmentRecord {
  id?: string;
  effectiveDate: Date;
  amount: Prisma.Decimal;
  basisAmount: Prisma.Decimal;
  status: string;
}

export interface ScheduleOverdueItem {
  id: string;
  installmentNumber: number;
  dueDate: Date;
  principalDue: Prisma.Decimal;
  interestDue: Prisma.Decimal;
  feeDue: Prisma.Decimal;
  penaltyDue: Prisma.Decimal;
  totalDue: Prisma.Decimal;
  principalPaid: Prisma.Decimal;
  interestPaid: Prisma.Decimal;
  feePaid: Prisma.Decimal;
  penaltyPaid: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  overdueDays: number;
  status: RepaymentScheduleStatus;
}

export interface PenaltyRuleConfig {
  penaltyType: PenaltyType;
  penaltyFrequency: PenaltyFrequency;
  penaltyBasis: PenaltyBasis;
  gracePeriodDays: number;
  penaltyValue: Prisma.Decimal;
  maximumPenaltyAmount: Prisma.Decimal | null;
}

export function getEffectivePenaltyConfig(loan: {
  penaltyType?: string | null;
  penaltyFrequency?: string | null;
  penaltyBasis?: string | null;
  gracePeriodDays?: number | null;
  penaltyValue?: Prisma.Decimal | number | null;
  maximumPenaltyAmount?: Prisma.Decimal | number | null;
  penaltyRule?: PenaltyRuleConfig | null;
}): PenaltyRuleConfig | null {
  if (
    loan.penaltyType &&
    loan.penaltyFrequency &&
    loan.penaltyBasis &&
    loan.penaltyValue !== null &&
    loan.penaltyValue !== undefined
  ) {
    return {
      penaltyType: loan.penaltyType as PenaltyType,
      penaltyFrequency: loan.penaltyFrequency as PenaltyFrequency,
      penaltyBasis: loan.penaltyBasis as PenaltyBasis,
      gracePeriodDays: loan.gracePeriodDays ?? 0,
      penaltyValue: new Decimal(loan.penaltyValue.toString()),
      maximumPenaltyAmount: loan.maximumPenaltyAmount ? new Decimal(loan.maximumPenaltyAmount.toString()) : null,
    };
  }

  if (loan.penaltyRule) {
    return loan.penaltyRule;
  }

  return null;
}

export function calculatePenaltyForDate(
  schedule: ScheduleOverdueItem,
  rule: PenaltyRuleConfig,
  existingAssessments: AssessmentRecord[],
  assessmentDate: Date
) {
  const dateNorm = normalizeBusinessDate(assessmentDate);
  const dueNorm = normalizeBusinessDate(schedule.dueDate);

  // If fully paid, no penalties and zero overdue days
  const remainingInstallment = new Decimal(schedule.principalDue.toString())
    .sub(new Decimal(schedule.principalPaid.toString()))
    .add(new Decimal(schedule.interestDue.toString()).sub(new Decimal(schedule.interestPaid.toString())))
    .add(new Decimal(schedule.feeDue.toString()).sub(new Decimal(schedule.feePaid.toString())));

  if (remainingInstallment.lte(0)) {
    return {
      penaltyAmount: new Decimal(0),
      basisAmount: new Decimal(0),
      daysOverdue: 0,
      isOverdue: false,
      alreadyAssessed: false,
    };
  }

  const diffMs = dateNorm.getTime() - dueNorm.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= rule.gracePeriodDays) {
    return {
      penaltyAmount: new Decimal(0),
      basisAmount: new Decimal(0),
      daysOverdue: Math.max(0, diffDays),
      isOverdue: false,
      alreadyAssessed: false,
    };
  }

  const daysOverdue = diffDays;

  // Check if date was already assessed in ledger
  const alreadyOnDate = existingAssessments.find(
    (a) => a.status === "ACTIVE" && normalizeBusinessDate(a.effectiveDate).getTime() === dateNorm.getTime()
  );
  if (alreadyOnDate) {
    return {
      penaltyAmount: new Decimal(alreadyOnDate.amount.toString()),
      basisAmount: new Decimal(alreadyOnDate.basisAmount.toString()),
      daysOverdue,
      isOverdue: true,
      alreadyAssessed: true,
    };
  }

  // If ONE_TIME, check if ANY prior assessment exists
  if (rule.penaltyFrequency === "ONE_TIME") {
    const hasPrior = existingAssessments.some((a) => a.status === "ACTIVE");
    if (hasPrior) {
      return {
        penaltyAmount: new Decimal(0),
        basisAmount: new Decimal(0),
        daysOverdue,
        isOverdue: true,
        alreadyAssessed: true,
      };
    }
  }

  // Calculate basis amount
  let basisAmount = new Decimal(0);
  if (rule.penaltyBasis === "OUTSTANDING_PRINCIPAL") {
    basisAmount = Decimal.max(
      0,
      new Decimal(schedule.principalDue.toString()).sub(new Decimal(schedule.principalPaid.toString()))
    );
  } else {
    basisAmount = Decimal.max(0, remainingInstallment);
  }

  if (basisAmount.lte(0)) {
    return {
      penaltyAmount: new Decimal(0),
      basisAmount: new Decimal(0),
      daysOverdue,
      isOverdue: true,
      alreadyAssessed: false,
    };
  }

  // Calculate raw penalty for this single date event
  let rawPenalty = new Decimal(0);
  if (rule.penaltyType === "FIXED") {
    rawPenalty = new Decimal(rule.penaltyValue.toString());
  } else {
    const rate = new Decimal(rule.penaltyValue.toString()).div(100);
    rawPenalty = basisAmount.mul(rate);
  }

  // Check per-installment maximum penalty cap
  let accumulatedPenalty = new Decimal(0);
  for (const a of existingAssessments) {
    if (a.status === "ACTIVE") {
      accumulatedPenalty = accumulatedPenalty.add(new Decimal(a.amount.toString()));
    }
  }

  if (rule.maximumPenaltyAmount) {
    const maxCap = new Decimal(rule.maximumPenaltyAmount.toString());
    const remainingCap = Decimal.max(0, maxCap.sub(accumulatedPenalty));
    rawPenalty = Decimal.min(rawPenalty, remainingCap);
  }

  return {
    penaltyAmount: Decimal.max(0, rawPenalty),
    basisAmount,
    daysOverdue,
    isOverdue: true,
    alreadyAssessed: false,
  };
}

export function calculateLoanDelinquencySummary(
  loan: { id: string; loanNumber: string; status: LoanStatus; currency: string },
  schedules: ScheduleOverdueItem[],
  effectiveDate = new Date()
) {
  const dateNorm = normalizeBusinessDate(effectiveDate);

  let overduePrincipal = new Decimal(0);
  let overdueInterest = new Decimal(0);
  let overdueFees = new Decimal(0);
  let overduePenalties = new Decimal(0);
  let totalOutstandingBalance = new Decimal(0);

  let maxDaysPastDue = 0;
  let oldestDueDate: Date | null = null;
  let overdueInstallmentsCount = 0;

  const sorted = [...schedules].sort((a, b) => a.installmentNumber - b.installmentNumber);

  for (const s of sorted) {
    const pRem = Decimal.max(0, new Decimal(s.principalDue.toString()).sub(new Decimal(s.principalPaid.toString())));
    const iRem = Decimal.max(0, new Decimal(s.interestDue.toString()).sub(new Decimal(s.interestPaid.toString())));
    const fRem = Decimal.max(0, new Decimal(s.feeDue.toString()).sub(new Decimal(s.feePaid.toString())));
    const penRem = Decimal.max(0, new Decimal(s.penaltyDue.toString()).sub(new Decimal(s.penaltyPaid.toString())));

    const instTotalRem = pRem.add(iRem).add(fRem).add(penRem);
    totalOutstandingBalance = totalOutstandingBalance.add(instTotalRem);

    const dueNorm = normalizeBusinessDate(s.dueDate);
    const isPastDue = dateNorm.getTime() > dueNorm.getTime();

    if (isPastDue && instTotalRem.gt(0)) {
      overduePrincipal = overduePrincipal.add(pRem);
      overdueInterest = overdueInterest.add(iRem);
      overdueFees = overdueFees.add(fRem);
      overduePenalties = overduePenalties.add(penRem);

      overdueInstallmentsCount++;
      if (!oldestDueDate) oldestDueDate = s.dueDate;

      const diffDays = Math.floor((dateNorm.getTime() - dueNorm.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > maxDaysPastDue) maxDaysPastDue = diffDays;
    }
  }

  const totalOverdueAmount = overduePrincipal.add(overdueInterest).add(overdueFees).add(overduePenalties);
  const agingBucket = getAgingBucket(maxDaysPastDue);

  return {
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    status: loan.status,
    currency: loan.currency,
    totalOverdueAmount,
    overduePrincipal,
    overdueInterest,
    overdueFees,
    overduePenalties,
    oldestDueDate,
    daysPastDue: maxDaysPastDue,
    overdueInstallmentsCount,
    totalOutstandingBalance,
    agingBucket,
    isDelinquent: totalOverdueAmount.gt(0),
  };
}

export async function refreshLoanOverdueStateInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  effectiveDate = new Date()
) {
  const effDateNorm = normalizeBusinessDate(effectiveDate);

  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    include: {
      repaymentSchedules: {
        orderBy: { installmentNumber: "asc" },
        include: { penaltyAssessments: { where: { status: "ACTIVE" } } },
      },
      penaltyRule: true,
    },
  });

  if (!loan) throw new Error("Loan not found");

  if (loan.status !== "ACTIVE") {
    return { refreshed: false, reason: `Loan is not ACTIVE (status: ${loan.status})` };
  }

  const rule = getEffectivePenaltyConfig(loan);

  for (const s of loan.repaymentSchedules) {
    const dueNorm = normalizeBusinessDate(s.dueDate);
    const existingAssessments: AssessmentRecord[] = s.penaltyAssessments.map((a) => ({
      id: a.id,
      effectiveDate: a.effectiveDate,
      amount: a.amount,
      basisAmount: a.basisAmount,
      status: a.status,
    }));

    let currentOverdueDays = 0;
    let isScheduleOverdue = false;

    if (rule && effDateNorm.getTime() > dueNorm.getTime()) {
      const startLoopDate = new Date(dueNorm.getTime() + 24 * 60 * 60 * 1000);
      const currDate = new Date(startLoopDate.getTime());

      while (currDate.getTime() <= effDateNorm.getTime()) {
        const evalRes = calculatePenaltyForDate(
          {
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
          },
          rule,
          existingAssessments,
          currDate
        );

        if (evalRes.isOverdue) {
          isScheduleOverdue = true;
          currentOverdueDays = evalRes.daysOverdue;
        }

        if (!evalRes.alreadyAssessed && evalRes.penaltyAmount.gt(0)) {
          const newAssessment = await tx.loanPenaltyAssessment.create({
            data: {
              loanId: loan.id,
              scheduleId: s.id,
              ruleId: rule.penaltyType ? loan.penaltyRuleId : null,
              effectiveDate: normalizeBusinessDate(currDate),
              amount: evalRes.penaltyAmount,
              basisAmount: evalRes.basisAmount,
              status: "ACTIVE",
            },
          });
          existingAssessments.push({
            id: newAssessment.id,
            effectiveDate: newAssessment.effectiveDate,
            amount: newAssessment.amount,
            basisAmount: newAssessment.basisAmount,
            status: newAssessment.status,
          });
        }

        currDate.setDate(currDate.getDate() + 1);
      }
    } else {
      const diffMs = effDateNorm.getTime() - dueNorm.getTime();
      if (diffMs > 0) {
        currentOverdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        isScheduleOverdue = true;
      }
    }

    let penaltyDueSum = new Decimal(0);
    for (const a of existingAssessments) {
      if (a.status === "ACTIVE") {
        penaltyDueSum = penaltyDueSum.add(new Decimal(a.amount.toString()));
      }
    }

    const remainingBasePayable = new Decimal(s.principalDue.toString())
      .sub(new Decimal(s.principalPaid.toString()))
      .add(new Decimal(s.interestDue.toString()).sub(new Decimal(s.interestPaid.toString())))
      .add(new Decimal(s.feeDue.toString()).sub(new Decimal(s.feePaid.toString())));

    const totalBasePaid = new Decimal(s.principalPaid.toString())
      .add(new Decimal(s.interestPaid.toString()))
      .add(new Decimal(s.feePaid.toString()));

    let newStatus: RepaymentScheduleStatus = s.status;
    if (remainingBasePayable.lte(0) && penaltyDueSum.sub(new Decimal(s.penaltyPaid.toString())).lte(0)) {
      newStatus = "PAID";
      currentOverdueDays = 0;
    } else if (totalBasePaid.gt(0)) {
      newStatus = "PARTIAL";
    } else if (isScheduleOverdue) {
      newStatus = "OVERDUE";
    } else {
      newStatus = "PENDING";
    }

    await tx.loanRepaymentSchedule.update({
      where: { id: s.id },
      data: {
        penaltyDue: penaltyDueSum,
        overdueDays: currentOverdueDays,
        status: newStatus,
        lastPenaltyCalculatedAt: effDateNorm,
      },
    });
  }

  return { refreshed: true };
}
