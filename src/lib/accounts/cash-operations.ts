"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireMember, getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { creditAccount, debitAccount } from "./service";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

function generateRequestNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${year}-${hex}`;
}

export async function recordManualDepositAction(data: {
  accountId: string;
  amount: number;
  categoryId?: string | null;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const admin = await requirePermission("accounts.deposit");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!data.amount || data.amount <= 0) return { error: "Deposit amount must be greater than 0" };

  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
    include: { member: true },
  });

  if (!account) return { error: "Account not found" };

  if (!accessibleBranchIds.includes(account.branchId)) {
    return { error: "You are not authorized to post deposits for this branch" };
  }

  // Category direction check
  if (data.categoryId) {
    const cat = await prisma.transactionCategory.findUnique({ where: { id: data.categoryId } });
    if (cat && cat.direction === "DEBIT") {
      return { error: `Category '${cat.name}' is DEBIT-only and cannot be used for a deposit.` };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return creditAccount(tx, {
        accountId: account.id,
        memberId: account.memberId,
        branchId: account.branchId,
        amount: data.amount,
        currency: account.currency,
        type: "DEPOSIT",
        description: data.notes || `Manual deposit to ${account.accountNumber}`,
        referencePrefix: "DEP",
        categoryId: data.categoryId || null,
        createdById: admin.id,
        isManualCashOperation: true,
      });
    });

    revalidatePath("/admin/deposits");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${account.id}`);
    revalidatePath("/admin/transactions");

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record deposit" };
  }
}

export async function recordManualWithdrawalAction(data: {
  accountId: string;
  amount: number;
  categoryId?: string | null;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const admin = await requirePermission("accounts.withdraw");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!data.amount || data.amount <= 0) return { error: "Withdrawal amount must be greater than 0" };

  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
    include: { member: true },
  });

  if (!account) return { error: "Account not found" };

  if (!accessibleBranchIds.includes(account.branchId)) {
    return { error: "You are not authorized to post withdrawals for this branch" };
  }

  // Category direction check
  if (data.categoryId) {
    const cat = await prisma.transactionCategory.findUnique({ where: { id: data.categoryId } });
    if (cat && cat.direction === "CREDIT") {
      return { error: `Category '${cat.name}' is CREDIT-only and cannot be used for a withdrawal.` };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return debitAccount(tx, {
        accountId: account.id,
        memberId: account.memberId,
        branchId: account.branchId,
        amount: data.amount,
        currency: account.currency,
        type: "WITHDRAWAL",
        description: data.notes || `Manual withdrawal from ${account.accountNumber}`,
        referencePrefix: "WDR",
        categoryId: data.categoryId || null,
        createdById: admin.id,
        isManualCashOperation: true,
      });
    });

    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${account.id}`);
    revalidatePath("/admin/transactions");

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record withdrawal" };
  }
}

export async function submitDepositRequestAction(data: {
  accountId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const user = await requireMember();
  if (!user.memberProfile) return { error: "Member profile not found" };

  if (!data.amount || data.amount <= 0) return { error: "Deposit request amount must be greater than 0" };

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, memberId: user.memberProfile.id },
  });

  if (!account) return { error: "Account not found or access denied" };
  if (account.status !== "ACTIVE") return { error: `Account ${account.accountNumber} is not ACTIVE` };

  const requestNumber = generateRequestNumber("DEP-REQ");

  try {
    const request = await prisma.depositRequest.create({
      data: {
        requestNumber,
        memberId: user.memberProfile.id,
        accountId: account.id,
        branchId: account.branchId,
        amount: new Decimal(data.amount.toString()),
        currency: account.currency,
        paymentMethod: data.paymentMethod || null,
        reference: data.reference || null,
        notes: data.notes || null,
        status: "PENDING",
        createdById: user.id,
      },
    });

    revalidatePath("/member/deposits");
    revalidatePath("/admin/deposits");
    return { success: true, data: request };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit deposit request" };
  }
}

export async function submitWithdrawalRequestAction(data: {
  accountId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const user = await requireMember();
  if (!user.memberProfile) return { error: "Member profile not found" };

  if (!data.amount || data.amount <= 0) return { error: "Withdrawal request amount must be greater than 0" };

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, memberId: user.memberProfile.id },
  });

  if (!account) return { error: "Account not found or access denied" };
  if (account.status !== "ACTIVE") return { error: `Account ${account.accountNumber} is not ACTIVE` };

  const requestNumber = generateRequestNumber("WDR-REQ");

  try {
    const request = await prisma.withdrawalRequest.create({
      data: {
        requestNumber,
        memberId: user.memberProfile.id,
        accountId: account.id,
        branchId: account.branchId,
        amount: new Decimal(data.amount.toString()),
        currency: account.currency,
        paymentMethod: data.paymentMethod || null,
        reference: data.reference || null,
        notes: data.notes || null,
        status: "PENDING",
        createdById: user.id,
      },
    });

    revalidatePath("/member/withdrawals");
    revalidatePath("/admin/withdrawals");
    return { success: true, data: request };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit withdrawal request" };
  }
}

export async function cancelPendingRequestAction(requestId: string, type: "DEPOSIT" | "WITHDRAWAL") {
  const user = await requireMember();
  if (!user.memberProfile) return { error: "Member profile not found" };

  try {
    if (type === "DEPOSIT") {
      const req = await prisma.depositRequest.findFirst({
        where: { id: requestId, memberId: user.memberProfile.id, status: "PENDING" },
      });
      if (!req) return { error: "Pending deposit request not found or already processed" };

      await prisma.depositRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });
      revalidatePath("/member/deposits");
    } else {
      const req = await prisma.withdrawalRequest.findFirst({
        where: { id: requestId, memberId: user.memberProfile.id, status: "PENDING" },
      });
      if (!req) return { error: "Pending withdrawal request not found or already processed" };

      await prisma.withdrawalRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });
      revalidatePath("/member/withdrawals");
    }
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel request" };
  }
}

export async function approveDepositRequestAction(requestId: string) {
  const admin = await requirePermission("accounts.deposit");
  const accessibleBranchIds = await getAccessibleBranchIds();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch request inside transaction with strict status guard
      const req = await tx.depositRequest.findUnique({
        where: { id: requestId },
        include: { account: true },
      });

      if (!req) throw new Error("Deposit request not found");
      if (req.status !== "PENDING" || req.approvedTransactionId !== null) {
        throw new Error(`Deposit request is no longer PENDING (current status: ${req.status})`);
      }

      if (!accessibleBranchIds.includes(req.branchId)) {
        throw new Error("You are not authorized to approve requests for this branch");
      }

      // Credit account atomically
      const creditRes = await creditAccount(tx, {
        accountId: req.accountId,
        memberId: req.memberId,
        branchId: req.branchId,
        amount: req.amount,
        currency: req.currency,
        type: "DEPOSIT",
        description: `Approved deposit request ${req.requestNumber}`,
        referencePrefix: "DEP-REQ",
        createdById: admin.id,
        isManualCashOperation: true,
      });

      // Update request status atomically
      const updatedReq = await tx.depositRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          approvedTransactionId: creditRes.transaction.id,
          approvedById: admin.id,
          approvedAt: new Date(),
        },
      });

      return { request: updatedReq, transaction: creditRes.transaction };
    });

    revalidatePath("/admin/deposits");
    revalidatePath("/admin/deposit-requests");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/transactions");

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to approve deposit request" };
  }
}

export async function rejectDepositRequestAction(requestId: string, reason: string) {
  const admin = await requirePermission("accounts.deposit");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!reason || !reason.trim()) return { error: "Rejection reason is required" };

  try {
    const req = await prisma.depositRequest.findUnique({ where: { id: requestId } });
    if (!req) return { error: "Deposit request not found" };
    if (req.status !== "PENDING") return { error: `Request is not PENDING (current status: ${req.status})` };

    if (!accessibleBranchIds.includes(req.branchId)) {
      return { error: "You are not authorized to reject requests for this branch" };
    }

    const updated = await prisma.depositRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: reason.trim(),
        rejectedById: admin.id,
        rejectedAt: new Date(),
      },
    });

    revalidatePath("/admin/deposits");
    revalidatePath("/admin/deposit-requests");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reject deposit request" };
  }
}

export async function approveWithdrawalRequestAction(requestId: string) {
  const admin = await requirePermission("accounts.withdraw");
  const accessibleBranchIds = await getAccessibleBranchIds();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch request inside transaction
      const req = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        include: { account: true },
      });

      if (!req) throw new Error("Withdrawal request not found");
      if (req.status !== "PENDING" || req.approvedTransactionId !== null) {
        throw new Error(`Withdrawal request is no longer PENDING (current status: ${req.status})`);
      }

      if (!accessibleBranchIds.includes(req.branchId)) {
        throw new Error("You are not authorized to approve requests for this branch");
      }

      // Debit account atomically
      const debitRes = await debitAccount(tx, {
        accountId: req.accountId,
        memberId: req.memberId,
        branchId: req.branchId,
        amount: req.amount,
        currency: req.currency,
        type: "WITHDRAWAL",
        description: `Approved withdrawal request ${req.requestNumber}`,
        referencePrefix: "WDR-REQ",
        createdById: admin.id,
        isManualCashOperation: true,
      });

      // Update request status atomically
      const updatedReq = await tx.withdrawalRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          approvedTransactionId: debitRes.transaction.id,
          approvedById: admin.id,
          approvedAt: new Date(),
        },
      });

      return { request: updatedReq, transaction: debitRes.transaction };
    });

    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/withdrawal-requests");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/transactions");

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to approve withdrawal request" };
  }
}

export async function rejectWithdrawalRequestAction(requestId: string, reason: string) {
  const admin = await requirePermission("accounts.withdraw");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!reason || !reason.trim()) return { error: "Rejection reason is required" };

  try {
    const req = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!req) return { error: "Withdrawal request not found" };
    if (req.status !== "PENDING") return { error: `Request is not PENDING (current status: ${req.status})` };

    if (!accessibleBranchIds.includes(req.branchId)) {
      return { error: "You are not authorized to reject requests for this branch" };
    }

    const updated = await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: reason.trim(),
        rejectedById: admin.id,
        rejectedAt: new Date(),
      },
    });

    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/withdrawal-requests");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reject withdrawal request" };
  }
}

export async function reverseFinancialTransactionAction(
  transactionId: string,
  reversalReason: string
) {
  const admin = await requirePermission("accounts.reverse_transaction");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!reversalReason || !reversalReason.trim()) {
    return { error: "Reversal reason is required" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const origTx = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { account: true, reversalOf: true, reversedByTx: true },
      });

      if (!origTx) throw new Error("Transaction record not found");

      if (!accessibleBranchIds.includes(origTx.branchId)) {
        throw new Error("You are not authorized to reverse transactions for this branch");
      }

      // SAFEGUARD RULE 6: Reject generic reversal for non-manual cash operations
      const allowedReversalTypes = ["DEPOSIT", "WITHDRAWAL"];
      if (!allowedReversalTypes.includes(origTx.type)) {
        throw new Error(
          `Generic financial reversal is restricted to DEPOSIT and WITHDRAWAL transactions. Transaction type '${origTx.type}' must use its dedicated domain reversal flow.`
        );
      }

      // SAFEGUARD RULE 5: Double reversal protection
      if (origTx.reversedAt !== null || origTx.reversedByTx !== null) {
        throw new Error("This transaction has already been reversed");
      }

      if (origTx.reversalOfId !== null) {
        throw new Error("A reversal transaction itself cannot be reversed");
      }

      if (!origTx.accountId || !origTx.account) {
        throw new Error("Transaction does not reference a valid member account");
      }

      let reversalType: "DEPOSIT_REVERSAL" | "WITHDRAWAL_REVERSAL";
      let reversalResult: Awaited<ReturnType<typeof creditAccount>>;

      if (origTx.type === "DEPOSIT") {
        reversalType = "DEPOSIT_REVERSAL";
        // Debit account to reverse original deposit
        reversalResult = await debitAccount(tx, {
          accountId: origTx.accountId,
          memberId: origTx.memberId,
          branchId: origTx.branchId,
          amount: origTx.amount,
          currency: origTx.currency,
          type: reversalType,
          description: `Reversal of deposit ${origTx.reference}: ${reversalReason.trim()}`,
          referencePrefix: "REV-DEP",
          createdById: admin.id,
          isManualCashOperation: false, // Internal administrative reversal
        });
      } else {
        reversalType = "WITHDRAWAL_REVERSAL";
        // Credit account to reverse original withdrawal
        reversalResult = await creditAccount(tx, {
          accountId: origTx.accountId,
          memberId: origTx.memberId,
          branchId: origTx.branchId,
          amount: origTx.amount,
          currency: origTx.currency,
          type: reversalType,
          description: `Reversal of withdrawal ${origTx.reference}: ${reversalReason.trim()}`,
          referencePrefix: "REV-WDR",
          createdById: admin.id,
          isManualCashOperation: false,
        });
      }

      // Link reversal transaction to original transaction via reversalOfId (unique)
      await tx.transaction.update({
        where: { id: reversalResult.transaction.id },
        data: {
          reversalOfId: origTx.id,
        },
      });

      // Mark original transaction reversed
      const updatedOrigTx = await tx.transaction.update({
        where: { id: origTx.id },
        data: {
          reversedAt: new Date(),
          reversedById: admin.id,
          reversalReason: reversalReason.trim(),
        },
      });

      return { originalTransaction: updatedOrigTx, reversalTransaction: reversalResult.transaction };
    });

    revalidatePath("/admin/transactions");
    revalidatePath("/admin/deposits");
    revalidatePath("/admin/withdrawals");
    if (result.originalTransaction.accountId) {
      revalidatePath(`/admin/accounts/${result.originalTransaction.accountId}`);
    }

    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reverse transaction" };
  }
}
