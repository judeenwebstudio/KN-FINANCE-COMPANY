import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserEffectivePermissions, getUserPrimaryRoleName } from "@/lib/auth/authorize";

export async function GET() {
  try {
    const targetEmail = "kabhinishainfotech@gmail.com";

    // Query user
    let user = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      const usersByName = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: "Nivesh", mode: "insensitive" } },
            { email: { contains: "kabhinishainfotech", mode: "insensitive" } },
          ],
        },
        include: { roleAssignments: { include: { role: true } } },
      });
      if (usersByName.length > 0) user = usersByName[0];
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Query all role profiles
    const allRoles = await prisma.roleProfile.findMany({
      orderBy: { name: "asc" },
    });

    const activeRoles = allRoles.filter((r) => r.status === "ACTIVE");

    // Replicate page.tsx targetUserDTO logic
    const targetUserDTO = {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      hasGlobalBranchAccess: user.hasGlobalBranchAccess,
      roles: user.roleAssignments
        .filter((ra) => ra.role.status === "ACTIVE")
        .map((ra) => ({ id: ra.role.id, name: ra.role.name, slug: ra.role.slug, description: ra.role.description })),
    };

    const selectedRoleIds = targetUserDTO.roles.map((r) => r.id);

    // Replicate user-details-client.tsx checkbox rendering logic
    const renderedCheckboxes = activeRoles.map((role) => {
      const isSelected = selectedRoleIds.includes(role.id);
      return {
        roleId: role.id,
        roleName: role.name,
        roleSlug: role.slug,
        isSuperAdminRole: role.isSuperAdminRole,
        isSelectedChecked: isSelected,
      };
    });

    const primaryRoleName = await getUserPrimaryRoleName(user.id);
    const perms = Array.from(await getUserEffectivePermissions(user.id));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      userRecord: {
        id: user.id,
        name: user.name,
        email: user.email,
        legacyRoleEnum: (user as any).role,
        status: user.status,
        hasGlobalBranchAccess: user.hasGlobalBranchAccess,
      },
      userRoleAssignmentsInDB: user.roleAssignments.map((ra) => ({
        assignmentId: ra.id,
        roleId: ra.roleId,
        roleName: ra.role.name,
        roleSlug: ra.role.slug,
        roleStatus: ra.role.status,
        isSuperAdminRole: ra.role.isSuperAdminRole,
      })),
      allRoleProfilesInDB: allRoles.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isSuperAdminRole: r.isSuperAdminRole,
        status: r.status,
      })),
      targetUserDTO_roles: targetUserDTO.roles,
      selectedRoleIds,
      renderedCheckboxes,
      getUserPrimaryRoleName_result: primaryRoleName,
      effectivePermissionsCount: perms.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Inspect failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
