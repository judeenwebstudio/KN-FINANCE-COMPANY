import { redirect } from "next/navigation";
import { getCurrentUser } from "../authz";
import { prisma } from "../prisma";
import { PERMISSION_CATALOG } from "./catalog";

export type BranchScope = {
  global: boolean;
  branchIds: string[];
};

export class PermissionDeniedError extends Error {
  constructor(message: string = "Access denied: insufficient permission.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export class BranchAccessDeniedError extends Error {
  constructor(message: string = "Access denied: branch out of scope.") {
    super(message);
    this.name = "BranchAccessDeniedError";
  }
}

/**
 * Resolves the effective permissions for a user authoritatively from relational RBAC.
 * Returns an empty Set if the user is INACTIVE or SUSPENDED.
 * Strictly FAILS CLOSED if relational RBAC assignments are missing (never falls back to legacy User.role).
 */
export async function getUserEffectivePermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return new Set<string>();
  }

  // Check if user has an active super admin role assignment or legacy SUPER_ADMIN role
  const isSuperAdmin =
    user.role === "SUPER_ADMIN" ||
    user.roleAssignments.some(
      (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
    );

  if (isSuperAdmin) {
    return new Set(PERMISSION_CATALOG.map((p) => p.code));
  }

  const effectivePermissions = new Set<string>();

  for (const assignment of user.roleAssignments) {
    if (assignment.role.status === "ACTIVE") {
      for (const rp of assignment.role.rolePermissions) {
        effectivePermissions.add(rp.permission.code);
      }
    }
  }

  return effectivePermissions;
}

/**
 * Resolves the authorized branch scope for a user authoritatively.
 * Returns { global: false, branchIds: [] } if user is INACTIVE or SUSPENDED.
 */
export async function getUserAuthorizedBranchScope(userId: string): Promise<BranchScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: { role: true },
      },
      branchAccess: { select: { branchId: true } },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return { global: false, branchIds: [] };
  }

  const isSuperAdmin =
    user.role === "SUPER_ADMIN" ||
    user.roleAssignments.some(
      (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
    );

  const isGlobal = isSuperAdmin || user.hasGlobalBranchAccess;

  if (isGlobal) {
    const allBranches = await prisma.branch.findMany({ select: { id: true } });
    return {
      global: true,
      branchIds: allBranches.map((b) => b.id),
    };
  }

  const explicitBranchIds = user.branchAccess.map((ba) => ba.branchId);

  return {
    global: false,
    branchIds: explicitBranchIds,
  };
}

/**
 * Server guard checking if a user has a specific permission code.
 */
export async function hasPermission(userId: string, code: string): Promise<boolean> {
  const permissions = await getUserEffectivePermissions(userId);
  return permissions.has(code);
}

/**
 * Enforces server authorization for a required permission code.
 * Re-validates active user status and permission authoritatively from DB.
 */
export async function requirePermission(code: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.status !== "ACTIVE") {
    throw new PermissionDeniedError("Account is inactive or suspended.");
  }

  const permissions = await getUserEffectivePermissions(user.id);
  if (!permissions.has(code)) {
    throw new PermissionDeniedError(`Required permission missing: ${code}`);
  }

  return user;
}

/**
 * Enforces server authorization for ANY of the specified permission codes.
 */
export async function requireAnyPermission(codes: string[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.status !== "ACTIVE") {
    throw new PermissionDeniedError("Account is inactive or suspended.");
  }

  const permissions = await getUserEffectivePermissions(user.id);
  const hasAny = codes.some((code) => permissions.has(code));

  if (!hasAny) {
    throw new PermissionDeniedError(`Required permissions missing (at least one of: ${codes.join(", ")})`);
  }

  return user;
}

/**
 * Enforces server-side branch scope access for a target branch ID.
 */
export async function assertBranchAccess(userId: string, branchId: string) {
  const scope = await getUserAuthorizedBranchScope(userId);

  if (scope.global) return;

  if (!scope.branchIds.includes(branchId)) {
    throw new BranchAccessDeniedError(`Access denied to branch ${branchId}`);
  }
}
