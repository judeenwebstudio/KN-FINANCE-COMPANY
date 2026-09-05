import { notFound } from "next/navigation";
import { requirePermission, getUserEffectivePermissions, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { UserDetailsClient } from "./user-details-client";

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

  const targetUserDTO = {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    hasGlobalBranchAccess: user.hasGlobalBranchAccess,
    roles: user.roleAssignments
      .filter((ra) => ra.role.status === "ACTIVE")
      .map((ra) => ({ id: ra.role.id, name: ra.role.name, slug: ra.role.slug, description: ra.role.description })),
    branches: user.branchAccess.map((ba) => ({ id: ba.branch.id, name: ba.branch.name, code: ba.branch.code })),
    effectivePermissions,
    createdAt: user.createdAt.toISOString(),
  };

  return (
    <UserDetailsClient
      targetUser={targetUserDTO}
      allRoles={roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description }))}
      allBranches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
    />
  );
}
