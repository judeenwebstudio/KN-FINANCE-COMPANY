import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { createRole } from "@/lib/auth/roles-service";
import { PERMISSION_CATALOG } from "@/lib/auth/catalog";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      isSuperAdminRole: r.isSuperAdminRole,
      status: r.status,
      assignedUserCount: r._count.userAssignments,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ roles: safeRoles, catalog: PERMISSION_CATALOG });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch roles.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const created = await createRole({
      name: body.name,
      slug: body.slug,
      description: body.description,
      permissionCodes: body.permissionCodes || [],
      actorUserId: actor.id,
    });

    return NextResponse.json({ success: true, roleId: created.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create role.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
