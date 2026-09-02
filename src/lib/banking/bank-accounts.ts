"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { Prisma } from "@/generated/prisma/client";
import type { BankAccountStatus } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export async function createBankAccountAction(input: {
  name: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName?: string | null;
  branchId: string;
  currency: string;
  openingBalance?: number;
  notes?: string | null;
}) {
  try {
    const user = await requirePermission("banking.manage_accounts");
    const branchIds = await getAccessibleBranchIds();

    if (!branchIds.includes(input.branchId)) {
      return { error: "Unauthorized: Access denied for branch" };
    }

    const openingBal = new Decimal(input.openingBalance && input.openingBalance > 0 ? input.openingBalance : 0);

    const bankAccount = await prisma.$transaction(async (tx) => {
      const created = await tx.bankAccount.create({
        data: {
          name: input.name.trim(),
          accountName: input.accountName.trim(),
          accountNumber: input.accountNumber.trim(),
          bankName: input.bankName.trim(),
          branchName: input.branchName?.trim() || null,
          branchId: input.branchId,
          currency: input.currency.toUpperCase(),
          openingBalance: openingBal,
          currentBalance: openingBal,
          status: "ACTIVE",
          notes: input.notes?.trim() || null,
          createdById: user.id,
        },
      });

      if (openingBal.gt(0)) {
        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-OPN-${Date.now()}`,
            bankAccountId: created.id,
            type: "OPENING_BALANCE",
            direction: "CREDIT",
            amount: openingBal,
            currency: input.currency.toUpperCase(),
            balanceBefore: new Decimal(0),
            balanceAfter: openingBal,
            reference: `OPN-${input.accountNumber.trim()}`,
            description: "Opening bank balance",
            createdById: user.id,
          },
        });
      }

      return created;
    });

    revalidatePath("/admin/bank-accounts");
    revalidatePath("/admin/dashboard");
    return { data: bankAccount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create bank account";
    return { error: msg };
  }
}

export async function recordManualBankDepositAction(input: {
  bankAccountId: string;
  amount: number;
  reference?: string | null;
  description?: string | null;
  idempotencyKey?: string | null;
}) {
  try {
    const user = await requirePermission("banking.post_transactions");
    const branchIds = await getAccessibleBranchIds();

    if (input.amount <= 0) return { error: "Deposit amount must be greater than zero" };

    const depAmount = new Decimal(input.amount);
    const key = input.idempotencyKey ? input.idempotencyKey.trim() : null;

    if (key) {
      const existing = await prisma.bankTransaction.findFirst({
        where: { reference: key },
      });
      if (existing) {
        return { error: "Duplicate deposit transaction request rejected (Idempotency key matched)." };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const bankAcc = await tx.bankAccount.findUnique({
        where: { id: input.bankAccountId },
      });

      if (!bankAcc) throw new Error("Bank account not found");
      if (bankAcc.status !== "ACTIVE") throw new Error("Bank account is not ACTIVE");
      if (!branchIds.includes(bankAcc.branchId)) throw new Error("Unauthorized branch access");

      const balanceBefore = bankAcc.currentBalance;
      const balanceAfter = balanceBefore.add(depAmount);

      await tx.bankAccount.update({
        where: { id: bankAcc.id },
        data: { currentBalance: balanceAfter },
      });

      const btx = await tx.bankTransaction.create({
        data: {
          bankTransactionNumber: `BTX-DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          bankAccountId: bankAcc.id,
          type: "DEPOSIT",
          direction: "CREDIT",
          amount: depAmount,
          currency: bankAcc.currency,
          balanceBefore,
          balanceAfter,
          reference: key || input.reference?.trim() || `DEP-${Date.now()}`,
          description: input.description?.trim() || "Manual external bank deposit",
          createdById: user.id,
        },
      });

      return btx;
    });

    revalidatePath("/admin/bank-accounts");
    revalidatePath(`/admin/bank-accounts/${input.bankAccountId}`);
    revalidatePath("/admin/bank-transactions");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record manual bank deposit";
    return { error: msg };
  }
}

export async function recordManualBankWithdrawalAction(input: {
  bankAccountId: string;
  amount: number;
  reference?: string | null;
  description?: string | null;
  idempotencyKey?: string | null;
}) {
  try {
    const user = await requirePermission("banking.post_transactions");
    const branchIds = await getAccessibleBranchIds();

    if (input.amount <= 0) return { error: "Withdrawal amount must be greater than zero" };

    const wdrAmount = new Decimal(input.amount);
    const key = input.idempotencyKey ? input.idempotencyKey.trim() : null;

    if (key) {
      const existing = await prisma.bankTransaction.findFirst({
        where: { reference: key },
      });
      if (existing) {
        return { error: "Duplicate withdrawal transaction request rejected (Idempotency key matched)." };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const bankAcc = await tx.bankAccount.findUnique({
        where: { id: input.bankAccountId },
      });

      if (!bankAcc) throw new Error("Bank account not found");
      if (bankAcc.status !== "ACTIVE") throw new Error("Bank account is not ACTIVE");
      if (!branchIds.includes(bankAcc.branchId)) throw new Error("Unauthorized branch access");

      const balanceBefore = bankAcc.currentBalance;
      if (balanceBefore.lt(wdrAmount)) {
        throw new Error(`Insufficient funds: Current balance is ${balanceBefore.toFixed(2)}, requested ${wdrAmount.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore.sub(wdrAmount);

      await tx.bankAccount.update({
        where: { id: bankAcc.id },
        data: { currentBalance: balanceAfter },
      });

      const btx = await tx.bankTransaction.create({
        data: {
          bankTransactionNumber: `BTX-WDR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          bankAccountId: bankAcc.id,
          type: "WITHDRAWAL",
          direction: "DEBIT",
          amount: wdrAmount,
          currency: bankAcc.currency,
          balanceBefore,
          balanceAfter,
          reference: key || input.reference?.trim() || `WDR-${Date.now()}`,
          description: input.description?.trim() || "Manual external bank withdrawal",
          createdById: user.id,
        },
      });

      return btx;
    });

    revalidatePath("/admin/bank-accounts");
    revalidatePath(`/admin/bank-accounts/${input.bankAccountId}`);
    revalidatePath("/admin/bank-transactions");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record manual bank withdrawal";
    return { error: msg };
  }
}

export async function updateBankAccountStatusAction(id: string, status: BankAccountStatus) {
  try {
    await requirePermission("banking.manage_accounts");

    const bankAcc = await prisma.bankAccount.findUnique({ where: { id } });
    if (!bankAcc) return { error: "Bank account not found" };

    if (status === "CLOSED" && !bankAcc.currentBalance.isZero()) {
      return { error: `Cannot close bank account with non-zero balance (${bankAcc.currentBalance.toString()} ${bankAcc.currency})` };
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/bank-accounts");
    revalidatePath(`/admin/bank-accounts/${id}`);
    return { data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update bank account status";
    return { error: msg };
  }
}
