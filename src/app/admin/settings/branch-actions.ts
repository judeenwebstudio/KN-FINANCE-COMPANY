"use server";

import { revalidatePath } from "next/cache";
import { getUserAuthorizedBranchScope, PermissionDeniedError, requirePermission } from "@/lib/auth/authorize";
import { createBranch, updateBranch, toggleBranchStatus, BranchInput } from "@/lib/settings/branch-service";
import { BranchStatus } from "@/generated/prisma/client";

async function requireGlobalBranchManager() {
  const sessionUser = await requirePermission("settings.branch.manage");
  const scope = await getUserAuthorizedBranchScope(sessionUser.id);
  if (!scope.global) {
    throw new PermissionDeniedError("Global branch access is required to manage the company branch directory.");
  }
  return sessionUser;
}

function toBranchActionDTO(branch: Awaited<ReturnType<typeof createBranch>>) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    email: branch.email,
    phone: branch.phone,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    country: branch.country,
    currency: branch.currency,
    status: branch.status,
  };
}

export async function createBranchAction(input: BranchInput) {
  const sessionUser = await requireGlobalBranchManager();
  const branch = await createBranch(sessionUser.id, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/branches");
  return { success: true, branch: toBranchActionDTO(branch) };
}

export async function updateBranchAction(branchId: string, input: BranchInput) {
  const sessionUser = await requireGlobalBranchManager();
  const branch = await updateBranch(sessionUser.id, branchId, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/branches");
  return { success: true, branch: toBranchActionDTO(branch) };
}

export async function toggleBranchStatusAction(branchId: string, newStatus: BranchStatus) {
  const sessionUser = await requireGlobalBranchManager();
  const branch = await toggleBranchStatus(sessionUser.id, branchId, newStatus);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/branches");
  return { success: true, branch: toBranchActionDTO(branch) };
}
