"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { loanRejectionSchema, loanDisbursementSchema } from "@/lib/validations";
import { generateRepaymentSchedule } from "@/lib/loans/calculator";
import { creditAccount } from "@/lib/accounts/service";
import { serializeLoan, type LoanDTO } from "@/lib/serializers";

export type AdminLoanActionState = {
  success?: boolean;
  error?: string;
  data?: LoanDTO;
};

export async function approveLoanAction(loanId: string): Promise<AdminLoanActionState> {
  const admin = await requirePermission("loans.approve");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "Loan application not found" };

  if (!accessibleBranchIds.includes(loan.branchId)) {
    return { error: "You are not authorized to approve loans for this branch" };
  }

  if (loan.status !== "PENDING") {
    return { error: `Only PENDING loans can be approved (current status: ${loan.status})` };
  }

  try {
    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: "APPROVED",
        approvedAmount: loan.principalAmount,
        approvalDate: new Date(),
        approvedById: admin.id,
        updatedById: admin.id,
      },
      include: { product: true, member: { include: { user: true } }, branch: true },
    });

    if (updated.member?.user?.id) {
      const { createNotification } = await import("@/lib/notifications/notification-service");
      createNotification({
        userId: updated.member.user.id,
        eventKey: "LOAN_APPROVED",
        title: "Loan Application Approved",
        message: `Your loan application ${updated.loanNumber} for $${updated.approvedAmount?.toString()} has been approved.`,
        targetUrl: `/member/loans/${updated.id}`,
      }).catch(() => {});
    }

    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${loanId}`);
    return { success: true, data: serializeLoan(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to approve loan" };
  }
}

export async function rejectLoanAction(
  loanId: string,
  rejectionReason: string
): Promise<AdminLoanActionState> {
  const admin = await requirePermission("loans.reject");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const parsed = loanRejectionSchema.safeParse({ loanId, rejectionReason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Rejection reason required" };
  }

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "Loan application not found" };

  if (!accessibleBranchIds.includes(loan.branchId)) {
    return { error: "You are not authorized to reject loans for this branch" };
  }

  if (loan.status !== "PENDING") {
    return { error: `Only PENDING loans can be rejected (current status: ${loan.status})` };
  }

  try {
    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: "REJECTED",
        rejectionReason: parsed.data.rejectionReason,
        updatedById: admin.id,
      },
      include: { product: true, member: { include: { user: true } }, branch: true },
    });

    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${loanId}`);
    return { success: true, data: serializeLoan(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reject loan" };
  }
}

export async function disburseLoanAction(
  loanId: string,
  accountId: string
): Promise<AdminLoanActionState> {
  const admin = await requirePermission("loans.disburse");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const parsed = loanDisbursementSchema.safeParse({ loanId, accountId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid disbursement parameters" };
  }

  // ATOMIC DISBURSEMENT TRANSACTION
  try {
    const updatedLoan = await prisma.$transaction(async (tx) => {
      // 1. Re-fetch loan inside transaction to prevent race conditions & double-disbursement
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { product: true, member: true },
      });

      if (!loan) throw new Error("Loan not found");

      // Branch check
      if (!accessibleBranchIds.includes(loan.branchId)) {
        throw new Error("You are not authorized to disburse loans for this branch");
      }

      // Confirm status is APPROVED and not previously disbursed
      if (loan.status !== "APPROVED") {
        throw new Error(`Loan cannot be disbursed because status is ${loan.status} (must be APPROVED)`);
      }
      if (loan.disbursementDate !== null) {
        throw new Error("Loan has already been disbursed");
      }

      // 2. Confirm destination account ownership & currency
      const account = await tx.account.findUnique({ where: { id: accountId } });
      if (!account) throw new Error("Destination account not found");
      if (account.memberId !== loan.memberId) {
        throw new Error("Destination account does not belong to the loan recipient");
      }
      if (account.status !== "ACTIVE") throw new Error("Destination account is not ACTIVE");
      if (account.currency !== loan.currency) {
        throw new Error(
          `Currency mismatch: Loan currency is ${loan.currency}, destination account is ${account.currency}`
        );
      }

      const disbursementDate = new Date();
      const approvedAmount = loan.approvedAmount ?? loan.principalAmount;

      // 3. Generate repayment schedule
      const calcResult = generateRepaymentSchedule({
        principalAmount: approvedAmount,
        annualInterestRate: loan.interestRate,
        termMonths: loan.termMonths,
        interestType: loan.interestType,
        repaymentFrequency: loan.repaymentFrequency,
        processingFee: loan.processingFee,
        startDate: disbursementDate,
      });

      // 4. Credit account balance & create LOAN_DISBURSEMENT transaction
      await creditAccount(tx, {
        accountId,
        memberId: loan.memberId,
        branchId: loan.branchId,
        amount: approvedAmount,
        currency: loan.currency,
        type: "LOAN_DISBURSEMENT",
        description: `Disbursement for Loan ${loan.loanNumber}`,
        referencePrefix: "DISB",
      });

      // 5. Insert repayment schedule rows
      await tx.loanRepaymentSchedule.createMany({
        data: calcResult.schedule.map((row) => ({
          loanId: loan.id,
          installmentNumber: row.installmentNumber,
          dueDate: row.dueDate,
          principalDue: row.principalDue,
          interestDue: row.interestDue,
          feeDue: row.feeDue,
          totalDue: row.totalDue,
          status: "PENDING",
        })),
      });

      // 6. Update loan status to ACTIVE
      const res = await tx.loan.update({
        where: { id: loan.id },
        data: {
          disbursementDate,
          maturityDate: calcResult.maturityDate,
          disbursedById: admin.id,
          updatedById: admin.id,
          status: "ACTIVE",
        },
        include: {
          product: true,
          member: { include: { user: true } },
          branch: true,
          repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
        },
      });

      return res;
    });

    if (updatedLoan.member?.user?.id) {
      const { createNotification } = await import("@/lib/notifications/notification-service");
      createNotification({
        userId: updatedLoan.member.user.id,
        eventKey: "LOAN_DISBURSED",
        title: "Loan Disbursed",
        message: `Your loan ${updatedLoan.loanNumber} has been successfully disbursed to your account.`,
        targetUrl: `/member/loans/${updatedLoan.id}`,
      }).catch(() => {});
    }

    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${loanId}`);
    return { success: true, data: serializeLoan(updatedLoan) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to disburse loan" };
  }
}
