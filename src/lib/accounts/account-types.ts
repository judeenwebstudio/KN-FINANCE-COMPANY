"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export async function createAccountTypeAction(data: {
  name: string;
  code: string;
  description?: string;
  currency?: string | null;
  minimumOpeningBalance: number;
  minimumBalance: number;
  allowDeposits: boolean;
  allowWithdrawals: boolean;
  branchId?: string | null;
}) {
  const admin = await requirePermission("accounts.create");

  if (!data.name || !data.name.trim()) return { error: "Account type name is required" };
  if (!data.code || !data.code.trim()) return { error: "Account type code is required" };

  const cleanCode = data.code.trim().toUpperCase();

  const existing = await prisma.accountTypePolicy.findUnique({ where: { code: cleanCode } });
  if (existing) return { error: `Account type code '${cleanCode}' already exists` };

  try {
    const created = await prisma.accountTypePolicy.create({
      data: {
        name: data.name.trim(),
        code: cleanCode,
        description: data.description?.trim() || null,
        currency: data.currency ? data.currency.trim().toUpperCase() : null,
        minimumOpeningBalance: new Decimal(data.minimumOpeningBalance.toString()),
        minimumBalance: new Decimal(data.minimumBalance.toString()),
        allowDeposits: data.allowDeposits,
        allowWithdrawals: data.allowWithdrawals,
        status: "ACTIVE",
        branchId: data.branchId || null,
        createdById: admin.id,
      },
    });

    revalidatePath("/admin/account-types");
    return { success: true, data: created };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create account type" };
  }
}

export async function updateAccountTypeAction(
  id: string,
  data: {
    name: string;
    description?: string;
    minimumOpeningBalance: number;
    minimumBalance: number;
    allowDeposits: boolean;
    allowWithdrawals: boolean;
    status: string;
  }
) {
  const admin = await requirePermission("accounts.update_status");

  const policy = await prisma.accountTypePolicy.findUnique({ where: { id } });
  if (!policy) return { error: "Account type not found" };

  try {
    const updated = await prisma.accountTypePolicy.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        minimumOpeningBalance: new Decimal(data.minimumOpeningBalance.toString()),
        minimumBalance: new Decimal(data.minimumBalance.toString()),
        allowDeposits: data.allowDeposits,
        allowWithdrawals: data.allowWithdrawals,
        status: data.status,
        updatedById: admin.id,
      },
    });

    revalidatePath("/admin/account-types");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update account type" };
  }
}

export async function toggleAccountTypeStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  const admin = await requirePermission("accounts.update_status");

  try {
    const updated = await prisma.accountTypePolicy.update({
      where: { id },
      data: { status, updatedById: admin.id },
    });
    revalidatePath("/admin/account-types");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to toggle status" };
  }
}
