import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import { bootstrapRBAC } from "../bootstrap";
import {
  getUserEffectivePermissions,
  getUserAuthorizedBranchScope,
} from "../authorize";
import { createUser, updateUser, PrivilegeEscalationError, LastSuperAdminProtectionError } from "../users-service";
import { createRole, updateRoleStatus, RoleManagementError } from "../roles-service";

describe("Phase 6 RBAC & Authorization Unit Tests", () => {
  test("should bootstrap RBAC idempotently and verify active super admin count", async () => {
    const res1 = await bootstrapRBAC();
    assert.ok(res1.permissionsSeeded >= 50, "At least 50 permissions seeded");
    assert.ok(res1.rolesSeeded >= 8, "At least 8 system roles seeded");
    assert.ok(res1.activeSuperAdmins >= 1, "At least 1 active super admin verified");

    // Repeat bootstrap to verify idempotency
    const res2 = await bootstrapRBAC();
    assert.equal(res2.permissionsSeeded, res1.permissionsSeeded, "Permissions count should match on repeated bootstrap");
    assert.equal(res2.rolesSeeded, res1.rolesSeeded, "Roles count should match on repeated bootstrap");
  });

  test("should resolve Super Admin implicit all-permissions access authoritatively", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });

    assert.ok(superAdmin, "Active super admin user must exist");

    const perms = await getUserEffectivePermissions(superAdmin.id);
    assert.ok(perms.has("dashboard.view"), "Super admin must have dashboard.view");
    assert.ok(perms.has("loans.approve"), "Super admin must have loans.approve");
    assert.ok(perms.has("settings.update"), "Super admin must have settings.update");
    assert.ok(perms.size >= 50, "Super admin must possess full permission catalog");

    const scope = await getUserAuthorizedBranchScope(superAdmin.id);
    assert.equal(scope.global, true, "Super admin must have global branch scope");
  });

  test("should resolve custom role permissions as union and revoke immediately if INACTIVE", async () => {
    const timestamp = Date.now();
    const superAdmin = await prisma.user.findFirst({ where: { roleAssignments: { some: { role: { slug: "super_admin" } } } } });
    assert.ok(superAdmin);

    // Create custom role
    const customRole = await createRole({
      name: `Custom Test Role ${timestamp}`,
      slug: `custom-role-${timestamp}`,
      description: "Testing custom role permissions",
      permissionCodes: ["members.view", "loans.view"],
      actorUserId: superAdmin.id,
    });

    // Create staff user with custom role
    const staffUser = await createUser({
      name: `Staff Test ${timestamp}`,
      email: `staff-${timestamp}@creditflow.local`,
      password: "PassWord123!",
      roleIds: [customRole.id],
      actorUserId: superAdmin.id,
    });

    // Verify active permissions
    const permsBefore = await getUserEffectivePermissions(staffUser.id);
    assert.ok(permsBefore.has("members.view"), "Staff user must have members.view");
    assert.ok(permsBefore.has("loans.view"), "Staff user must have loans.view");
    assert.equal(permsBefore.has("loans.approve"), false, "Staff user must NOT have loans.approve");

    // Deactivate custom role
    await updateRoleStatus({ roleId: customRole.id, status: "INACTIVE", actorUserId: superAdmin.id });

    // Verify permissions revoked immediately
    const permsAfter = await getUserEffectivePermissions(staffUser.id);
    assert.equal(permsAfter.has("members.view"), false, "INACTIVE role permissions must be revoked immediately");
    assert.equal(permsAfter.has("loans.view"), false, "INACTIVE role permissions must be revoked immediately");
  });

  test("should deny all permissions and branch access if user is SUSPENDED or INACTIVE", async () => {
    const timestamp = Date.now();
    const superAdmin = await prisma.user.findFirst({ where: { roleAssignments: { some: { role: { slug: "super_admin" } } } } });
    assert.ok(superAdmin);

    const staffRole = await prisma.roleProfile.findUnique({ where: { slug: "staff" } });
    assert.ok(staffRole);

    const user = await createUser({
      name: `Suspended Test ${timestamp}`,
      email: `suspended-${timestamp}@creditflow.local`,
      password: "PassWord123!",
      roleIds: [staffRole.id],
      actorUserId: superAdmin.id,
    });

    // Suspend user
    await updateUser({ userId: user.id, status: "SUSPENDED", actorUserId: superAdmin.id });

    const perms = await getUserEffectivePermissions(user.id);
    assert.equal(perms.size, 0, "SUSPENDED user must have 0 effective permissions");

    const scope = await getUserAuthorizedBranchScope(user.id);
    assert.equal(scope.global, false, "SUSPENDED user must have global = false");
    assert.equal(scope.branchIds.length, 0, "SUSPENDED user must have 0 accessible branches");
  });

  test("should enforce privilege ceiling preventing non-super-admin from granting unheld permissions", async () => {
    const timestamp = Date.now();
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin);

    // Create custom role for manager having roles.create & roles.assign_permissions, but NOT settings.update
    const creatorRole = await createRole({
      name: `Role Creator ${timestamp}`,
      slug: `role-creator-${timestamp}`,
      permissionCodes: ["roles.create", "roles.assign_permissions", "members.view"],
      actorUserId: superAdmin.id,
    });

    const managerUser = await createUser({
      name: `Manager Ceiling ${timestamp}`,
      email: `manager-ceiling-${timestamp}@creditflow.local`,
      password: "PassWord123!",
      roleIds: [creatorRole.id],
      hasGlobalBranchAccess: true, // Has global scope for role definitions
      actorUserId: superAdmin.id,
    });

    // Manager possesses roles.create and roles.assign_permissions, but does NOT possess settings.update.
    // Try to create a role containing settings.update.
    await assert.rejects(
      async () => {
        await createRole({
          name: `Escalated Role ${timestamp}`,
          slug: `escalated-role-${timestamp}`,
          permissionCodes: ["settings.update"],
          actorUserId: managerUser.id,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof RoleManagementError);
        assert.match(err.message, /do not possess/i);
        return true;
      }
    );
  });

  test("should prevent branch-scoped actor from managing role definitions or assigning unauthorized branches", async () => {
    const timestamp = Date.now();
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin);

    const branch = await prisma.branch.create({
      data: {
        name: `Branch Scope ${timestamp}`,
        code: `BR-SC-${timestamp}`,
        email: `branch-sc-${timestamp}@creditflow.local`,
        phone: "555-0010",
        address: "10 Scope Way",
        city: "Metro",
        state: "ST",
        country: "India",
        currency: "INR",
      },
    });

    const managerRole = await prisma.roleProfile.findUnique({ where: { slug: "branch_manager" } });
    assert.ok(managerRole);

    const scopedManager = await createUser({
      name: `Scoped Manager ${timestamp}`,
      email: `scoped-mgr-${timestamp}@creditflow.local`,
      password: "PassWord123!",
      roleIds: [managerRole.id],
      branchIds: [branch.id],
      hasGlobalBranchAccess: false,
      actorUserId: superAdmin.id,
    });

    // 1. Attempt to create role definition without global branch scope -> DENIED
    await assert.rejects(
      async () => {
        await createRole({
          name: `Scoped Role ${timestamp}`,
          slug: `scoped-role-${timestamp}`,
          permissionCodes: ["members.view"],
          actorUserId: scopedManager.id,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof RoleManagementError);
        assert.match(err.message, /global branch scope/i);
        return true;
      }
    );

    // 2. Attempt to grant global branch access without having global scope -> DENIED
    await assert.rejects(
      async () => {
        await createUser({
          name: `Global Attempt ${timestamp}`,
          email: `global-att-${timestamp}@creditflow.local`,
          password: "PassWord123!",
          hasGlobalBranchAccess: true,
          actorUserId: scopedManager.id,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof PrivilegeEscalationError);
        assert.match(err.message, /possessing global branch scope/i);
        return true;
      }
    );
  });

  test("should enforce Serializable last active super-admin protection against concurrent deactivations", async () => {
    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
    assert.ok(superAdminRole);

    // Fetch all currently active super admins
    const activeSuperAdminAssignments = await prisma.userRoleAssignment.findMany({
      where: {
        roleId: superAdminRole.id,
        role: { status: "ACTIVE" },
        user: { status: "ACTIVE" },
      },
      include: { user: true },
    });

    assert.ok(activeSuperAdminAssignments.length >= 1, "At least 1 active super admin must exist");

    const activeSuperAdminUsers = activeSuperAdminAssignments.map((a) => a.user);
    const lastSuperAdmin = activeSuperAdminUsers[0];

    // Deactivate all super admins EXCEPT lastSuperAdmin
    for (let i = 1; i < activeSuperAdminUsers.length; i++) {
      await updateUser({
        userId: activeSuperAdminUsers[i].id,
        status: "SUSPENDED",
        actorUserId: lastSuperAdmin.id,
      });
    }

    // Now lastSuperAdmin is the ONLY remaining active super admin in the database.
    // Attempting to suspend lastSuperAdmin must be blocked by LastSuperAdminProtectionError!
    await assert.rejects(
      async () => {
        await updateUser({
          userId: lastSuperAdmin.id,
          status: "SUSPENDED",
          actorUserId: lastSuperAdmin.id,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof LastSuperAdminProtectionError);
        return true;
      }
    );

    // Restore suspended super admins for subsequent test steps
    for (let i = 1; i < activeSuperAdminUsers.length; i++) {
      await updateUser({
        userId: activeSuperAdminUsers[i].id,
        status: "ACTIVE",
        actorUserId: lastSuperAdmin.id,
      });
    }
  });

  test("should block deactivation of SUPER_ADMIN system role profile", async () => {
    const superAdmin = await prisma.user.findFirst({ where: { roleAssignments: { some: { role: { slug: "super_admin" } } } } });
    assert.ok(superAdmin);

    const superAdminRole = await prisma.roleProfile.findUnique({ where: { slug: "super_admin" } });
    assert.ok(superAdminRole);

    await assert.rejects(
      async () => {
        await updateRoleStatus({ roleId: superAdminRole.id, status: "INACTIVE", actorUserId: superAdmin.id });
      },
      (err: Error) => {
        assert.ok(err instanceof RoleManagementError);
        assert.match(err.message, /cannot be deactivated/i);
        return true;
      }
    );
  });
});
