import { requirePermission } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  await requirePermission("roles.view");

  const roles = await prisma.roleProfile.findMany({
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { userAssignments: true } },
    },
    orderBy: { name: "asc" },
  });

  const safeRoles = roles.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    slug: r.slug ?? "",
    description: r.description ?? "",
    isSystem: r.isSystem ?? false,
    isSuperAdminRole: r.isSuperAdminRole ?? false,
    status: r.status,
    assignedUserCount: r._count?.userAssignments ?? 0,
    permissions: (r.rolePermissions || []).map((rp) => rp.permission?.code).filter(Boolean),
    createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
  }));

  return <RolesClient initialRoles={safeRoles} />;
}
