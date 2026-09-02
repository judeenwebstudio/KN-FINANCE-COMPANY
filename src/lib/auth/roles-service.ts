import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "./authorize";

export class RoleManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleManagementError";
  }
}

export type CreateRoleInput = {
  name: string;
  slug: string;
  description?: string;
  permissionCodes?: string[];
  actorUserId: string;
};

export type UpdateRolePermissionsInput = {
  roleId: string;
  permissionCodes: string[];
  actorUserId: string;
};

export type UpdateRoleStatusInput = {
  roleId: string;
  status: "ACTIVE" | "INACTIVE";
  actorUserId: string;
};

/**
 * Creates a custom RoleProfile and maps permission codes.
 * Requires global branch scope and roles.create + roles.assign_permissions.
 */
export async function createRole(input: CreateRoleInput) {
  const actorScope = await getUserAuthorizedBranchScope(input.actorUserId);
  const actorPermissions = await getUserEffectivePermissions(input.actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  // Global Scope requirement for Role Definitions
  if (!isActorSuperAdmin && !actorScope.global) {
    throw new RoleManagementError("Only administrators with global branch scope can manage role definitions.");
  }

  // Permission Check
  if (!isActorSuperAdmin && !actorPermissions.has("roles.create")) {
    throw new RoleManagementError("Permission 'roles.create' required to create custom roles.");
  }

  if (input.permissionCodes && input.permissionCodes.length > 0 && !isActorSuperAdmin && !actorPermissions.has("roles.assign_permissions")) {
    throw new RoleManagementError("Permission 'roles.assign_permissions' required to assign permissions to a role.");
  }

  // Permission Ceiling Check
  if (input.permissionCodes && input.permissionCodes.length > 0 && !isActorSuperAdmin) {
    for (const code of input.permissionCodes) {
      if (!actorPermissions.has(code)) {
        throw new RoleManagementError(`Cannot grant permission '${code}' which you do not possess.`);
      }
    }
  }

  const slug = input.slug.toLowerCase().trim().replace(/\s+/g, "-");

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.roleProfile.findUnique({ where: { slug } });
    if (existing) {
      throw new RoleManagementError(`Role with slug '${slug}' already exists.`);
    }

    const role = await tx.roleProfile.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        isSystem: false,
        isSuperAdminRole: false,
        status: "ACTIVE",
      },
    });

    if (input.permissionCodes && input.permissionCodes.length > 0) {
      const perms = await tx.permission.findMany({
        where: { code: { in: input.permissionCodes } },
      });

      for (const p of perms) {
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
      }
    }

    await logAuditEvent(
      {
        actorUserId: input.actorUserId,
        action: "ROLE_CREATED",
        entityType: "RoleProfile",
        entityId: role.id,
        metadata: {
          name: role.name,
          slug: role.slug,
          permissionCodes: input.permissionCodes || [],
        },
      },
      tx
    );

    return role;
  });
}

/**
 * Updates permissions mapped to a RoleProfile.
 * Evaluates actor global branch scope and permission privilege ceiling.
 */
export async function updateRolePermissions(input: UpdateRolePermissionsInput) {
  const actorScope = await getUserAuthorizedBranchScope(input.actorUserId);
  const actorPermissions = await getUserEffectivePermissions(input.actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  // Global Scope requirement
  if (!isActorSuperAdmin && !actorScope.global) {
    throw new RoleManagementError("Only administrators with global branch scope can manage role definitions.");
  }

  // Permission Check
  if (!isActorSuperAdmin && !actorPermissions.has("roles.assign_permissions")) {
    throw new RoleManagementError("Permission 'roles.assign_permissions' required to modify role permissions.");
  }

  const role = await prisma.roleProfile.findUnique({
    where: { id: input.roleId },
    include: { rolePermissions: { include: { permission: true } } },
  });

  if (!role) {
    throw new RoleManagementError("Role profile not found.");
  }

  // Protected Super Admin Role Check
  if (role.isSuperAdminRole && !isActorSuperAdmin) {
    throw new RoleManagementError("Only Super Administrators can modify the Super Administrator role permissions.");
  }

  // Permission Ceiling Check (Evaluated before requested role mutation)
  if (!isActorSuperAdmin) {
    for (const code of input.permissionCodes) {
      if (!actorPermissions.has(code)) {
        throw new RoleManagementError(`Cannot grant permission '${code}' which you do not possess.`);
      }
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Delete existing mappings
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });

    // Map new permissions
    const perms = await tx.permission.findMany({
      where: { code: { in: input.permissionCodes } },
    });

    for (const p of perms) {
      await tx.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }

    const beforeCodes = role.rolePermissions.map((rp) => rp.permission.code);
    const addedCodes = input.permissionCodes.filter((c) => !beforeCodes.includes(c));
    const removedCodes = beforeCodes.filter((c) => !input.permissionCodes.includes(c));

    await logAuditEvent(
      {
        actorUserId: input.actorUserId,
        action: "ROLE_PERMISSIONS_UPDATED",
        entityType: "RoleProfile",
        entityId: role.id,
        metadata: {
          roleName: role.name,
          addedPermissionCodes: addedCodes,
          removedPermissionCodes: removedCodes,
        },
      },
      tx
    );

    return await tx.roleProfile.findUnique({
      where: { id: role.id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  });
}

/**
 * Updates RoleProfile status (ACTIVE vs INACTIVE).
 * Prevents deactivating the SUPER_ADMIN role.
 */
export async function updateRoleStatus(input: UpdateRoleStatusInput) {
  const actorScope = await getUserAuthorizedBranchScope(input.actorUserId);
  const actorPermissions = await getUserEffectivePermissions(input.actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  if (!isActorSuperAdmin && !actorScope.global) {
    throw new RoleManagementError("Only administrators with global branch scope can alter role status.");
  }

  if (!isActorSuperAdmin && !actorPermissions.has("roles.update")) {
    throw new RoleManagementError("Permission 'roles.update' required to alter role status.");
  }

  const role = await prisma.roleProfile.findUnique({ where: { id: input.roleId } });
  if (!role) {
    throw new RoleManagementError("Role profile not found.");
  }

  if (role.isSuperAdminRole && input.status === "INACTIVE") {
    throw new RoleManagementError("The Super Administrator role cannot be deactivated.");
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.roleProfile.update({
      where: { id: role.id },
      data: { status: input.status },
    });

    await logAuditEvent(
      {
        actorUserId: input.actorUserId,
        action: "ROLE_STATUS_UPDATED",
        entityType: "RoleProfile",
        entityId: role.id,
        metadata: { statusBefore: role.status, statusAfter: input.status },
      },
      tx
    );

    return updated;
  });
}

/**
 * Deletes a custom RoleProfile if unassigned and not a system role.
 */
export async function deleteRole(roleId: string, actorUserId: string) {
  const actorScope = await getUserAuthorizedBranchScope(actorUserId);
  const actorPermissions = await getUserEffectivePermissions(actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  if (!isActorSuperAdmin && !actorScope.global) {
    throw new RoleManagementError("Only administrators with global branch scope can delete roles.");
  }

  if (!isActorSuperAdmin && !actorPermissions.has("roles.delete")) {
    throw new RoleManagementError("Permission 'roles.delete' required to delete roles.");
  }

  const role = await prisma.roleProfile.findUnique({
    where: { id: roleId },
    include: { userAssignments: true },
  });

  if (!role) {
    throw new RoleManagementError("Role profile not found.");
  }

  if (role.isSystem || role.isSuperAdminRole) {
    throw new RoleManagementError("System roles cannot be deleted.");
  }

  if (role.userAssignments.length > 0) {
    throw new RoleManagementError(`Cannot delete role '${role.name}' because it is assigned to ${role.userAssignments.length} user(s). Reassign users first.`);
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.roleProfile.delete({ where: { id: role.id } });

    await logAuditEvent(
      {
        actorUserId,
        action: "ROLE_DELETED",
        entityType: "RoleProfile",
        entityId: role.id,
        metadata: { roleName: role.name, slug: role.slug },
      },
      tx
    );

    return deleted;
  });
}
