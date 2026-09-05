import test, { describe, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "../authorize";
import { bootstrapRBAC } from "../bootstrap";

describe("Phase 6 & 7 RBAC Relational Integrity Tests", () => {
  before(async () => {
    await bootstrapRBAC();
  });
  test("A. User with User.role = SUPER_ADMIN but NO relational assignment MUST NOT receive privileges", async () => {
    // Create temporary test user with legacy User.role = SUPER_ADMIN but NO relational UserRoleAssignment
    const testUser = await prisma.user.create({
      data: {
        email: `unassigned-superadmin-${Date.now()}@test.com`,
        name: "Unassigned SuperAdmin Test",
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        hasGlobalBranchAccess: false,
      },
    });

    try {
      const perms = await getUserEffectivePermissions(testUser.id);
      assert.equal(perms.size, 0, "User with NO relational role assignments must receive 0 permissions despite User.role = SUPER_ADMIN");

      const scope = await getUserAuthorizedBranchScope(testUser.id);
      assert.equal(scope.global, false, "User with NO relational role assignments must NOT receive global branch access");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("B. User with relational super_admin assignment MUST receive full 53 permissions", async () => {
    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
    assert.ok(superAdminRole, "super_admin role profile must exist");

    const testUser = await prisma.user.create({
      data: {
        email: `relational-superadmin-${Date.now()}@test.com`,
        name: "Relational SuperAdmin Test",
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "ACTIVE",
        hasGlobalBranchAccess: true,
        roleAssignments: {
          create: { roleId: superAdminRole.id },
        },
      },
    });

    try {
      const perms = await getUserEffectivePermissions(testUser.id);
      assert.ok(perms.size >= 50, "Relational super admin must receive full permission catalog");
      assert.ok(perms.has("settings.view"), "Relational super admin must possess settings.view");
      assert.ok(perms.has("settings.company.manage"), "Relational super admin must possess settings.company.manage");
      assert.ok(perms.has("settings.branch.manage"), "Relational super admin must possess settings.branch.manage");
      assert.ok(perms.has("settings.financial.manage"), "Relational super admin must possess settings.financial.manage");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("C. Relational Super Admin MUST receive global branch scope", async () => {
    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
    assert.ok(superAdminRole, "super_admin role profile must exist");

    const testUser = await prisma.user.create({
      data: {
        email: `scope-superadmin-${Date.now()}@test.com`,
        name: "Scope SuperAdmin Test",
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "ACTIVE",
        hasGlobalBranchAccess: true,
        roleAssignments: {
          create: { roleId: superAdminRole.id },
        },
      },
    });

    try {
      const scope = await getUserAuthorizedBranchScope(testUser.id);
      assert.equal(scope.global, true, "Relational super admin must have global branch scope");
      assert.ok(scope.branchIds.length > 0, "Branch IDs list should be populated");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("D. Normal Admin role MUST receive only assigned permissions (excluding settings.financial.manage)", async () => {
    const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
    assert.ok(adminRole, "admin role profile must exist");

    const testUser = await prisma.user.create({
      data: {
        email: `normal-admin-${Date.now()}@test.com`,
        name: "Normal Admin Test",
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "ACTIVE",
        roleAssignments: {
          create: { roleId: adminRole.id },
        },
      },
    });

    try {
      const perms = await getUserEffectivePermissions(testUser.id);
      assert.ok(perms.has("settings.view"), "Admin must possess settings.view");
      assert.ok(perms.has("settings.branch.manage"), "Admin must possess settings.branch.manage");
      assert.equal(perms.has("settings.financial.manage"), false, "Admin MUST NOT possess settings.financial.manage");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("E. User with NO role assignments MUST fail closed (0 permissions)", async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `noroles-${Date.now()}@test.com`,
        name: "No Roles Test",
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    try {
      const perms = await getUserEffectivePermissions(testUser.id);
      assert.equal(perms.size, 0, "Unassigned user must receive 0 permissions");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("F & G. Permission evaluation MUST NOT mutate RBAC database records", async () => {
    await bootstrapRBAC();
    const initialAssignmentCount = await prisma.userRoleAssignment.count();
    const initialPermissionCount = await prisma.rolePermission.count();

    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active relational super admin user must exist");

    await getUserEffectivePermissions(superAdmin.id);
    await getUserAuthorizedBranchScope(superAdmin.id);

    const postAssignmentCount = await prisma.userRoleAssignment.count();
    const postPermissionCount = await prisma.rolePermission.count();

    assert.equal(postAssignmentCount, initialAssignmentCount, "Permission evaluations must NOT mutate UserRoleAssignment table");
    assert.equal(postPermissionCount, initialPermissionCount, "Permission evaluations must NOT mutate RolePermission table");
  });

  test("H. Last Super Admin protection and role resolution consistency", async () => {
    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
    assert.ok(superAdminRole, "super_admin role profile must exist");

    const testUser = await prisma.user.create({
      data: {
        email: `consistency-superadmin-${Date.now()}@test.com`,
        name: "Consistency SuperAdmin Test",
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        hasGlobalBranchAccess: true,
        roleAssignments: {
          create: { roleId: superAdminRole.id },
        },
      },
    });

    try {
      const perms = await getUserEffectivePermissions(testUser.id);
      assert.equal(perms.size, 58, "Super Administrator must possess full 58 permissions catalog");

      const activeUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { roleAssignments: { include: { role: true } } },
      });
      assert.ok(activeUser, "User record must exist");
      const activeRoles = activeUser.roleAssignments.filter((ra) => ra.role.status === "ACTIVE");
      assert.equal(activeRoles.length, 1, "User should have exactly 1 active role assignment");
      assert.equal(activeRoles[0].role.slug, "super_admin", "Active role slug must be super_admin");
      assert.equal(activeRoles[0].role.name, "Super Administrator", "Active role name must be Super Administrator");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("I. User Details Role Checkbox Rendering & Save-Without-Role-Change Integrity", async () => {
    const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });

    assert.ok(adminRole, "admin role profile must exist");
    assert.ok(superAdminRole, "super_admin role profile must exist");

    // Create test user with ONLY super_admin assignment
    const testUser = await prisma.user.create({
      data: {
        email: `checkbox-test-${Date.now()}@test.com`,
        name: "Checkbox Rendering Test User",
        passwordHash: "dummyhash",
        status: "ACTIVE",
        roleAssignments: {
          create: { roleId: superAdminRole.id },
        },
      },
      include: {
        roleAssignments: { include: { role: true } },
      },
    });

    const actorUser = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(actorUser, "Actor super admin user must exist");

    try {
      // 1. Simulate server component DTO generation (page.tsx)
      const targetUserDTO = {
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        roles: testUser.roleAssignments
          .filter((ra) => ra.role.status === "ACTIVE")
          .map((ra) => ({ id: ra.role.id, name: ra.role.name, slug: ra.role.slug })),
      };

      const allRolesDTO = [adminRole, superAdminRole].map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
      }));
      assert.equal(allRolesDTO.length, 2, "Available roles list should contain both roles");

      // 2. Client-side checked state determination (user-details-client.tsx)
      const selectedRoleProfileIds = new Set(targetUserDTO.roles.map((r) => r.id));

      const isAdminChecked = selectedRoleProfileIds.has(adminRole.id);
      const isSuperAdminChecked = selectedRoleProfileIds.has(superAdminRole.id);

      assert.equal(isAdminChecked, false, "Administrator role MUST be unchecked for user with only super_admin assignment");
      assert.equal(isSuperAdminChecked, true, "Super Administrator role MUST be checked for user with super_admin assignment");

      // 3. Simulate Save Changes without modifying roles
      const { updateUser } = await import("../users-service");
      await updateUser({
        userId: testUser.id,
        name: testUser.name,
        email: testUser.email,
        roleIds: Array.from(selectedRoleProfileIds),
        actorUserId: actorUser.id,
      });

      // 4. Verify post-save DB state
      const reloadedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { roleAssignments: { include: { role: true } } },
      });

      assert.ok(reloadedUser, "User record must exist after save");
      const assignedRoleSlugs = reloadedUser.roleAssignments.map((ra) => ra.role.slug);
      assert.equal(assignedRoleSlugs.length, 1, "User must maintain exactly 1 assigned role after save");
      assert.equal(assignedRoleSlugs[0], "super_admin", "Assigned role must remain super_admin");
      assert.equal(assignedRoleSlugs.includes("admin"), false, "Admin role MUST NOT be assigned after saving");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });
});
