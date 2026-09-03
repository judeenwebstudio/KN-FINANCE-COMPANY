import { prisma } from "../prisma";
import { PERMISSION_CATALOG } from "./catalog";

export async function bootstrapRBAC(): Promise<{
  permissionsSeeded: number;
  rolesSeeded: number;
  usersMigrated: number;
  activeSuperAdmins: number;
}> {
  console.log("[RBAC Bootstrap] Starting idempotent RBAC bootstrap...");

  // 1. Seed Permission Catalog
  const permissionMap = new Map<string, string>(); // code -> id
  for (const def of PERMISSION_CATALOG) {
    const perm = await prisma.permission.upsert({
      where: { code: def.code },
      update: { name: def.name, category: def.category, description: def.description, isSystem: true },
      create: { code: def.code, name: def.name, category: def.category, description: def.description, isSystem: true },
    });
    permissionMap.set(perm.code, perm.id);
  }

  // 2. Define System Roles and Permission Assignments
  const systemRoleConfigs = [
    {
      name: "Super Administrator",
      slug: "super_admin",
      description: "Full global system authority with implicit all-permission access.",
      isSystem: true,
      isSuperAdminRole: true,
      permissionCodes: Array.from(permissionMap.keys()),
    },
    {
      name: "Administrator",
      slug: "admin",
      description: "Broad operational administration across branches and domains.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: Array.from(permissionMap.keys()).filter((c) => !c.startsWith("settings.update") && !c.startsWith("settings.company.manage") && !c.startsWith("settings.financial.manage")),
    },
    {
      name: "Branch Manager",
      slug: "branch_manager",
      description: "Operational management for assigned branch scope.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: [
        "dashboard.view",
        "members.view", "members.create", "members.update", "members.requests.review",
        "loans.view", "loans.create", "loans.approve", "loans.reject", "loans.disburse", "loans.repay", "loans.collections.manage",
        "accounts.view", "accounts.create", "accounts.update_status", "accounts.deposit", "accounts.withdraw",
        "expenses.view", "expenses.create",
        "banking.view", "banking.post_transactions", "banking.transfer", "banking.reconcile",
        "reports.view", "reports.export", "reports.portfolio_quality",
        "users.view", "users.create", "users.update", "users.disable", "users.assign_roles", "users.manage_branch_access",
        "roles.view",
        "audit.view",
      ],
    },
    {
      name: "Staff / Operations",
      slug: "staff",
      description: "Daily branch operational staff.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: [
        "dashboard.view",
        "members.view", "members.create", "members.update",
        "loans.view", "loans.create", "loans.repay",
        "accounts.view", "accounts.deposit", "accounts.withdraw",
        "expenses.view", "expenses.create",
        "banking.view",
        "reports.view",
      ],
    },
    {
      name: "Loan Officer",
      slug: "loan_officer",
      description: "Loan origination, underwriting support, and collections.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: [
        "dashboard.view",
        "members.view", "members.create", "members.update",
        "loans.view", "loans.create", "loans.repay", "loans.collections.manage",
        "reports.view",
      ],
    },
    {
      name: "Cashier",
      slug: "cashier",
      description: "Counter teller cash deposits, withdrawals, and repayment processing.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: [
        "dashboard.view",
        "members.view",
        "accounts.view", "accounts.deposit", "accounts.withdraw",
        "loans.view", "loans.repay",
      ],
    },
    {
      name: "Auditor",
      slug: "auditor",
      description: "Read-only inspection of operations, financial reports, reconciliation, and audit logs.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: [
        "dashboard.view",
        "members.view",
        "loans.view",
        "accounts.view",
        "expenses.view",
        "banking.view",
        "reports.view", "reports.export", "reports.portfolio_quality",
        "users.view",
        "roles.view",
        "audit.view",
      ],
    },
    {
      name: "Viewer",
      slug: "viewer",
      description: "General read-only access to dashboards and basic reports.",
      isSystem: true,
      isSuperAdminRole: false,
      permissionCodes: ["dashboard.view", "reports.view"],
    },
  ];

  const roleMap = new Map<string, string>(); // slug -> id

  for (const config of systemRoleConfigs) {
    const role = await prisma.roleProfile.upsert({
      where: { slug: config.slug },
      update: {
        name: config.name,
        description: config.description,
        isSystem: config.isSystem,
        isSuperAdminRole: config.isSuperAdminRole,
        status: "ACTIVE",
      },
      create: {
        name: config.name,
        slug: config.slug,
        description: config.description,
        isSystem: config.isSystem,
        isSuperAdminRole: config.isSuperAdminRole,
        status: "ACTIVE",
      },
    });

    roleMap.set(config.slug, role.id);

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { code: { notIn: config.permissionCodes } },
      },
    });

    // Map permissions to role
    for (const code of config.permissionCodes) {
      const permId = permissionMap.get(code);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // 3. Migrate Existing Users
  const users = await prisma.user.findMany({
    include: { roleAssignments: true, branchAccess: true },
  });

  let usersMigrated = 0;

  for (const user of users) {
    let targetSlug: string | null = null;
    let grantGlobal = false;

    if (user.role === "SUPER_ADMIN") {
      targetSlug = "super_admin";
      grantGlobal = true;
    } else if (user.role === "ADMIN") {
      targetSlug = "admin";
      grantGlobal = true; // Preserved for legacy ADMIN users
    } else if (user.role === "BRANCH_MANAGER") {
      targetSlug = "branch_manager";
      grantGlobal = false;
    } else if (user.role === "STAFF") {
      targetSlug = "staff";
      grantGlobal = false;
    }

    if (grantGlobal && !user.hasGlobalBranchAccess) {
      await prisma.user.update({
        where: { id: user.id },
        data: { hasGlobalBranchAccess: true },
      });
    }

    if (targetSlug) {
      const roleId = roleMap.get(targetSlug);
      if (roleId) {
        const hasAssignment = user.roleAssignments.some((ra) => ra.roleId === roleId);
        if (!hasAssignment) {
          await prisma.userRoleAssignment.create({
            data: { userId: user.id, roleId },
          });
          usersMigrated++;
        }
      }
    }

    // Migrate branch access for non-global users with a branchId
    if (!grantGlobal && user.branchId) {
      const hasBranchAccess = user.branchAccess.some((ba) => ba.branchId === user.branchId);
      if (!hasBranchAccess) {
        await prisma.userBranchAccess.create({
          data: { userId: user.id, branchId: user.branchId },
        });
      }
    }
  }

  // 4. Verify Active Relational Super Admin Exists
  const activeSuperAdminRole = await prisma.roleProfile.findUnique({
    where: { slug: "super_admin" },
  });

  let activeSuperAdminCount = 0;

  if (activeSuperAdminRole) {
    activeSuperAdminCount = await prisma.userRoleAssignment.count({
      where: {
        roleId: activeSuperAdminRole.id,
        role: { status: "ACTIVE" },
        user: { status: "ACTIVE" },
      },
    });
  }

  // Emergency Recovery Hatch: If zero active super admins exist in relational RBAC, but a user has legacy SUPER_ADMIN enum, grant super_admin role!
  if (activeSuperAdminCount === 0 && activeSuperAdminRole) {
    const legacySuperAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    });

    if (legacySuperAdmin) {
      console.log(`[RBAC Bootstrap] Emergency recovery: Assigning relational super_admin to ${legacySuperAdmin.email}`);
      await prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: legacySuperAdmin.id, roleId: activeSuperAdminRole.id } },
        update: {},
        create: { userId: legacySuperAdmin.id, roleId: activeSuperAdminRole.id },
      });
      await prisma.user.update({
        where: { id: legacySuperAdmin.id },
        data: { hasGlobalBranchAccess: true },
      });

      activeSuperAdminCount = 1;
    }
  }

  if (activeSuperAdminCount === 0) {
    console.warn("[RBAC Bootstrap] WARNING: No active relational SUPER_ADMIN user found in system!");
  } else {
    console.log(`[RBAC Bootstrap] Verified ${activeSuperAdminCount} active relational SUPER_ADMIN user(s).`);
  }

  console.log(`[RBAC Bootstrap] Completed cleanly: ${permissionMap.size} permissions, ${roleMap.size} system roles, ${usersMigrated} user mappings.`);

  return {
    permissionsSeeded: permissionMap.size,
    rolesSeeded: roleMap.size,
    usersMigrated,
    activeSuperAdmins: activeSuperAdminCount,
  };
}
