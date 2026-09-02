"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";

export async function createTransactionCategoryAction(data: {
  name: string;
  code: string;
  description?: string;
  direction: "CREDIT" | "DEBIT" | "BOTH";
}) {
  const admin = await requirePermission("accounts.create");

  if (!data.name || !data.name.trim()) return { error: "Category name is required" };
  if (!data.code || !data.code.trim()) return { error: "Category code is required" };

  const cleanCode = data.code.trim().toUpperCase();

  const existing = await prisma.transactionCategory.findUnique({ where: { code: cleanCode } });
  if (existing) return { error: `Category code '${cleanCode}' already exists` };

  try {
    const created = await prisma.transactionCategory.create({
      data: {
        name: data.name.trim(),
        code: cleanCode,
        description: data.description?.trim() || null,
        direction: data.direction,
        status: "ACTIVE",
        createdById: admin.id,
      },
    });

    revalidatePath("/admin/transaction-categories");
    return { success: true, data: created };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create category" };
  }
}

export async function updateTransactionCategoryAction(
  id: string,
  data: {
    name: string;
    description?: string;
    direction: "CREDIT" | "DEBIT" | "BOTH";
    status: string;
  }
) {
  await requirePermission("accounts.update_status");

  try {
    const updated = await prisma.transactionCategory.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        direction: data.direction,
        status: data.status,
      },
    });

    revalidatePath("/admin/transaction-categories");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update category" };
  }
}

export async function toggleTransactionCategoryStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  await requirePermission("accounts.update_status");

  try {
    const updated = await prisma.transactionCategory.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/admin/transaction-categories");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to toggle category status" };
  }
}
