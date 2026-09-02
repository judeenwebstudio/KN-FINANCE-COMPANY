import { requirePermission, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { NewUserClient } from "./new-user-client";

export default async function NewUserPage() {
  const actor = await requirePermission("users.create");
  const scope = await getUserAuthorizedBranchScope(actor.id);

  const roles = await prisma.roleProfile.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const branches = await prisma.branch.findMany({
    where: !scope.global ? { id: { in: scope.branchIds } } : {},
    orderBy: { name: "asc" },
  });

  return (
    <NewUserClient
      availableRoles={roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description }))}
      availableBranches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
    />
  );
}
