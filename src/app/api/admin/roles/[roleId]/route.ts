import { NextResponse } from "next/server";
import { requirePermission, PermissionDeniedError } from "@/lib/auth/authorize";
import { updateRolePermissions, updateRoleStatus, deleteRole } from "@/lib/auth/roles-service";
import { PERMISSION_CATALOG } from "@/lib/auth/catalog";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
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
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const safeRole = {
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

    return NextResponse.json({ role: safeRole, catalog: PERMISSION_CATALOG });
  } catch (err: unknown) {
    const isDenied = err instanceof PermissionDeniedError;
    const msg = err instanceof Error ? err.message : "Failed to fetch role.";
    return NextResponse.json({ error: msg }, { status: isDenied ? 403 : 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const actor = await requirePermission("roles.update");

    const { roleId } = await params;
    const body = await req.json();

    if (body.permissionCodes !== undefined) {
      await requirePermission("roles.assign_permissions");
      await updateRolePermissions({
        roleId,
        permissionCodes: body.permissionCodes,
        actorUserId: actor.id,
      });
    }

    if (body.status !== undefined) {
      await updateRoleStatus({
        roleId,
        status: body.status,
        actorUserId: actor.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const isDenied = err instanceof PermissionDeniedError;
    const msg = err instanceof Error ? err.message : "Failed to update role.";
    return NextResponse.json({ error: msg }, { status: isDenied ? 403 : 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const actor = await requirePermission("roles.delete");

    const { roleId } = await params;

    await deleteRole(roleId, actor.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const isDenied = err instanceof PermissionDeniedError;
    const msg = err instanceof Error ? err.message : "Failed to delete role.";
    return NextResponse.json({ error: msg }, { status: isDenied ? 403 : 400 });
  }
}
