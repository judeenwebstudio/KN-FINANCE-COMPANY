import { Prisma } from "@/generated/prisma/client";
import { determineScheduleStatus, type ScheduleItem } from "./balance";

const Decimal = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal | number | string;

function toDecimal(val: DecimalInput | undefined | null): Prisma.Decimal {
  if (val === undefined || val === null) return new Decimal(0);
  return new Decimal(val.toString());
}

export interface ScheduleAllocationResult {
  scheduleId: string;
  installmentNumber: number;
  penaltyAllocated: Prisma.Decimal;
  feeAllocated: Prisma.Decimal;
  interestAllocated: Prisma.Decimal;
  principalAllocated: Prisma.Decimal;
  totalAllocated: Prisma.Decimal;
  newPenaltyPaid: Prisma.Decimal;
  newFeePaid: Prisma.Decimal;
  newInterestPaid: Prisma.Decimal;
  newPrincipalPaid: Prisma.Decimal;
  newTotalPaid: Prisma.Decimal;
  newStatus: string;
  paidAt: Date | null;
}

export interface RepaymentAllocationSummary {
  totalAmount: Prisma.Decimal;
  penaltyAmount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
  interestAmount: Prisma.Decimal;
  principalAmount: Prisma.Decimal;
  totalOutstandingBefore: Prisma.Decimal;
  totalOutstandingAfter: Prisma.Decimal;
  isFullPayoff: boolean;
  allocations: ScheduleAllocationResult[];
}

export function calculateRepaymentAllocation(
  schedules: ScheduleItem[],
  paymentAmountInput: DecimalInput,
  paymentDate = new Date()
): RepaymentAllocationSummary {
  const paymentAmount = toDecimal(paymentAmountInput);

  if (paymentAmount.lte(0)) {
    throw new Error("Repayment amount must be greater than 0");
  }

  // Calculate total outstanding balance across all schedule rows (including penaltyDue)
  let totalOutstandingBefore = new Decimal(0);
  for (const s of schedules) {
    const pDue = toDecimal(s.principalDue);
    const iDue = toDecimal(s.interestDue);
    const fDue = toDecimal(s.feeDue);
    const penDue = toDecimal(s.penaltyDue);

    const pPaid = toDecimal(s.principalPaid);
    const iPaid = toDecimal(s.interestPaid);
    const fPaid = toDecimal(s.feePaid);
    const penPaid = toDecimal(s.penaltyPaid);

    const instOutstanding = Decimal.max(0, pDue.sub(pPaid))
      .add(Decimal.max(0, iDue.sub(iPaid)))
      .add(Decimal.max(0, fDue.sub(fPaid)))
      .add(Decimal.max(0, penDue.sub(penPaid)));

    totalOutstandingBefore = totalOutstandingBefore.add(instOutstanding);
  }

  if (paymentAmount.gt(totalOutstandingBefore)) {
    throw new Error(
      `Overpayment rejected. Maximum payable amount is ${totalOutstandingBefore.toString()}, but ${paymentAmount.toString()} was requested.`
    );
  }

  // Sort schedules by installmentNumber ASC (oldest unpaid first)
  const sortedSchedules = [...schedules].sort((a, b) => a.installmentNumber - b.installmentNumber);

  let remainingPayment = paymentAmount;
  let totalPenaltyAllocated = new Decimal(0);
  let totalFeeAllocated = new Decimal(0);
  let totalInterestAllocated = new Decimal(0);
  let totalPrincipalAllocated = new Decimal(0);

  const allocations: ScheduleAllocationResult[] = [];

  for (const s of sortedSchedules) {
    if (remainingPayment.lte(0)) break;

    const pDue = toDecimal(s.principalDue);
    const iDue = toDecimal(s.interestDue);
    const fDue = toDecimal(s.feeDue);
    const penDue = toDecimal(s.penaltyDue);

    const pPaid = toDecimal(s.principalPaid);
    const iPaid = toDecimal(s.interestPaid);
    const fPaid = toDecimal(s.feePaid);
    const penPaid = toDecimal(s.penaltyPaid);

    const penaltyRemaining = Decimal.max(0, penDue.sub(penPaid));
    const feeRemaining = Decimal.max(0, fDue.sub(fPaid));
    const interestRemaining = Decimal.max(0, iDue.sub(iPaid));
    const principalRemaining = Decimal.max(0, pDue.sub(pPaid));

    if (
      penaltyRemaining.isZero() &&
      feeRemaining.isZero() &&
      interestRemaining.isZero() &&
      principalRemaining.isZero()
    ) {
      continue;
    }

    // 1. Priority: Penalty Due
    const penaltyAllocated = Decimal.min(remainingPayment, penaltyRemaining);
    remainingPayment = remainingPayment.sub(penaltyAllocated);

    // 2. Priority: Fee Due
    const feeAllocated = Decimal.min(remainingPayment, feeRemaining);
    remainingPayment = remainingPayment.sub(feeAllocated);

    // 3. Priority: Interest Due
    const interestAllocated = Decimal.min(remainingPayment, interestRemaining);
    remainingPayment = remainingPayment.sub(interestAllocated);

    // 4. Priority: Principal Due
    const principalAllocated = Decimal.min(remainingPayment, principalRemaining);
    remainingPayment = remainingPayment.sub(principalAllocated);

    const totalAllocated = penaltyAllocated
      .add(feeAllocated)
      .add(interestAllocated)
      .add(principalAllocated);

    if (totalAllocated.gt(0)) {
      totalPenaltyAllocated = totalPenaltyAllocated.add(penaltyAllocated);
      totalFeeAllocated = totalFeeAllocated.add(feeAllocated);
      totalInterestAllocated = totalInterestAllocated.add(interestAllocated);
      totalPrincipalAllocated = totalPrincipalAllocated.add(principalAllocated);

      const newPenaltyPaid = penPaid.add(penaltyAllocated);
      const newFeePaid = fPaid.add(feeAllocated);
      const newInterestPaid = iPaid.add(interestAllocated);
      const newPrincipalPaid = pPaid.add(principalAllocated);
      const newTotalPaid = newPenaltyPaid.add(newFeePaid).add(newInterestPaid).add(newPrincipalPaid);

      const instBaseDue = pDue.add(iDue).add(fDue);
      const newStatus = determineScheduleStatus(instBaseDue, newTotalPaid.sub(newPenaltyPaid), s.dueDate, paymentDate);
      const paidAt = newTotalPaid.gte(instBaseDue.add(penDue)) ? (s.paidAt ?? paymentDate) : s.paidAt;

      allocations.push({
        scheduleId: s.id,
        installmentNumber: s.installmentNumber,
        penaltyAllocated,
        feeAllocated,
        interestAllocated,
        principalAllocated,
        totalAllocated,
        newPenaltyPaid,
        newFeePaid,
        newInterestPaid,
        newPrincipalPaid,
        newTotalPaid,
        newStatus,
        paidAt,
      });
    }
  }

  const totalOutstandingAfter = totalOutstandingBefore.sub(paymentAmount);
  const isFullPayoff = totalOutstandingAfter.isZero();

  return {
    totalAmount: paymentAmount,
    penaltyAmount: totalPenaltyAllocated,
    feeAmount: totalFeeAllocated,
    interestAmount: totalInterestAllocated,
    principalAmount: totalPrincipalAllocated,
    totalOutstandingBefore,
    totalOutstandingAfter,
    isFullPayoff,
    allocations,
  };
}
