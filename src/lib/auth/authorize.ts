import { cache } from "react";
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
 * Determines whether a user is eligible for Admin / Staff Portal access.
 * Must be an ACTIVE user with at least one ACTIVE relational staff/admin role assignment.
 * Deduplicated per-request via React cache.
 */
export const hasAdminPortalAccess = cache(async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      roleAssignments: {
        where: { role: { status: "ACTIVE" } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return false;
  }

  return user.roleAssignments.length > 0;
});

/**
 * Resolves the effective permissions for a user authoritatively from relational RBAC.
 * Returns an empty Set if the user is INACTIVE or SUSPENDED.
 * Strictly FAILS CLOSED if relational RBAC assignments are missing (never falls back to legacy User.role).
 * Deduplicated per-request via React cache.
 */
export const getUserEffectivePermissions = cache(async (userId: string): Promise<Set<string>> => {
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

  // Check if user has an active super admin role assignment authoritatively from relational RBAC
  const isSuperAdmin = user.roleAssignments.some(
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
});

/**
 * Resolves the authorized branch scope for a user authoritatively.
 * Returns { global: false, branchIds: [] } if user is INACTIVE or SUSPENDED.
 * Deduplicated per-request via React cache.
 */
export const getUserAuthorizedBranchScope = cache(async (userId: string): Promise<BranchScope> => {
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

  const isSuperAdmin = user.roleAssignments.some(
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
});

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

/**
 * Resolves the primary relational RBAC role display name for an active user.
 * Prioritizes Super Admin role assignments, then the primary assigned active role profile name.
 * Deduplicated per-request via React cache.
 */
export const getUserPrimaryRoleName = cache(async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        where: { role: { status: "ACTIVE" } },
        include: { role: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.roleAssignments || user.roleAssignments.length === 0) {
    return "Member";
  }

  const superAdminAssignment = user.roleAssignments.find(
    (ra) => ra?.role && ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );
  if (superAdminAssignment && superAdminAssignment.role?.name) {
    return superAdminAssignment.role.name;
  }

  const primaryAssignment = user.roleAssignments.find(
    (ra) => ra?.role && ra.role.status === "ACTIVE" && Boolean(ra.role.name)
  );
  if (primaryAssignment && primaryAssignment.role?.name) {
    return primaryAssignment.role.name;
  }

  return "Member";
});


