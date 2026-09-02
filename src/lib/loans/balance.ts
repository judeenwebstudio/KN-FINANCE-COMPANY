import { Prisma } from "@/generated/prisma/client";
import type { RepaymentScheduleStatus } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export interface ScheduleItem {
  id: string;
  installmentNumber: number;
  dueDate: Date;
  principalDue: Prisma.Decimal;
  interestDue: Prisma.Decimal;
  feeDue: Prisma.Decimal;
  penaltyDue?: Prisma.Decimal;
  totalDue: Prisma.Decimal;
  principalPaid: Prisma.Decimal;
  interestPaid: Prisma.Decimal;
  feePaid: Prisma.Decimal;
  penaltyPaid?: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  overdueDays?: number;
  status: RepaymentScheduleStatus;
  paidAt: Date | null;
}

export function determineScheduleStatus(
  totalDueInput: Prisma.Decimal,
  totalPaidInput: Prisma.Decimal,
  dueDate: Date,
  currentDate = new Date()
): RepaymentScheduleStatus {
  const totalDue = new Decimal(totalDueInput.toString());
  const totalPaid = new Decimal(totalPaidInput.toString());
  const remaining = totalDue.sub(totalPaid);

  if (remaining.lte(0)) {
    return "PAID";
  }

  // If partially paid, maintain PARTIAL status
  if (totalPaid.gt(0)) {
    return "PARTIAL";
  }

  // Not paid at all
  if (dueDate.getTime() < currentDate.getTime()) {
    return "OVERDUE";
  }

  return "PENDING";
}

export function calculateLoanFinancialSummary(
  principalAmountInput: Prisma.Decimal,
  totalPayableInput: Prisma.Decimal,
  schedules: ScheduleItem[]
) {
  const principalAmount = new Decimal(principalAmountInput.toString());
  let totalPayable = new Decimal(totalPayableInput.toString());

  let totalPrincipalPaid = new Decimal(0);
  let totalInterestPaid = new Decimal(0);
  let totalFeesPaid = new Decimal(0);
  let totalPenaltiesPaid = new Decimal(0);
  let totalPenaltiesDue = new Decimal(0);
  let totalPaid = new Decimal(0);

  for (const s of schedules) {
    totalPrincipalPaid = totalPrincipalPaid.add(new Decimal(s.principalPaid.toString()));
    totalInterestPaid = totalInterestPaid.add(new Decimal(s.interestPaid.toString()));
    totalFeesPaid = totalFeesPaid.add(new Decimal(s.feePaid.toString()));
    const pPaid = s.penaltyPaid ? new Decimal(s.penaltyPaid.toString()) : new Decimal(0);
    const pDue = s.penaltyDue ? new Decimal(s.penaltyDue.toString()) : new Decimal(0);
    totalPenaltiesPaid = totalPenaltiesPaid.add(pPaid);
    totalPenaltiesDue = totalPenaltiesDue.add(pDue);
    totalPaid = totalPaid.add(new Decimal(s.totalPaid.toString()));
  }

  // Add penalties due to overall payable
  totalPayable = totalPayable.add(totalPenaltiesDue);

  const remainingPrincipal = Decimal.max(0, principalAmount.sub(totalPrincipalPaid));
  const remainingPenalty = Decimal.max(0, totalPenaltiesDue.sub(totalPenaltiesPaid));
  const totalOutstanding = Decimal.max(0, totalPayable.sub(totalPaid));

  const sorted = [...schedules].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const nextUnpaid = sorted.find((s) => {
    const pDue = s.penaltyDue ? new Decimal(s.penaltyDue.toString()) : new Decimal(0);
    const totDue = new Decimal(s.totalDue.toString()).add(pDue);
    const rem = totDue.sub(new Decimal(s.totalPaid.toString()));
    return rem.gt(0);
  });

  const nextPaymentDate = nextUnpaid ? nextUnpaid.dueDate : null;
  const nextPaymentAmount = nextUnpaid
    ? new Decimal(nextUnpaid.totalDue.toString())
        .add(nextUnpaid.penaltyDue ? new Decimal(nextUnpaid.penaltyDue.toString()) : new Decimal(0))
        .sub(new Decimal(nextUnpaid.totalPaid.toString()))
    : new Decimal(0);

  return {
    totalPrincipalPaid,
    totalInterestPaid,
    totalFeesPaid,
    totalPenaltiesPaid,
    totalPenaltiesDue,
    totalPaid,
    remainingPrincipal,
    remainingPenalty,
    totalOutstanding,
    nextUnpaidInstallment: nextUnpaid ?? null,
    nextPaymentDate,
    nextPaymentAmount,
  };
}
