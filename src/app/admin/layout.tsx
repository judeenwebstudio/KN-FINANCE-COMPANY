import { PortalShell } from "@/components/portal-shell";
import { requireAdmin } from "@/lib/authz";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import type { BranchDTO, PortalUserDTO } from "@/types/portal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userRecord = await requireAdmin();
  const [branchScope, permissionsSet] = await Promise.all([
    getUserAuthorizedBranchScope(userRecord.id),
    getUserEffectivePermissions(userRecord.id),
  ]);

  const branchRecords = await prisma.branch.findMany({
    where: { id: { in: branchScope.branchIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const user: PortalUserDTO = {
    id: String(userRecord.id),
    name: String(userRecord.name),
    email: String(userRecord.email),
    role: String(userRecord.role),
    permissions: Array.from(permissionsSet),
  };
  const branches: BranchDTO[] = branchRecords.map((branch) => ({
    id: String(branch.id),
    name: String(branch.name),
    code: String(branch.code),
  }));

  return <PortalShell portal="Admin" user={user} branches={branches}>{children}</PortalShell>;
}
