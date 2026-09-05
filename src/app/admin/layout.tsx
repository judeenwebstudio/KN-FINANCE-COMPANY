import { PortalShell } from "@/components/portal-shell";
import { requireAdmin } from "@/lib/authz";
import {
  getUserEffectivePermissions,
  getUserAuthorizedBranchScope,
  getUserPrimaryRoleName,
} from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import type { BranchDTO, PortalUserDTO } from "@/types/portal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userRecord = await requireAdmin();
  const [branchScope, permissionsSet, roleName] = await Promise.all([
    getUserAuthorizedBranchScope(userRecord.id),
    getUserEffectivePermissions(userRecord.id),
    getUserPrimaryRoleName(userRecord.id),
  ]);

  const branchRecords = await prisma.branch.findMany({
    where: { id: { in: branchScope.branchIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const displayName =
    userRecord.name && userRecord.name.trim().length > 0
      ? userRecord.name.trim()
      : userRecord.email && userRecord.email.trim().length > 0
      ? userRecord.email.trim()
      : "Admin User";

  const user: PortalUserDTO = {
    id: String(userRecord.id),
    name: displayName,
    email: String(userRecord.email ?? ""),
    role: roleName || "Member",
    permissions: Array.from(permissionsSet),
    hasGlobalBranchAccess: Boolean(branchScope.global),
  };
  const branches: BranchDTO[] = (branchRecords || []).map((branch) => ({
    id: String(branch.id),
    name: String(branch.name ?? ""),
    code: String(branch.code ?? ""),
  }));

  return <PortalShell portal="Admin" user={user} branches={branches}>{children}</PortalShell>;
}
