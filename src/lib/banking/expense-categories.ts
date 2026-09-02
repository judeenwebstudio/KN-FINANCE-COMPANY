"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import type { ExpenseCategoryStatus } from "@/generated/prisma/client";

export async function createExpenseCategoryAction(input: {
  name: string;
  code: string;
  description?: string | null;
  branchId?: string | null;
}) {
  try {
    const user = await requirePermission("expenses.manage_categories");
    const branchIds = await getAccessibleBranchIds();

    const normalizedCode = input.code.trim().toUpperCase();
    const branchId = input.branchId && input.branchId !== "GLOBAL" ? input.branchId : null;

    if (branchId && !branchIds.includes(branchId)) {
      return { error: "Unauthorized: Access denied for specified branch" };
    }

    // Check uniqueness explicitly (handles PostgreSQL null branchId unique behavior)
    const existing = await prisma.expenseCategory.findFirst({
      where: {
        branchId: branchId,
        code: normalizedCode,
      },
    });

    if (existing) {
      return { error: `Expense Category code '${normalizedCode}' already exists for this scope.` };
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: input.name.trim(),
        code: normalizedCode,
        description: input.description?.trim() || null,
        branchId: branchId,
        createdById: user.id,
      },
      include: { branch: true },
    });

    revalidatePath("/admin/expense-categories");
    return { data: category };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create expense category";
    return { error: msg };
  }
}

export async function updateExpenseCategoryAction(
  id: string,
  input: {
    name: string;
    description?: string | null;
    status: ExpenseCategoryStatus;
  }
) {
  try {
    await requirePermission("expenses.manage_categories");

    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) return { error: "Expense category not found" };

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: input.status,
      },
      include: { branch: true },
    });

    revalidatePath("/admin/expense-categories");
    return { data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update expense category";
    return { error: msg };
  }
}

export async function toggleExpenseCategoryStatusAction(id: string, status: ExpenseCategoryStatus) {
  try {
    await requirePermission("expenses.manage_categories");
    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/admin/expense-categories");
    return { data: category };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to change category status";
    return { error: msg };
  }
}
