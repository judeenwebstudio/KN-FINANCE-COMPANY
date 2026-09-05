import { notFound } from "next/navigation";
import { requirePermission, getUserEffectivePermissions, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { UserDetailsClient } from "./user-details-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UserDetailsPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requirePermission("users.view");
  const { userId } = await params;
  const scope = await getUserAuthorizedBranchScope(actor.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: { include: { role: true } },
      branchAccess: { include: { branch: true } },
    },
  });

  if (!user) {
    notFound();
  }

  const roles = await prisma.roleProfile.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const branches = await prisma.branch.findMany({
    where: !scope.global ? { id: { in: scope.branchIds } } : {},
    orderBy: { name: "asc" },
  });

  const effectivePermissions = Array.from(await getUserEffectivePermissions(user.id));

  // Build explicit primitive arrays for deterministic client initialization.
  // selectedRoleIds is a flat string[] of RoleProfile.id values — the authoritative
  // source of truth for which checkboxes must be checked on mount.
  const initialSelectedRoleIds: string[] = user.roleAssignments
    .filter((ra) => ra.role.status === "ACTIVE")
    .map((ra) => ra.role.id);

  const initialSelectedBranchIds: string[] = user.branchAccess.map((ba) => ba.branch.id);

  const targetUserDTO = {
    id: user.id,
    name: user.name ?? user.email ?? "User",
    email: user.email ?? "",
    status: user.status,
    hasGlobalBranchAccess: user.hasGlobalBranchAccess ?? false,
    effectivePermissions,
    createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
  };

  return (
    <UserDetailsClient
      key={targetUserDTO.id}
      targetUser={targetUserDTO}
      allRoles={roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description }))}
      allBranches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
      initialSelectedRoleIds={initialSelectedRoleIds}
      initialSelectedBranchIds={initialSelectedBranchIds}
    />
  );
}
