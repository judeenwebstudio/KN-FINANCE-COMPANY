"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { Prisma } from "@/generated/prisma/client";
import type { ExpensePaymentSourceType } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export async function createExpenseAction(input: {
  branchId: string;
  categoryId: string;
  amount: number;
  currency: string;
  expenseDate?: string | Date;
  paymentSourceType: ExpensePaymentSourceType;
  treasuryAccountId?: string | null;
  bankAccountId?: string | null;
  reference?: string | null;
  description?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}) {
  try {
    const user = await requirePermission("expenses.create");
    const branchIds = await getAccessibleBranchIds();

    if (!branchIds.includes(input.branchId)) {
      return { error: "Unauthorized: Access denied for specified branch" };
    }

    if (input.amount <= 0) return { error: "Expense amount must be greater than zero" };

    // 1. Strict XOR Validation for payment source
    if (input.paymentSourceType === "CASH") {
      if (!input.treasuryAccountId || input.bankAccountId) {
        return { error: "Invalid payment source: CASH expense requires treasuryAccountId and bankAccountId must be null" };
      }
    } else if (input.paymentSourceType === "BANK") {
      if (!input.bankAccountId || input.treasuryAccountId) {
        return { error: "Invalid payment source: BANK expense requires bankAccountId and treasuryAccountId must be null" };
      }
    } else {
      return { error: "Invalid paymentSourceType" };
    }

    // 2. Category Scope Check
    const category = await prisma.expenseCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) return { error: "Expense category not found" };
    if (category.status !== "ACTIVE") return { error: "Expense category is INACTIVE" };
    if (category.branchId && category.branchId !== input.branchId) {
      return { error: "Expense category is restricted to a different branch" };
    }

    const expAmount = new Decimal(input.amount);
    const key = input.idempotencyKey ? input.idempotencyKey.trim() : null;

    if (key) {
      const existing = await prisma.expense.findFirst({ where: { reference: key } });
      if (existing) {
        return { error: "Duplicate expense request rejected (Idempotency key matched)." };
      }
    }

    const expenseNumber = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (input.paymentSourceType === "CASH" && input.treasuryAccountId) {
        const treasuryAcc = await tx.treasuryAccount.findUnique({
          where: { id: input.treasuryAccountId },
        });

        if (!treasuryAcc) throw new Error("Treasury account not found");
        if (treasuryAcc.status !== "ACTIVE") throw new Error("Treasury account is not ACTIVE");
        if (treasuryAcc.branchId !== input.branchId) throw new Error("Branch mismatch: Treasury account belongs to a different branch");
        if (treasuryAcc.currency !== input.currency.toUpperCase()) throw new Error("Currency mismatch with treasury account");

        const balanceBefore = treasuryAcc.balance;
        if (balanceBefore.lt(expAmount)) {
          throw new Error(`Insufficient treasury funds: Balance is ${balanceBefore.toFixed(2)}, requested ${expAmount.toFixed(2)}`);
        }

        const balanceAfter = balanceBefore.sub(expAmount);

        await tx.treasuryAccount.update({
          where: { id: treasuryAcc.id },
          data: { balance: balanceAfter },
        });

        const createdExp = await tx.expense.create({
          data: {
            expenseNumber,
            branchId: input.branchId,
            categoryId: input.categoryId,
            amount: expAmount,
            currency: input.currency.toUpperCase(),
            expenseDate,
            paymentSourceType: "CASH",
            treasuryAccountId: treasuryAcc.id,
            reference: key || input.reference?.trim() || null,
            description: input.description?.trim() || null,
            notes: input.notes?.trim() || null,
            status: "POSTED",
            createdById: user.id,
          },
        });

        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-EXP-${Date.now()}`,
            treasuryAccountId: treasuryAcc.id,
            type: "EXPENSE",
            direction: "DEBIT",
            amount: expAmount,
            currency: treasuryAcc.currency,
            balanceBefore,
            balanceAfter,
            expenseId: createdExp.id,
            reference: key || input.reference?.trim() || null,
            description: `Expense: ${category.name}`,
            createdById: user.id,
          },
        });

        return createdExp;
      } else if (input.paymentSourceType === "BANK" && input.bankAccountId) {
        const bankAcc = await tx.bankAccount.findUnique({
          where: { id: input.bankAccountId },
        });

        if (!bankAcc) throw new Error("Bank account not found");
        if (bankAcc.status !== "ACTIVE") throw new Error("Bank account is not ACTIVE");
        if (bankAcc.branchId !== input.branchId) throw new Error("Branch mismatch: Bank account belongs to a different branch");
        if (bankAcc.currency !== input.currency.toUpperCase()) throw new Error("Currency mismatch with bank account");

        const balanceBefore = bankAcc.currentBalance;
        if (balanceBefore.lt(expAmount)) {
          throw new Error(`Insufficient bank funds: Current balance is ${balanceBefore.toFixed(2)}, requested ${expAmount.toFixed(2)}`);
        }

        const balanceAfter = balanceBefore.sub(expAmount);

        await tx.bankAccount.update({
          where: { id: bankAcc.id },
          data: { currentBalance: balanceAfter },
        });

        const createdExp = await tx.expense.create({
          data: {
            expenseNumber,
            branchId: input.branchId,
            categoryId: input.categoryId,
            amount: expAmount,
            currency: input.currency.toUpperCase(),
            expenseDate,
            paymentSourceType: "BANK",
            bankAccountId: bankAcc.id,
            reference: key || input.reference?.trim() || null,
            description: input.description?.trim() || null,
            notes: input.notes?.trim() || null,
            status: "POSTED",
            createdById: user.id,
          },
        });

        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-EXP-${Date.now()}`,
            bankAccountId: bankAcc.id,
            type: "EXPENSE",
            direction: "DEBIT",
            amount: expAmount,
            currency: bankAcc.currency,
            balanceBefore,
            balanceAfter,
            expenseId: createdExp.id,
            reference: key || input.reference?.trim() || null,
            description: `Expense: ${category.name}`,
            createdById: user.id,
          },
        });

        return createdExp;
      } else {
        throw new Error("Invalid payment source parameters");
      }
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/dashboard");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to post expense";
    return { error: msg };
  }
}

export async function reverseExpenseAction(expenseId: string, reversalReason: string) {
  try {
    const user = await requirePermission("expenses.reverse");

    if (!reversalReason || !reversalReason.trim()) {
      return { error: "Reversal reason is mandatory" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id: expenseId },
        include: {
          treasuryTransactions: { where: { type: "EXPENSE", direction: "DEBIT" } },
          bankTransactions: { where: { type: "EXPENSE", direction: "DEBIT" } },
        },
      });

      if (!expense) throw new Error("Expense record not found");
      if (expense.status === "REVERSED" || expense.reversedAt !== null) {
        throw new Error("Expense has already been reversed");
      }

      if (expense.paymentSourceType === "CASH" && expense.treasuryAccountId) {
        const treasuryAcc = await tx.treasuryAccount.findUnique({
          where: { id: expense.treasuryAccountId },
        });
        if (!treasuryAcc) throw new Error("Treasury account not found for reversal");

        const origTx = expense.treasuryTransactions[0];
        const balanceBefore = treasuryAcc.balance;
        const balanceAfter = balanceBefore.add(expense.amount);

        await tx.treasuryAccount.update({
          where: { id: treasuryAcc.id },
          data: { balance: balanceAfter },
        });

        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-REV-${Date.now()}`,
            treasuryAccountId: treasuryAcc.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amount: expense.amount,
            currency: expense.currency,
            balanceBefore,
            balanceAfter,
            expenseId: expense.id,
            reversalOfId: origTx?.id || null,
            reference: `REV-${expense.expenseNumber}`,
            description: `Expense Reversal: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      } else if (expense.paymentSourceType === "BANK" && expense.bankAccountId) {
        const bankAcc = await tx.bankAccount.findUnique({
          where: { id: expense.bankAccountId },
        });
        if (!bankAcc) throw new Error("Bank account not found for reversal");

        const origTx = expense.bankTransactions[0];
        const balanceBefore = bankAcc.currentBalance;
        const balanceAfter = balanceBefore.add(expense.amount);

        await tx.bankAccount.update({
          where: { id: bankAcc.id },
          data: { currentBalance: balanceAfter },
        });

        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-REV-${Date.now()}`,
            bankAccountId: bankAcc.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amount: expense.amount,
            currency: expense.currency,
            balanceBefore,
            balanceAfter,
            expenseId: expense.id,
            reversalOfId: origTx?.id || null,
            reference: `REV-${expense.expenseNumber}`,
            description: `Expense Reversal: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      }

      const updatedExp = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedById: user.id,
          reversalReason: reversalReason.trim(),
        },
      });

      return updatedExp;
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/bank-accounts");
    revalidatePath("/admin/dashboard");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reverse expense";
    return { error: msg };
  }
}
