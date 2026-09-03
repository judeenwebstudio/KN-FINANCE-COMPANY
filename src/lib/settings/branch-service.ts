import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { z } from "zod";
import { BranchStatus } from "@/generated/prisma/client";

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
 * Retrieves all branches with associated entity counts.
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
          bankAccounts: true,
          treasuryAccounts: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

/**
 * Atomically creates a new operational branch and logs audit event.
 */
export async function createBranch(actorUserId: string, input: BranchInput) {
  const validated = branchInputSchema.parse(input);

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
      currency: validated.currency || "USD",
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
    },
  });

  return newBranch;
}

/**
 * Updates existing branch details cleanly.
 */
export async function updateBranch(actorUserId: string, branchId: string, input: BranchInput) {
  const validated = branchInputSchema.parse(input);

  const existingBranch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!existingBranch) {
    throw new BranchValidationError("Target branch does not exist.");
  }

  // If branch code changes, check uniqueness
  if (validated.code !== existingBranch.code) {
    const codeConflict = await prisma.branch.findUnique({ where: { code: validated.code } });
    if (codeConflict) {
      throw new BranchValidationError(`Branch code '${validated.code}' is already in use.`);
    }
  }

  // If email changes, check uniqueness
  if (validated.email !== existingBranch.email) {
    const emailConflict = await prisma.branch.findUnique({ where: { email: validated.email } });
    if (emailConflict) {
      throw new BranchValidationError(`Branch email '${validated.email}' is already in use.`);
    }
  }

  const updatedBranch = await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: validated.name,
      code: validated.code,
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
      previousCode: existingBranch.code,
    },
  });

  return updatedBranch;
}

/**
 * Safely toggles branch status between ACTIVE and INACTIVE.
 * Prevents deactivating the primary branch (HQ-01).
 */
export async function toggleBranchStatus(actorUserId: string, branchId: string, newStatus: BranchStatus) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    throw new BranchValidationError("Target branch does not exist.");
  }

  if (branch.code === "HQ-01" && newStatus === BranchStatus.INACTIVE) {
    throw new BranchValidationError("Primary Headquarters branch (HQ-01) cannot be deactivated.");
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
