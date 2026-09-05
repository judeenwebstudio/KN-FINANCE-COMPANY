import { NextResponse } from "next/server";
import { requirePermission, getUserAuthorizedBranchScope, PermissionDeniedError } from "@/lib/auth/authorize";
import { createUser } from "@/lib/auth/users-service";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const actor = await requirePermission("users.view");
    const scope = await getUserAuthorizedBranchScope(actor.id);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const roleId = searchParams.get("roleId") || "";

    const users = await prisma.user.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
          status ? { status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" } : {},
          roleId ? { roleAssignments: { some: { roleId } } } : {},
          !scope.global ? { branchAccess: { some: { branchId: { in: scope.branchIds } } } } : {},
        ],
      },
      include: {
        roleAssignments: { include: { role: true } },
        branchAccess: { include: { branch: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const safeUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      hasGlobalBranchAccess: u.hasGlobalBranchAccess,
      roles: u.roleAssignments
        .filter((ra) => ra.role.status === "ACTIVE")
        .map((ra) => ({ id: ra.role.id, name: ra.role.name, slug: ra.role.slug })),
      branches: u.branchAccess.map((ba) => ({ id: ba.branch.id, name: ba.branch.name, code: ba.branch.code })),
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: safeUsers });
  } catch (err: unknown) {
    const isDenied = err instanceof PermissionDeniedError;
    const msg = err instanceof Error ? err.message : "Failed to fetch users.";
    return NextResponse.json({ error: msg }, { status: isDenied ? 403 : 400 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("users.create");

    const body = await req.json();

    if (body.roleIds && body.roleIds.length > 0) {
      await requirePermission("users.assign_roles");
    }
    if (body.branchIds && body.branchIds.length > 0) {
      await requirePermission("users.manage_branch_access");
    }

    const created = await createUser({
      name: body.name,
      email: body.email,
      password: body.password,
      roleIds: body.roleIds || [],
      branchIds: body.branchIds || [],
      hasGlobalBranchAccess: body.hasGlobalBranchAccess || false,
      actorUserId: actor.id,
    });

    return NextResponse.json({ success: true, userId: created.id });
  } catch (err: unknown) {
    const isDenied = err instanceof PermissionDeniedError;
    const msg = err instanceof Error ? err.message : "Failed to create user.";
    return NextResponse.json({ error: msg }, { status: isDenied ? 403 : 400 });
  }
}
