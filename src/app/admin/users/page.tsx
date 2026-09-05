import { requirePermission, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage() {
  const actor = await requirePermission("users.view");
  const scope = await getUserAuthorizedBranchScope(actor.id);

  const users = await prisma.user.findMany({
    where: !scope.global ? { branchAccess: { some: { branchId: { in: scope.branchIds } } } } : {},
    include: {
      roleAssignments: { include: { role: true } },
      branchAccess: { include: { branch: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const safeUsers = users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "User",
    email: u.email ?? "",
    status: u.status,
    hasGlobalBranchAccess: u.hasGlobalBranchAccess ?? false,
    roles: (u.roleAssignments || [])
      .filter((ra) => ra?.role && ra.role.status === "ACTIVE")
      .map((ra) => ({ id: ra.role.id, name: ra.role.name ?? "", slug: ra.role.slug ?? "" })),
    branches: (u.branchAccess || []).map((ba) => ({
      id: ba.branch?.id ?? "",
      name: ba.branch?.name ?? "",
      code: ba.branch?.code ?? "",
    })),
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
  }));

  return <UsersClient initialUsers={safeUsers} />;
}
