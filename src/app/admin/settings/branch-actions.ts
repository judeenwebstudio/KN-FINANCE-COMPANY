"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { createBranch, updateBranch, toggleBranchStatus, BranchInput } from "@/lib/settings/branch-service";
import { BranchStatus } from "@/generated/prisma/client";

export async function createBranchAction(input: BranchInput) {
  const sessionUser = await requirePermission("settings.branch.manage");
  const branch = await createBranch(sessionUser.id, input);
  revalidatePath("/admin/settings");
  return { success: true, branch };
}

export async function updateBranchAction(branchId: string, input: BranchInput) {
  const sessionUser = await requirePermission("settings.branch.manage");
  const branch = await updateBranch(sessionUser.id, branchId, input);
  revalidatePath("/admin/settings");
  return { success: true, branch };
}

export async function toggleBranchStatusAction(branchId: string, newStatus: BranchStatus) {
  const sessionUser = await requirePermission("settings.branch.manage");
  const branch = await toggleBranchStatus(sessionUser.id, branchId, newStatus);
  revalidatePath("/admin/settings");
  return { success: true, branch };
}
