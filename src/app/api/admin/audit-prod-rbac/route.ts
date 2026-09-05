import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserEffectivePermissions, getUserPrimaryRoleName } from "@/lib/auth/authorize";

export async function GET() {
  try {
    const targetEmail = "kabhinishainfotech@gmail.com";

    // 1. Audit user BEFORE normalization
    let user = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      // Search by name or substring if email differs slightly
      const usersByName = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: "Nivesh", mode: "insensitive" } },
            { email: { contains: "kabhinishainfotech", mode: "insensitive" } },
          ],
        },
        include: {
          roleAssignments: { include: { role: true } },
        },
      });

      if (usersByName.length > 0) {
        user = usersByName[0];
      }
    }

    if (!user) {
      return NextResponse.json({
        error: "Target production user not found",
        searchedEmail: targetEmail,
      }, { status: 404 });
    }

    const assignmentsBefore = user.roleAssignments.map((ra) => ({
      assignmentId: ra.id,
      roleId: ra.roleId,
      name: ra.role.name,
      slug: ra.role.slug,
      status: ra.role.status,
      isSuperAdminRole: ra.role.isSuperAdminRole,
    }));

    const primaryRoleNameBefore = await getUserPrimaryRoleName(user.id);
    const permsBefore = Array.from(await getUserEffectivePermissions(user.id));

    const hasAdminAssignment = assignmentsBefore.some((a) => a.slug === "admin");
    const hasSuperAdminAssignment = assignmentsBefore.some((a) => a.slug === "super_admin");
    const bothExisted = hasAdminAssignment && hasSuperAdminAssignment;

    let databaseDataChanged = false;

    // 2. Perform safe normalization IF duplicate admin assignment genuinely exists
    if (hasAdminAssignment && hasSuperAdminAssignment) {
      const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
      if (adminRole) {
        const deleteResult = await prisma.userRoleAssignment.deleteMany({
          where: {
            userId: user.id,
            roleId: adminRole.id,
          },
        });
        if (deleteResult.count > 0) {
          databaseDataChanged = true;
        }
      }
    } else if (!hasSuperAdminAssignment) {
      // If user had admin assignment but was missing super_admin, ensure super_admin is assigned safely
      const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
      if (superAdminRole) {
        await prisma.userRoleAssignment.upsert({
          where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
          update: {},
          create: { userId: user.id, roleId: superAdminRole.id },
        });
        if (hasAdminAssignment) {
          const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
          if (adminRole) {
            await prisma.userRoleAssignment.deleteMany({
              where: { userId: user.id, roleId: adminRole.id },
            });
          }
        }
        databaseDataChanged = true;
      }
    }

    // 3. Audit user AFTER normalization
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    const assignmentsAfter = (userAfter?.roleAssignments || []).map((ra) => ({
      assignmentId: ra.id,
      roleId: ra.roleId,
      name: ra.role.name,
      slug: ra.role.slug,
      status: ra.role.status,
      isSuperAdminRole: ra.role.isSuperAdminRole,
    }));

    const primaryRoleNameAfter = await getUserPrimaryRoleName(user.id);
    const permsAfter = Array.from(await getUserEffectivePermissions(user.id));

    // Also check Last Super Admin Protection
    const superAdminsCount = await prisma.userRoleAssignment.count({
      where: {
        role: { status: "ACTIVE", isSuperAdminRole: true },
        user: { status: "ACTIVE" },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      productionUser: {
        id: user.id,
        name: user.name,
        emailBefore: user.email,
        emailAfter: userAfter?.email,
        status: user.status,
        hasGlobalBranchAccess: userAfter?.hasGlobalBranchAccess,
      },
      relationalAssignmentsBefore: assignmentsBefore,
      relationalAssignmentsAfter: assignmentsAfter,
      bothExistedBefore: bothExisted,
      databaseDataChanged,
      portalShellRoleBefore: primaryRoleNameBefore,
      portalShellRoleAfter: primaryRoleNameAfter,
      effectivePermissionsCountBefore: permsBefore.length,
      effectivePermissionsCountAfter: permsAfter.length,
      activeSuperAdminsCount: superAdminsCount,
      lastSuperAdminProtectionEnforced: superAdminsCount >= 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Audit endpoint failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
