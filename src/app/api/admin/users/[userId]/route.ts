import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { requirePermission, getUserEffectivePermissions, getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { updateUser } from "@/lib/auth/users-service";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requirePermission("users.view");
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: { include: { role: true } },
        branchAccess: { include: { branch: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const effectivePermissions = Array.from(await getUserEffectivePermissions(user.id));
    const branchScope = await getUserAuthorizedBranchScope(user.id);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      hasGlobalBranchAccess: user.hasGlobalBranchAccess,
      roles: user.roleAssignments
        .filter((ra) => ra.role.status === "ACTIVE")
        .map((ra) => ({ id: ra.role.id, name: ra.role.name, slug: ra.role.slug })),
      branches: user.branchAccess.map((ba) => ({ id: ba.branch.id, name: ba.branch.name, code: ba.branch.code })),
      effectivePermissions,
      branchScope,
      createdAt: user.createdAt.toISOString(),
    };

    return NextResponse.json({ user: safeUser });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch user.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;
    const body = await req.json();

    const updated = await updateUser({
      userId,
      name: body.name,
      email: body.email,
      password: body.password,
      status: body.status,
      roleIds: body.roleIds,
      branchIds: body.branchIds,
      hasGlobalBranchAccess: body.hasGlobalBranchAccess,
      actorUserId: actor.id,
    });

    return NextResponse.json({ success: true, userId: updated.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update user.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
