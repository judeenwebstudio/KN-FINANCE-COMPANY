import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { bootstrapRBAC } from "../src/lib/auth/bootstrap";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "../src/lib/auth/authorize";
import { createUser, updateUser, PrivilegeEscalationError, LastSuperAdminProtectionError } from "../src/lib/auth/users-service";
import { createRole, updateRolePermissions, updateRoleStatus, deleteRole, RoleManagementError } from "../src/lib/auth/roles-service";

async function runE2EPhase6Verification() {
  console.log("==================================================");
  console.log("STARTING PHASE 6 — USERS, ROLES & RBAC LIVE E2E SUITE");
  console.log("==================================================\n");

  // Step 1: Idempotent Bootstrap
  console.log("Step 1: Running RBAC Bootstrap...");
  const boot = await bootstrapRBAC();
  assert.ok(boot.permissionsSeeded >= 50, "At least 50 permissions seeded");
  assert.ok(boot.rolesSeeded >= 8, "At least 8 system roles seeded");
  assert.ok(boot.activeSuperAdmins >= 1, "At least 1 active super admin verified");
  console.log("✔ Step 1 Passed: RBAC Bootstrap verified.\n");

  // Step 2: Fetch Super Admin User
  console.log("Step 2: Verifying Super Admin User & Global Scope...");
  const superAdmin = await prisma.user.findFirst({
    where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
  });
  assert.ok(superAdmin, "Active super admin user must exist");
  assert.equal(superAdmin.hasGlobalBranchAccess, true, "Super admin must have hasGlobalBranchAccess = true");

  const saScope = await getUserAuthorizedBranchScope(superAdmin.id);
  assert.equal(saScope.global, true, "Super admin authorized scope must be global = true");
  console.log("✔ Step 2 Passed: Super Admin user and global branch scope verified.\n");

  // Step 3: Authoritative Effective Permissions
  console.log("Step 3: Verifying Super Admin Authoritative Effective Permissions...");
  const saPerms = await getUserEffectivePermissions(superAdmin.id);
  assert.ok(saPerms.has("dashboard.view"), "Super admin must have dashboard.view");
  assert.ok(saPerms.has("users.create"), "Super admin must have users.create");
  assert.ok(saPerms.has("roles.assign_permissions"), "Super admin must have roles.assign_permissions");
  assert.ok(saPerms.has("audit.view"), "Super admin must have audit.view");
  assert.ok(saPerms.size >= 50, "Super admin must possess full permission catalog");
  console.log(`✔ Step 3 Passed: Super Admin possesses all ${saPerms.size} effective permissions.\n`);

  // Step 4: Create Custom Role 'Underwriter'
  console.log("Step 4: Creating Custom Role 'Underwriter'...");
  const timestamp = Date.now();
  const underwriterRole = await createRole({
    name: `Underwriter ${timestamp}`,
    slug: `underwriter-${timestamp}`,
    description: "Loan underwriting specialist",
    permissionCodes: ["loans.view", "loans.approve", "loans.reject"],
    actorUserId: superAdmin.id,
  });
  assert.ok(underwriterRole.id);
  console.log(`✔ Step 4 Passed: Created custom role ${underwriterRole.name} (${underwriterRole.slug}).\n`);

  // Step 5: Fetch Branch & Create Branch-Scoped Staff User
  console.log("Step 5: Creating Branch-Scoped Staff User...");
  const branch = await prisma.branch.findFirst();
  assert.ok(branch, "At least one branch must exist in database");

  const staffUser = await createUser({
    name: `Staff Underwriter ${timestamp}`,
    email: `underwriter-${timestamp}@creditflow.local`,
    password: "Password123!",
    roleIds: [underwriterRole.id],
    branchIds: [branch.id],
    hasGlobalBranchAccess: false,
    actorUserId: superAdmin.id,
  });
  assert.ok(staffUser.id);
  console.log(`✔ Step 5 Passed: Created user ${staffUser.name} assigned to branch ${branch.name}.\n`);

  // Step 6: Verify Staff Effective Permissions
  console.log("Step 6: Verifying Staff User Effective Permissions...");
  const staffPerms = await getUserEffectivePermissions(staffUser.id);
  assert.equal(staffPerms.has("loans.view"), true, "Must have loans.view");
  assert.equal(staffPerms.has("loans.approve"), true, "Must have loans.approve");
  assert.equal(staffPerms.has("loans.reject"), true, "Must have loans.reject");
  assert.equal(staffPerms.has("loans.disburse"), false, "Must NOT have loans.disburse");
  assert.equal(staffPerms.has("settings.update"), false, "Must NOT have settings.update");
  console.log("✔ Step 6 Passed: Staff effective permissions resolved accurately.\n");

  // Step 7: Verify Staff Authorized Branch Scope
  console.log("Step 7: Verifying Staff User Authorized Branch Scope...");
  const staffScope = await getUserAuthorizedBranchScope(staffUser.id);
  assert.equal(staffScope.global, false, "Staff user scope must be global = false");
  assert.ok(staffScope.branchIds.includes(branch.id), "Staff scope must include assigned branch");
  console.log("✔ Step 7 Passed: Staff branch scope verified.\n");

  // Step 8 & 9: Privilege Ceiling Enforcement
  console.log("Step 8 & 9: Testing Privilege Ceiling Enforcement...");
  const creatorRole = await createRole({
    name: `Role Creator ${timestamp}`,
    slug: `role-creator-${timestamp}`,
    permissionCodes: ["roles.create", "roles.assign_permissions", "members.view"],
    actorUserId: superAdmin.id,
  });

  const managerUser = await createUser({
    name: `Limited Manager ${timestamp}`,
    email: `limited-mgr-${timestamp}@creditflow.local`,
    password: "Password123!",
    roleIds: [creatorRole.id],
    hasGlobalBranchAccess: true,
    actorUserId: superAdmin.id,
  });

  await assert.rejects(
    async () => {
      await createRole({
        name: `Unauthorized Role ${timestamp}`,
        slug: `unauthorized-role-${timestamp}`,
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
  console.log("✔ Step 8 & 9 Passed: Privilege ceiling blocked escalation attempt.\n");

  // Step 10: Unauthorized Branch Scope Assignment
  console.log("Step 10: Testing Branch Scope Ceiling Enforcement...");
  // Grant staffUser users.create permission via role update
  const userCreatorRole = await createRole({
    name: `User Creator ${timestamp}`,
    slug: `user-creator-${timestamp}`,
    permissionCodes: ["users.create"],
    actorUserId: superAdmin.id,
  });

  const scopedUserCreator = await createUser({
    name: `Scoped User Creator ${timestamp}`,
    email: `scoped-creator-${timestamp}@creditflow.local`,
    password: "Password123!",
    roleIds: [userCreatorRole.id],
    branchIds: [branch.id],
    hasGlobalBranchAccess: false,
    actorUserId: superAdmin.id,
  });

  // scopedUserCreator HAS users.create permission, but does NOT possess global branch scope.
  // Attempting to grant global branch access must fail at global scope check!
  await assert.rejects(
    async () => {
      await createUser({
        name: `Escalated Branch User ${timestamp}`,
        email: `esc-branch-${timestamp}@creditflow.local`,
        password: "Password123!",
        hasGlobalBranchAccess: true,
        actorUserId: scopedUserCreator.id,
      });
    },
    (err: Error) => {
      assert.ok(err instanceof PrivilegeEscalationError);
      assert.match(err.message, /possessing global branch scope/i);
      return true;
    }
  );
  console.log("✔ Step 10 Passed: Non-global actor blocked from granting global branch access.\n");

  // Step 11 & 12: Dynamic Permission Matrix Mutation
  console.log("Step 11 & 12: Updating Role Permission Matrix...");
  await updateRolePermissions({
    roleId: underwriterRole.id,
    permissionCodes: ["loans.view", "loans.approve", "loans.reject", "loans.disburse"],
    actorUserId: superAdmin.id,
  });

  const staffPermsUpdated = await getUserEffectivePermissions(staffUser.id);
  assert.equal(staffPermsUpdated.has("loans.disburse"), true, "Staff user now receives loans.disburse dynamically");
  console.log("✔ Step 11 & 12 Passed: Permission matrix update reflected immediately on assigned user.\n");

  // Step 13 & 14: Dynamic Role Deactivation Revocation
  console.log("Step 13 & 14: Deactivating Role Profile & Verifying Immediate Revocation...");
  await updateRoleStatus({
    roleId: underwriterRole.id,
    status: "INACTIVE",
    actorUserId: superAdmin.id,
  });

  const staffPermsRevoked = await getUserEffectivePermissions(staffUser.id);
  assert.equal(staffPermsRevoked.size, 0, "Deactivated role immediately revokes all assigned permissions");
  console.log("✔ Step 13 & 14 Passed: Deactivating role revoked permissions instantly.\n");

  // Step 15: Re-activate Role
  console.log("Step 15: Re-activating Role Profile...");
  await updateRoleStatus({
    roleId: underwriterRole.id,
    status: "ACTIVE",
    actorUserId: superAdmin.id,
  });

  const staffPermsRestored = await getUserEffectivePermissions(staffUser.id);
  assert.equal(staffPermsRestored.has("loans.disburse"), true, "Re-activating role restores permissions");
  console.log("✔ Step 15 Passed: Role re-activated successfully.\n");

  // Step 16: Audit Log Verification
  console.log("Step 16: Verifying Atomic Audit Log Records & Sanitization...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { actorUserId: superAdmin.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  assert.ok(auditLogs.length > 0, "Audit logs must record administrative actions");
  for (const log of auditLogs) {
    if (log.metadataJson) {
      assert.equal(log.metadataJson.includes("passwordHash"), false, "Password hash must be sanitized from audit log");
      assert.equal(log.metadataJson.includes("Password123!"), false, "Plaintext password must be sanitized from audit log");
    }
  }
  console.log(`✔ Step 16 Passed: Verified ${auditLogs.length} sanitized audit log records.\n`);

  // Step 17: Last Active Super Admin Protection
  console.log("Step 17: Testing Last Active Super Admin Protection...");
  const activeSuperAdminAssignments = await prisma.userRoleAssignment.findMany({
    where: {
      role: { slug: "super_admin", status: "ACTIVE" },
      user: { status: "ACTIVE" },
    },
    include: { user: true },
  });

  const activeSuperAdmins = activeSuperAdminAssignments.map((a) => a.user);
  const lastSA = activeSuperAdmins[0];

  // Temporarily suspend any other active super admins to test last super admin boundary
  for (let i = 1; i < activeSuperAdmins.length; i++) {
    await updateUser({ userId: activeSuperAdmins[i].id, status: "SUSPENDED", actorUserId: lastSA.id });
  }

  // Attempting to suspend the last remaining super admin must be blocked!
  await assert.rejects(
    async () => {
      await updateUser({ userId: lastSA.id, status: "SUSPENDED", actorUserId: lastSA.id });
    },
    (err: Error) => {
      assert.ok(err instanceof LastSuperAdminProtectionError);
      return true;
    }
  );

  // Restore suspended super admins
  for (let i = 1; i < activeSuperAdmins.length; i++) {
    await updateUser({ userId: activeSuperAdmins[i].id, status: "ACTIVE", actorUserId: lastSA.id });
  }
  console.log("✔ Step 17 Passed: Last Active Super Admin Protection verified.\n");

  // Step 18: Clean Up Test Artifacts
  console.log("Step 18: Cleaning up test artifacts...");
  await prisma.user.deleteMany({
    where: { id: { in: [staffUser.id, managerUser.id, scopedUserCreator.id] } },
  });
  await deleteRole(underwriterRole.id, superAdmin.id);
  await deleteRole(creatorRole.id, superAdmin.id);
  await deleteRole(userCreatorRole.id, superAdmin.id);
  console.log("✔ Step 18 Passed: Test artifacts cleaned up.\n");

  console.log("==================================================");
  console.log("ALL 18 STEPS OF PHASE 6 E2E VERIFICATION PASSED 100%!");
  console.log("==================================================");
}

runE2EPhase6Verification()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Phase 6 E2E Verification failed:", err);
    prisma.$disconnect();
    process.exit(1);
  });
