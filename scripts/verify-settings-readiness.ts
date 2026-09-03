import { prisma } from "../src/lib/prisma";
import { initializeNotificationTemplates } from "../src/lib/settings/notification-service";

const REQUIRED_SETTINGS_PERMISSIONS = [
  "settings.view",
  "settings.company.manage",
  "settings.branch.manage",
  "settings.financial.manage",
  "settings.notifications.manage",
  "settings.integrations.manage",
] as const;

async function verifySettingsReadiness() {
  await initializeNotificationTemplates();
  const [permissions, superAdminRole, activeSuperAdminAssignments, branches, companyProfileCount] =
    await Promise.all([
      prisma.permission.findMany({
        where: { code: { in: [...REQUIRED_SETTINGS_PERMISSIONS] } },
        select: { code: true },
      }),
      prisma.roleProfile.findUnique({
        where: { slug: "super_admin" },
        select: {
          status: true,
          isSuperAdminRole: true,
          rolePermissions: {
            where: { permission: { code: { in: [...REQUIRED_SETTINGS_PERMISSIONS] } } },
            select: { permission: { select: { code: true } } },
          },
        },
      }),
      prisma.userRoleAssignment.count({
        where: {
          user: { status: "ACTIVE" },
          role: { slug: "super_admin", status: "ACTIVE", isSuperAdminRole: true },
        },
      }),
      prisma.branch.findMany({
        select: {
          id: true,
          _count: { select: { users: true, members: true, accounts: true, loans: true } },
        },
      }),
      prisma.companyProfile.count(),
    ]);

  const permissionCodes = new Set(permissions.map((permission) => permission.code));
  const mappedCodes = new Set(
    superAdminRole?.rolePermissions.map((mapping) => mapping.permission.code) ?? [],
  );
  const missingCatalogPermissions = REQUIRED_SETTINGS_PERMISSIONS.filter(
    (code) => !permissionCodes.has(code),
  );
  const missingSuperAdminMappings = REQUIRED_SETTINGS_PERMISSIONS.filter(
    (code) => !mappedCodes.has(code),
  );

  if (
    !superAdminRole ||
    superAdminRole.status !== "ACTIVE" ||
    !superAdminRole.isSuperAdminRole ||
    activeSuperAdminAssignments < 1 ||
    missingCatalogPermissions.length > 0 ||
    missingSuperAdminMappings.length > 0
  ) {
    throw new Error(
      `Settings readiness failed: activeSuperAdmins=${activeSuperAdminAssignments}, ` +
        `missingCatalogPermissions=${missingCatalogPermissions.join(",") || "none"}, ` +
        `missingSuperAdminMappings=${missingSuperAdminMappings.join(",") || "none"}.`,
    );
  }

  console.log("[SETTINGS_READINESS] Production settings dependencies verified.", {
    settingsPermissions: permissions.length,
    superAdminPermissionMappings: mappedCodes.size,
    activeSuperAdminAssignments,
    branchesChecked: branches.length,
    companyProfileRows: companyProfileCount,
  });
}

verifySettingsReadiness()
  .catch((error: unknown) => {
    const err = error as { name?: string; message?: string; code?: string };
    console.error("[SETTINGS_READINESS_ERROR]", {
      name: err.name ?? "Error",
      message: err.message ?? "Unknown readiness failure",
      prismaCode: err.code ?? null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
