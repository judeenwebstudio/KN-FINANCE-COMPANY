"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma, type RepaymentScheduleStatus } from "@/generated/prisma/client";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { debitAccount, creditAccount } from "@/lib/accounts/service";
import { calculateRepaymentAllocation } from "@/lib/loans/repayment";
import { determineScheduleStatus } from "@/lib/loans/balance";
import { serializeLoanRepayment, type LoanRepaymentDTO } from "@/lib/serializers";

export type RepaymentActionState = {
  success?: boolean;
  error?: string;
  data?: LoanRepaymentDTO;
};

function generateRepaymentNumber(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `REPAY-${year}${month}${day}-${randomSuffix}`;
}

export async function previewRepaymentAllocationAction(loanId: string, amountInput: number) {
  await requirePermission("loans.repay");

  if (!amountInput || amountInput <= 0) {
    return { error: "Please enter a valid payment amount greater than 0" };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { repaymentSchedules: { orderBy: { installmentNumber: "asc" } } },
  });

  if (!loan) return { error: "Loan not found" };
  if (loan.status !== "ACTIVE") {
    return { error: `Repayments can only be accepted for ACTIVE loans (current status: ${loan.status})` };
  }

  try {
    const allocation = calculateRepaymentAllocation(loan.repaymentSchedules, amountInput);
    return {
      success: true,
      allocation: {
        totalAmount: allocation.totalAmount.toString(),
        penaltyAmount: allocation.penaltyAmount.toString(),
        feeAmount: allocation.feeAmount.toString(),
        interestAmount: allocation.interestAmount.toString(),
        principalAmount: allocation.principalAmount.toString(),
        totalOutstandingBefore: allocation.totalOutstandingBefore.toString(),
        totalOutstandingAfter: allocation.totalOutstandingAfter.toString(),
        isFullPayoff: allocation.isFullPayoff,
        allocations: allocation.allocations.map((a) => ({
          installmentNumber: a.installmentNumber,
          penaltyAllocated: a.penaltyAllocated.toString(),
          feeAllocated: a.feeAllocated.toString(),
          interestAllocated: a.interestAllocated.toString(),
          principalAllocated: a.principalAllocated.toString(),
          totalAllocated: a.totalAllocated.toString(),
          newStatus: a.newStatus,
        })),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to calculate allocation" };
  }
}

export async function recordLoanRepaymentAction(
  loanId: string,
  accountId: string,
  amountInput: number,
  notes?: string
): Promise<RepaymentActionState> {
  const admin = await requirePermission("loans.repay");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!amountInput || amountInput <= 0) {
    return { error: "Please enter a valid payment amount greater than 0" };
  }

  try {
    const repayment = await prisma.$transaction(async (tx) => {
      // 1. Re-fetch loan inside transaction to prevent race conditions
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: {
          repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
          member: true,
        },
      });

      if (!loan) throw new Error("Loan not found");

      // Branch check
      if (!accessibleBranchIds.includes(loan.branchId)) {
        throw new Error("You are not authorized to record repayments for this branch");
      }

      if (loan.status !== "ACTIVE") {
        throw new Error(`Repayment rejected. Loan is not ACTIVE (current status: ${loan.status})`);
      }

      // 2. Debit member account with strict concurrency & balance verification
      const debitResult = await debitAccount(tx, {
        accountId,
        memberId: loan.memberId,
        branchId: loan.branchId,
        amount: amountInput,
        currency: loan.currency,
        type: "LOAN_REPAYMENT",
        description: `Loan repayment for ${loan.loanNumber}`,
        referencePrefix: "REPAY",
      });

      // 3. Authoritative server-side allocation calculation
      const allocation = calculateRepaymentAllocation(loan.repaymentSchedules, amountInput);

      // 4. Create LoanRepayment record
      const repaymentNumber = generateRepaymentNumber();
      const createdRepayment = await tx.loanRepayment.create({
        data: {
          repaymentNumber,
          loanId: loan.id,
          accountId,
          memberId: loan.memberId,
          amount: allocation.totalAmount,
          principalAmount: allocation.principalAmount,
          interestAmount: allocation.interestAmount,
          feeAmount: allocation.feeAmount,
          penaltyAmount: allocation.penaltyAmount,
          paymentDate: new Date(),
          status: "POSTED",
          transactionId: debitResult.transaction.id,
          reference: debitResult.transaction.reference,
          notes: notes || null,
          createdById: admin.id,
        },
      });

      // 5. Create explicit LoanRepaymentAllocation ledger records and update schedule rows
      for (const item of allocation.allocations) {
        await tx.loanRepaymentAllocation.create({
          data: {
            repaymentId: createdRepayment.id,
            scheduleId: item.scheduleId,
            penaltyAmount: item.penaltyAllocated,
            feeAmount: item.feeAllocated,
            interestAmount: item.interestAllocated,
            principalAmount: item.principalAllocated,
            totalAmount: item.totalAllocated,
          },
        });

        await tx.loanRepaymentSchedule.update({
          where: { id: item.scheduleId },
          data: {
            penaltyPaid: item.newPenaltyPaid,
            feePaid: item.newFeePaid,
            interestPaid: item.newInterestPaid,
            principalPaid: item.newPrincipalPaid,
            totalPaid: item.newTotalPaid,
            status: item.newStatus as RepaymentScheduleStatus,
            paidAt: item.paidAt,
          },
        });
      }

      // 6. Update Loan paidAmount and check completion
      const updatedPaidAmount = Prisma.Decimal.add(loan.paidAmount, allocation.principalAmount);
      const isCompleted = allocation.isFullPayoff;

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          paidAmount: updatedPaidAmount,
          status: isCompleted ? "COMPLETED" : "ACTIVE",
          updatedById: admin.id,
        },
      });

      return tx.loanRepayment.findUnique({
        where: { id: createdRepayment.id },
        include: {
          loan: true,
          account: true,
          member: { include: { user: true, branch: true } },
          createdBy: true,
          allocations: true,
        },
      });
    });

    revalidatePath("/admin/loan-repayments");
    revalidatePath("/admin/repayments");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${loanId}`);
    revalidatePath(`/member/loans/${loanId}`);

    return { success: true, data: serializeLoanRepayment(repayment!) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to record loan repayment" };
  }
}

export async function reverseLoanRepaymentAction(
  repaymentId: string,
  reversalReason: string
): Promise<RepaymentActionState> {
  const admin = await requirePermission("loans.reverse_repayment");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!reversalReason || !reversalReason.trim()) {
    return { error: "Reversal reason is required" };
  }

  try {
    const reversed = await prisma.$transaction(async (tx) => {
      // 1. Lock/re-fetch repayment inside transaction with allocations ledger
      const repayment = await tx.loanRepayment.findUnique({
        where: { id: repaymentId },
        include: {
          loan: { include: { repaymentSchedules: { orderBy: { installmentNumber: "asc" } } } },
          account: true,
          member: true,
          allocations: { include: { schedule: true } },
        },
      });

      if (!repayment) throw new Error("Repayment record not found");

      // Branch check
      if (!accessibleBranchIds.includes(repayment.member.branchId)) {
        throw new Error("You are not authorized to reverse repayments for this branch");
      }

      // 2. Ensure POSTED and not already reversed
      if (repayment.status !== "POSTED" || repayment.reversedAt !== null) {
        throw new Error("This repayment has already been reversed");
      }

      // 3. Restore member account balance via creditAccount
      await creditAccount(tx, {
        accountId: repayment.accountId,
        memberId: repayment.memberId,
        branchId: repayment.member.branchId,
        amount: repayment.amount,
        currency: repayment.account.currency,
        type: "ADJUSTMENT",
        description: `Reversal of repayment ${repayment.repaymentNumber}: ${reversalReason}`,
        referencePrefix: "REV",
      });

      // 4. Reverse schedule row allocations using exact LoanRepaymentAllocation ledger
      for (const alloc of repayment.allocations) {
        const s = alloc.schedule;
        const newPenPaid = Prisma.Decimal.max(0, s.penaltyPaid.sub(alloc.penaltyAmount));
        const newFeePaid = Prisma.Decimal.max(0, s.feePaid.sub(alloc.feeAmount));
        const newIPaid = Prisma.Decimal.max(0, s.interestPaid.sub(alloc.interestAmount));
        const newPPaid = Prisma.Decimal.max(0, s.principalPaid.sub(alloc.principalAmount));
        const newTotalPaid = newPenPaid.add(newFeePaid).add(newIPaid).add(newPPaid);

        const instBaseDue = s.principalDue.add(s.interestDue).add(s.feeDue);
        const newStatus = determineScheduleStatus(instBaseDue, newTotalPaid.sub(newPenPaid), s.dueDate);
        const paidAt = newTotalPaid.gte(instBaseDue.add(s.penaltyDue)) ? s.paidAt : null;

        await tx.loanRepaymentSchedule.update({
          where: { id: s.id },
          data: {
            penaltyPaid: newPenPaid,
            feePaid: newFeePaid,
            interestPaid: newIPaid,
            principalPaid: newPPaid,
            totalPaid: newTotalPaid,
            status: newStatus as RepaymentScheduleStatus,
            paidAt,
          },
        });
      }

      // 5. Decrement loan paidAmount & restore ACTIVE status if loan was COMPLETED
      const newPaidAmount = Prisma.Decimal.max(0, repayment.loan.paidAmount.sub(repayment.principalAmount));
      const shouldReopen = repayment.loan.status === "COMPLETED";

      await tx.loan.update({
        where: { id: repayment.loan.id },
        data: {
          paidAmount: newPaidAmount,
          status: shouldReopen ? "ACTIVE" : repayment.loan.status,
          updatedById: admin.id,
        },
      });

      // 6. Mark LoanRepayment REVERSED
      const updatedRepayment = await tx.loanRepayment.update({
        where: { id: repaymentId },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedById: admin.id,
          reversalReason,
        },
        include: {
          loan: true,
          account: true,
          member: { include: { user: true, branch: true } },
          createdBy: true,
          reversedBy: true,
          allocations: true,
        },
      });

      return updatedRepayment;
    });

    revalidatePath("/admin/loan-repayments");
    revalidatePath("/admin/repayments");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${reversed.loanId}`);
    revalidatePath(`/member/loans/${reversed.loanId}`);

    return { success: true, data: serializeLoanRepayment(reversed) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reverse loan repayment" };
  }
}
