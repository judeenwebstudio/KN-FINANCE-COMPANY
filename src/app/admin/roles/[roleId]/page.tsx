import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { RoleDetailsClient } from "./role-details-client";

export default async function RoleDetailsPage({ params }: { params: Promise<{ roleId: string }> }) {
  await requirePermission("roles.view");
  const { roleId } = await params;

  const role = await prisma.roleProfile.findUnique({
    where: { id: roleId },
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { userAssignments: true } },
    },
  });

  if (!role) {
    notFound();
  }

  const roleDTO = {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    isSuperAdminRole: role.isSuperAdminRole,
    status: role.status,
    assignedUserCount: role._count.userAssignments,
    permissions: role.rolePermissions.map((rp) => rp.permission.code),
    createdAt: role.createdAt.toISOString(),
  };

  return <RoleDetailsClient role={roleDTO} />;
}
