import type { LoanStatus } from "@/generated/prisma/client";

const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ACTIVE", "CANCELLED"],
  REJECTED: [],
  ACTIVE: ["COMPLETED", "DEFAULTED"],
  COMPLETED: [],
  DEFAULTED: [],
  CANCELLED: [],
};

export function isValidLoanStatusTransition(currentStatus: LoanStatus, newStatus: LoanStatus): boolean {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(newStatus);
}

export function assertValidLoanStatusTransition(currentStatus: LoanStatus, newStatus: LoanStatus): void {
  if (!isValidLoanStatusTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid loan status transition from ${currentStatus} to ${newStatus}`);
  }
}
