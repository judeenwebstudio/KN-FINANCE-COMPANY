import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { z } from "zod";
import { BranchStatus, LoanStatus } from "@/generated/prisma/client";

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required").max(100),
  code: z.string().trim().min(2, "Branch code is required").max(20).toUpperCase(),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().min(5, "Phone number is required"),
  address: z.string().trim().min(3, "Address is required"),
  city: z.string().trim().min(2, "City is required"),
  state: z.string().trim().min(2, "State is required"),
  country: z.string().trim().min(2, "Country is required"),
  currency: z.string().trim().default("USD"),
});

export type BranchInput = z.infer<typeof branchInputSchema>;

export class BranchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranchValidationError";
  }
}

/**
 * Retrieves all branches with associated operational entity counts.
 */
export async function getAllBranchesWithCounts() {
  return await prisma.branch.findMany({
    include: {
      _count: {
        select: {
          users: true,
          members: true,
          accounts: true,
          loans: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

/**
 * Atomically creates a new operational branch and logs audit event.
 * Enforces single-currency USD system rule.
 */
export async function createBranch(actorUserId: string, input: BranchInput) {
  const validated = branchInputSchema.parse(input);

  // Enforce single-currency USD system
  if (validated.currency !== "USD") {
    throw new BranchValidationError(`KN Finance Company operates exclusively on USD. Branch currency '${validated.currency}' is invalid.`);
  }

  // Uniqueness check for branch code & email
  const existingCode = await prisma.branch.findUnique({ where: { code: validated.code } });
  if (existingCode) {
    throw new BranchValidationError(`Branch code '${validated.code}' is already in use.`);
  }

  const existingEmail = await prisma.branch.findUnique({ where: { email: validated.email } });
  if (existingEmail) {
    throw new BranchValidationError(`Branch email '${validated.email}' is already in use.`);
  }

  const newBranch = await prisma.branch.create({
    data: {
      name: validated.name,
      code: validated.code,
      email: validated.email,
      phone: validated.phone,
      address: validated.address,
      city: validated.city,
      state: validated.state,
      country: validated.country,
      currency: "USD",
      status: BranchStatus.ACTIVE,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "branch.create",
    entityType: "Branch",
    entityId: newBranch.id,
    metadata: {
      code: newBranch.code,
      name: newBranch.name,
      currency: newBranch.currency,
      city: newBranch.city,
      country: newBranch.country,
    },
  });

  return newBranch;
}

/**
 * Updates existing branch details cleanly.
 * Enforces Branch Code IMMUTABILITY after creation.
 */
export async function updateBranch(actorUserId: string, branchId: string, input: BranchInput) {
  const validated = branchInputSchema.parse(input);

  const existingBranch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!existingBranch) {
    throw new BranchValidationError("Target branch does not exist.");
  }

  // Enforce Branch Code IMMUTABILITY
  if (validated.code !== existingBranch.code) {
    throw new BranchValidationError(
      `Branch code '${existingBranch.code}' is immutable after creation and cannot be changed.`
    );
  }

  // If email changes, check uniqueness
  if (validated.email !== existingBranch.email) {
    const emailConflict = await prisma.branch.findUnique({ where: { email: validated.email } });
    if (emailConflict) {
      throw new BranchValidationError(`Branch email '${validated.email}' is already in use.`);
    }
  }

  // Compute detailed before/after audit changes
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (existingBranch.name !== validated.name) changes.name = { from: existingBranch.name, to: validated.name };
  if (existingBranch.email !== validated.email) changes.email = { from: existingBranch.email, to: validated.email };
  if (existingBranch.phone !== validated.phone) changes.phone = { from: existingBranch.phone, to: validated.phone };
  if (existingBranch.address !== validated.address) changes.address = { from: existingBranch.address, to: validated.address };
  if (existingBranch.city !== validated.city) changes.city = { from: existingBranch.city, to: validated.city };
  if (existingBranch.state !== validated.state) changes.state = { from: existingBranch.state, to: validated.state };
  if (existingBranch.country !== validated.country) changes.country = { from: existingBranch.country, to: validated.country };

  const updatedBranch = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: validated.name,
      email: validated.email,
      phone: validated.phone,
      address: validated.address,
      city: validated.city,
      state: validated.state,
      country: validated.country,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "branch.update",
    entityType: "Branch",
    entityId: updatedBranch.id,
    metadata: {
      code: updatedBranch.code,
      name: updatedBranch.name,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    },
  });

  return updatedBranch;
}

/**
 * Safely toggles branch status between ACTIVE and INACTIVE.
 * Protects Headquarters anchor and checks active operational dependencies before deactivating.
 */
export async function toggleBranchStatus(actorUserId: string, branchId: string, newStatus: BranchStatus) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    throw new BranchValidationError("Target branch does not exist.");
  }

  // Headquarters protection invariant
  if (branch.code === "HQ-01" && newStatus === BranchStatus.INACTIVE) {
    throw new BranchValidationError("Primary Headquarters branch (HQ-01) is the system anchor and cannot be deactivated.");
  }

  // If deactivating, check active operational dependencies
  if (newStatus === BranchStatus.INACTIVE) {
    const activeUsers = await prisma.user.count({ where: { branchId, status: "ACTIVE" } });
    const activeAccounts = await prisma.account.count({ where: { branchId, status: "ACTIVE" } });
    const activeLoans = await prisma.loan.count({ where: { branchId, status: { in: [LoanStatus.APPROVED, LoanStatus.ACTIVE] } } });

    if (activeUsers > 0 || activeAccounts > 0 || activeLoans > 0) {
      throw new BranchValidationError(
        `Cannot deactivate branch '${branch.name}' (${branch.code}) with active operational dependencies (${activeUsers} active users, ${activeAccounts} active accounts, ${activeLoans} active loans). Reassign or close active entities before deactivating.`
      );
    }
  }

  const updatedBranch = await prisma.branch.update({
    where: { id: branchId },
    data: { status: newStatus },
  });

  await logAuditEvent({
    actorUserId,
    action: newStatus === BranchStatus.ACTIVE ? "branch.activate" : "branch.deactivate",
    entityType: "Branch",
    entityId: updatedBranch.id,
    metadata: {
      code: updatedBranch.code,
      name: updatedBranch.name,
      newStatus,
    },
  });

  return updatedBranch;
}
