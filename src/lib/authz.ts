import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, include: { memberProfile: true } });
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.status !== "ACTIVE") {
    redirect("/login");
  }

  const permissions = await getUserEffectivePermissions(user.id);

  if (!permissions.has("dashboard.view")) {
    if (user.memberProfile) redirect("/member/dashboard");
    redirect("/login");
  }

  return user;
}

export async function requireMember() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") redirect("/login");
  if (!user.memberProfile) redirect("/admin/dashboard");
  return user;
}

export async function getAccessibleBranchIds(): Promise<string[]> {
  const user = await requireAdmin();
  const scope = await getUserAuthorizedBranchScope(user.id);
  return scope.branchIds;
}
