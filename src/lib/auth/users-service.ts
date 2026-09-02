import { hash } from "bcryptjs";
import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { getUserEffectivePermissions, getUserAuthorizedBranchScope } from "./authorize";
import { Prisma } from "../../generated/prisma/client";

export class PrivilegeEscalationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivilegeEscalationError";
  }
}

export class LastSuperAdminProtectionError extends Error {
  constructor(message: string = "Cannot deactivate, suspend, or demote the last active super administrator.") {
    super(message);
    this.name = "LastSuperAdminProtectionError";
  }
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  roleIds?: string[];
  branchIds?: string[];
  hasGlobalBranchAccess?: boolean;
  actorUserId: string;
};

export type UpdateUserInput = {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleIds?: string[];
  branchIds?: string[];
  hasGlobalBranchAccess?: boolean;
  actorUserId: string;
};

/**
 * Creates a new administrative or staff user inside an atomic transaction.
 * Evaluates privilege ceiling, branch ceiling, and global access ceiling BEFORE creation.
 */
export async function createUser(input: CreateUserInput) {
  const actorPermissions = await getUserEffectivePermissions(input.actorUserId);
  const actorBranchScope = await getUserAuthorizedBranchScope(input.actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  // 1. Permission Check
  if (!isActorSuperAdmin && !actorPermissions.has("users.create")) {
    throw new PrivilegeEscalationError("Permission 'users.create' required to create users.");
  }

  // 2. Global Branch Access Ceiling
  if (input.hasGlobalBranchAccess && !actorBranchScope.global) {
    throw new PrivilegeEscalationError("Cannot grant global branch access without possessing global branch scope.");
  }

  // 3. Branch Access Ceiling
  if (!actorBranchScope.global && input.branchIds && input.branchIds.length > 0) {
    const invalidBranches = input.branchIds.filter((bId) => !actorBranchScope.branchIds.includes(bId));
    if (invalidBranches.length > 0) {
      throw new PrivilegeEscalationError(`Cannot assign unauthorized branches: ${invalidBranches.join(", ")}`);
    }
  }

  // 4. Role Assignment Privilege Ceiling
  if (input.roleIds && input.roleIds.length > 0) {
    if (!isActorSuperAdmin && !actorPermissions.has("users.assign_roles")) {
      throw new PrivilegeEscalationError("Permission 'users.assign_roles' required to assign roles.");
    }

    const requestedRoles = await prisma.roleProfile.findMany({
      where: { id: { in: input.roleIds } },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (requestedRoles.length !== new Set(input.roleIds).size) {
      throw new PrivilegeEscalationError("One or more requested roles do not exist.");
    }

    for (const r of requestedRoles) {
      if (r.isSuperAdminRole && !isActorSuperAdmin) {
        throw new PrivilegeEscalationError("Only Super Administrators can assign the Super Administrator role.");
      }

      if (!isActorSuperAdmin) {
        for (const rp of r.rolePermissions) {
          if (!actorPermissions.has(rp.permission.code)) {
            throw new PrivilegeEscalationError(
              `Cannot assign role '${r.name}' containing permission '${rp.permission.code}' which you do not possess.`
            );
          }
        }
      }
    }
  }

  const passwordHash = await hash(input.password, 12);
  const normalizedEmail = input.email.toLowerCase().trim();

  return await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        status: "ACTIVE",
        hasGlobalBranchAccess: input.hasGlobalBranchAccess ?? false,
      },
    });

    // Create Role Assignments
    if (input.roleIds && input.roleIds.length > 0) {
      for (const rId of input.roleIds) {
        await tx.userRoleAssignment.create({
          data: { userId: createdUser.id, roleId: rId },
        });
      }
    }

    // Create Branch Access
    if (input.branchIds && input.branchIds.length > 0) {
      for (const bId of input.branchIds) {
        await tx.userBranchAccess.create({
          data: { userId: createdUser.id, branchId: bId },
        });
      }
    }

    // Audit Log
    await logAuditEvent(
      {
        actorUserId: input.actorUserId,
        action: "USER_CREATED",
        entityType: "User",
        entityId: createdUser.id,
        metadata: {
          name: createdUser.name,
          email: createdUser.email,
          roleIds: input.roleIds || [],
          branchIds: input.branchIds || [],
          hasGlobalBranchAccess: createdUser.hasGlobalBranchAccess,
        },
      },
      tx
    );

    return createdUser;
  });
}

/**
 * Updates a user profile, status, roles, or branch access inside a Serializable transaction.
 * Evaluates privilege ceilings and transaction-safe last super-admin protection.
 */
export async function updateUser(input: UpdateUserInput) {
  const actorPermissions = await getUserEffectivePermissions(input.actorUserId);
  const actorBranchScope = await getUserAuthorizedBranchScope(input.actorUserId);

  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });

  const isActorSuperAdmin = actorUser?.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );

  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      roleAssignments: { include: { role: true } },
      branchAccess: true,
    },
  });

  if (!targetUser) {
    throw new Error("Target user not found.");
  }

  // Self-elevation check
  const isSelfEdit = input.actorUserId === input.userId;

  if (isSelfEdit && !isActorSuperAdmin) {
    if (input.hasGlobalBranchAccess !== undefined && input.hasGlobalBranchAccess !== targetUser.hasGlobalBranchAccess) {
      throw new PrivilegeEscalationError("Cannot alter own global branch scope.");
    }
    if (input.roleIds !== undefined) {
      const currentRoleIds = targetUser.roleAssignments.map((ra) => ra.roleId);
      const isChangingRoles =
        input.roleIds.length !== currentRoleIds.length ||
        input.roleIds.some((id) => !currentRoleIds.includes(id));
      if (isChangingRoles) {
        throw new PrivilegeEscalationError("Users cannot alter their own assigned roles.");
      }
    }
  }

  // Permission Check
  if (!isActorSuperAdmin && !actorPermissions.has("users.update")) {
    throw new PrivilegeEscalationError("Permission 'users.update' required to update users.");
  }

  // Status Change Permission
  if (input.status !== undefined && input.status !== targetUser.status && !isActorSuperAdmin && !actorPermissions.has("users.disable")) {
    throw new PrivilegeEscalationError("Permission 'users.disable' required to alter user status.");
  }

  // Global Scope Ceiling
  if (input.hasGlobalBranchAccess && !actorBranchScope.global) {
    throw new PrivilegeEscalationError("Cannot grant global branch access without possessing global branch scope.");
  }

  // Branch Scope Ceiling
  if (!actorBranchScope.global && input.branchIds && input.branchIds.length > 0) {
    const invalidBranches = input.branchIds.filter((bId) => !actorBranchScope.branchIds.includes(bId));
    if (invalidBranches.length > 0) {
      throw new PrivilegeEscalationError(`Cannot assign unauthorized branches: ${invalidBranches.join(", ")}`);
    }
  }

  // Role Assignment Privilege Ceiling
  if (input.roleIds !== undefined) {
    if (!isActorSuperAdmin && !actorPermissions.has("users.assign_roles")) {
      throw new PrivilegeEscalationError("Permission 'users.assign_roles' required to assign roles.");
    }

    const requestedRoles = await prisma.roleProfile.findMany({
      where: { id: { in: input.roleIds } },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (requestedRoles.length !== new Set(input.roleIds).size) {
      throw new PrivilegeEscalationError("One or more requested roles do not exist.");
    }

    for (const r of requestedRoles) {
      if (r.isSuperAdminRole && !isActorSuperAdmin) {
        throw new PrivilegeEscalationError("Only Super Administrators can assign the Super Administrator role.");
      }

      if (!isActorSuperAdmin) {
        for (const rp of r.rolePermissions) {
          if (!actorPermissions.has(rp.permission.code)) {
            throw new PrivilegeEscalationError(
              `Cannot assign role '${r.name}' containing permission '${rp.permission.code}' which you do not possess.`
            );
          }
        }
      }
    }
  }

  // Serializable transaction for safety
  return await prisma.$transaction(
    async (tx) => {
      // Last Super Admin Protection
      const superAdminRole = await tx.roleProfile.findUnique({ where: { slug: "super_admin" } });

      if (superAdminRole) {
        const targetIsSuperAdmin = targetUser.roleAssignments.some(
          (ra) => ra.roleId === superAdminRole.id
        );

        const willBeSuperAdmin =
          input.roleIds !== undefined
            ? input.roleIds.includes(superAdminRole.id)
            : targetIsSuperAdmin;

        const willBeActive =
          input.status !== undefined ? input.status === "ACTIVE" : targetUser.status === "ACTIVE";

        const losesActiveSuperAdmin = targetIsSuperAdmin && targetUser.status === "ACTIVE" && (!willBeActive || !willBeSuperAdmin);

        if (losesActiveSuperAdmin) {
          const activeSuperAdminCount = await tx.userRoleAssignment.count({
            where: {
              roleId: superAdminRole.id,
              role: { status: "ACTIVE" },
              user: { status: "ACTIVE" },
            },
          });

          if (activeSuperAdminCount <= 1) {
            throw new LastSuperAdminProtectionError();
          }
        }
      }

      // Update basic fields
      const updateData: Prisma.UserUpdateInput = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.email !== undefined) updateData.email = input.email.toLowerCase().trim();
      if (input.password !== undefined && input.password.trim()) {
        updateData.passwordHash = await hash(input.password, 12);
      }
      if (input.status !== undefined) updateData.status = input.status;
      if (input.hasGlobalBranchAccess !== undefined) updateData.hasGlobalBranchAccess = input.hasGlobalBranchAccess;

      const updatedUser = await tx.user.update({
        where: { id: input.userId },
        data: updateData,
      });

      // Update Roles if provided
      if (input.roleIds !== undefined) {
        await tx.userRoleAssignment.deleteMany({ where: { userId: input.userId } });
        for (const rId of input.roleIds) {
          await tx.userRoleAssignment.create({
            data: { userId: input.userId, roleId: rId },
          });
        }
      }

      // Update Branch Access if provided
      if (input.branchIds !== undefined) {
        await tx.userBranchAccess.deleteMany({ where: { userId: input.userId } });
        for (const bId of input.branchIds) {
          await tx.userBranchAccess.create({
            data: { userId: input.userId, branchId: bId },
          });
        }
      }

      // Write Audit Log
      await logAuditEvent(
        {
          actorUserId: input.actorUserId,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: updatedUser.id,
          metadata: {
            statusBefore: targetUser.status,
            statusAfter: updatedUser.status,
            rolesUpdated: input.roleIds !== undefined,
            branchesUpdated: input.branchIds !== undefined,
            globalBranchAccessBefore: targetUser.hasGlobalBranchAccess,
            globalBranchAccessAfter: updatedUser.hasGlobalBranchAccess,
          },
        },
        tx
      );

      return updatedUser;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
