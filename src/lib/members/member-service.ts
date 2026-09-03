import { hash } from "bcryptjs";
import { prisma } from "../prisma";
import {
  hasPermission,
  assertBranchAccess,
  getUserAuthorizedBranchScope,
  PermissionDeniedError,
} from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
import { Role, UserStatus } from "../../generated/prisma/client";

export type GetMembersParams = {
  search?: string;
  branchId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export type SafeMemberListItemDTO = {
  id: string;
  userId: string;
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string | null;
  identityNumber: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  status: UserStatus;
  accountsCount: number;
  loansCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GetMembersResult = {
  members: SafeMemberListItemDTO[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export type CreateMemberInput = {
  name: string;
  email: string;
  password?: string;
  phone: string;
  address: string;
  dateOfBirth?: string | null;
  identityNumber?: string | null;
  branchId: string;
};

export type UpdateMemberInput = {
  memberId: string;
  name: string;
  phone: string;
  address: string;
  dateOfBirth?: string | null;
  identityNumber?: string | null;
  status: UserStatus;
};

function generateSecureRandomPassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

/**
 * Generates a collision-safe member number under format MEM-YYYY-XXXX.
 * Executed inside transaction with retry capability.
 */
async function generateMemberNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MEM-${year}-`;

  const latestMember = await tx.memberProfile.findFirst({
    where: { memberNumber: { startsWith: prefix } },
    orderBy: { memberNumber: "desc" },
    select: { memberNumber: true },
  });

  let nextSeq = 1;
  if (latestMember && latestMember.memberNumber) {
    const parts = latestMember.memberNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

/**
 * Retrieves paginated, search-filtered member directory matching authorized branch scope.
 */
export async function getMembersList(
  executorUserId: string,
  params: GetMembersParams = {}
): Promise<GetMembersResult> {
  // 1. Enforce RBAC permission
  const allowed = await hasPermission(executorUserId, "members.view");
  if (!allowed) {
    throw new PermissionDeniedError("Required permission missing: members.view");
  }

  // 2. Resolve authorized branch scope
  const branchScope = await getUserAuthorizedBranchScope(executorUserId);
  if (!branchScope.global && branchScope.branchIds.length === 0) {
    return {
      members: [],
      pagination: { total: 0, page: 1, pageSize: params.pageSize || 10, totalPages: 0 },
    };
  }

  // Determine branch filter
  let targetBranchIds = branchScope.branchIds;
  if (params.branchId) {
    if (!branchScope.global && !branchScope.branchIds.includes(params.branchId)) {
      // Requested branch out of scope
      return {
        members: [],
        pagination: { total: 0, page: 1, pageSize: params.pageSize || 10, totalPages: 0 },
      };
    }
    targetBranchIds = [params.branchId];
  }

  // 3. Build Prisma query filters
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const search = params.search?.trim();
  const statusFilter = params.status as UserStatus | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    branchId: { in: targetBranchIds },
  };

  if (statusFilter && Object.values(UserStatus).includes(statusFilter)) {
    where.user = { status: statusFilter };
  }

  if (search) {
    where.OR = [
      { memberNumber: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { identityNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // 4. Execute queries
  const [total, records] = await Promise.all([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, status: true } },
        branch: { select: { name: true, code: true } },
        _count: { select: { accounts: true, loans: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const members: SafeMemberListItemDTO[] = records.map((m) => ({
    id: m.id,
    userId: m.userId,
    memberNumber: m.memberNumber,
    name: m.user.name,
    email: m.user.email,
    phone: m.phone,
    address: m.address,
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().split("T")[0] : null,
    identityNumber: m.identityNumber || null,
    branchId: m.branchId,
    branchName: m.branch.name,
    branchCode: m.branch.code,
    status: m.user.status,
    accountsCount: m._count.accounts,
    loansCount: m._count.loans,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return {
    members,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
  };
}

/**
 * Creates a new Member Profile + User account atomically.
 */
export async function createMember(
  executorUserId: string,
  input: CreateMemberInput
): Promise<{ member: SafeMemberListItemDTO; generatedPassword?: string }> {
  // 1. RBAC & Branch Scope checks
  const canCreate = await hasPermission(executorUserId, "members.create");
  if (!canCreate) {
    throw new PermissionDeniedError("Required permission missing: members.create");
  }
  await assertBranchAccess(executorUserId, input.branchId);

  // 2. Validate input fields
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const identityNumber = input.identityNumber?.trim() || null;
  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

  if (!name) throw new Error("Member full name is required.");
  if (!email || !email.includes("@")) throw new Error("Valid email address is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!address) throw new Error("Residential address is required.");

  // Check unique email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error(`Email address '${email}' is already registered.`);
  }

  // Check unique identity number if provided
  if (identityNumber) {
    const existingIdentity = await prisma.memberProfile.findUnique({ where: { identityNumber } });
    if (existingIdentity) {
      throw new Error(`Identity number '${identityNumber}' is already registered to another member.`);
    }
  }

  // Determine credential password
  let plainPassword = input.password?.trim();
  let generatedPassword: string | undefined = undefined;
  if (!plainPassword) {
    plainPassword = generateSecureRandomPassword();
    generatedPassword = plainPassword;
  } else if (plainPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const passwordHash = await hash(plainPassword, 12);

  // 3. Execute Atomic Prisma Transaction with memberNumber retry loop
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const memberNumber = await generateMemberNumber(tx);

        // Create User
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: Role.MEMBER,
            status: UserStatus.ACTIVE,
            branchId: input.branchId,
            hasGlobalBranchAccess: false,
          },
        });

        // Create MemberProfile
        const profile = await tx.memberProfile.create({
          data: {
            userId: user.id,
            memberNumber,
            branchId: input.branchId,
            phone,
            address,
            dateOfBirth,
            identityNumber,
          },
          include: {
            user: { select: { name: true, email: true, status: true } },
            branch: { select: { name: true, code: true } },
            _count: { select: { accounts: true, loans: true } },
          },
        });

        // Audit Log (Sanitized)
        await logAuditEvent(
          {
            actorUserId: executorUserId,
            action: "member.create",
            entityType: "MemberProfile",
            entityId: profile.id,
            branchId: input.branchId,
            metadata: {
              memberNumber,
              email,
              name,
              branchId: input.branchId,
              hasIdentityNumber: Boolean(identityNumber),
            },
          },
          tx
        );

        return profile;
      });

      const memberDto: SafeMemberListItemDTO = {
        id: result.id,
        userId: result.userId,
        memberNumber: result.memberNumber,
        name: result.user.name,
        email: result.user.email,
        phone: result.phone,
        address: result.address,
        dateOfBirth: result.dateOfBirth ? result.dateOfBirth.toISOString().split("T")[0] : null,
        identityNumber: result.identityNumber || null,
        branchId: result.branchId,
        branchName: result.branch.name,
        branchCode: result.branch.code,
        status: result.user.status,
        accountsCount: result._count.accounts,
        loansCount: result._count.loans,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };

      return { member: memberDto, generatedPassword };
    } catch (err: unknown) {
      const isPrismaUnique = (err as { code?: string })?.code === "P2002";
      if (isPrismaUnique && attempts < maxAttempts) {
        // Unique constraint race condition retry
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to generate a unique member number. Please try again.");
}

/**
 * Updates editable fields of an existing Member Profile & User status.
 */
export async function updateMember(
  executorUserId: string,
  input: UpdateMemberInput
): Promise<SafeMemberListItemDTO> {
  // 1. Permission check
  const canEdit = await hasPermission(executorUserId, "members.edit");
  if (!canEdit) {
    throw new PermissionDeniedError("Required permission missing: members.edit");
  }

  // 2. Fetch existing member
  const existing = await prisma.memberProfile.findUnique({
    where: { id: input.memberId },
    include: { user: true, branch: true },
  });

  if (!existing) {
    throw new Error(`Member with ID '${input.memberId}' not found.`);
  }

  // Enforce branch scope
  await assertBranchAccess(executorUserId, existing.branchId);

  // 3. Validate editable fields
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const identityNumber = input.identityNumber?.trim() || null;
  const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  const status = input.status;

  if (!name) throw new Error("Member full name is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!address) throw new Error("Residential address is required.");
  if (!Object.values(UserStatus).includes(status)) {
    throw new Error("Invalid member status value.");
  }

  // Check unique identity number if modified
  if (identityNumber && identityNumber !== existing.identityNumber) {
    const duplicateIdentity = await prisma.memberProfile.findUnique({
      where: { identityNumber },
    });
    if (duplicateIdentity && duplicateIdentity.id !== existing.id) {
      throw new Error(`Identity number '${identityNumber}' is already registered to another member.`);
    }
  }

  // 4. Execute Atomic Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update User
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        name,
        status,
      },
    });

    // Update MemberProfile
    const updatedProfile = await tx.memberProfile.update({
      where: { id: existing.id },
      data: {
        phone,
        address,
        dateOfBirth,
        identityNumber,
      },
      include: {
        user: { select: { name: true, email: true, status: true } },
        branch: { select: { name: true, code: true } },
        _count: { select: { accounts: true, loans: true } },
      },
    });

    // Audit Log
    const statusChanged = status !== existing.user.status;
    await logAuditEvent(
      {
        actorUserId: executorUserId,
        action: statusChanged ? "member.status.change" : "member.update",
        entityType: "MemberProfile",
        entityId: updatedProfile.id,
        branchId: existing.branchId,
        metadata: {
          memberNumber: existing.memberNumber,
          previousStatus: existing.user.status,
          newStatus: status,
          updatedFields: {
            name: name !== existing.user.name,
            phone: phone !== existing.phone,
            address: address !== existing.address,
            dateOfBirth: dateOfBirth?.toISOString() !== existing.dateOfBirth?.toISOString(),
            identityNumber: identityNumber !== existing.identityNumber,
          },
        },
      },
      tx
    );

    return updatedProfile;
  });

  return {
    id: result.id,
    userId: result.userId,
    memberNumber: result.memberNumber,
    name: result.user.name,
    email: result.user.email,
    phone: result.phone,
    address: result.address,
    dateOfBirth: result.dateOfBirth ? result.dateOfBirth.toISOString().split("T")[0] : null,
    identityNumber: result.identityNumber || null,
    branchId: result.branchId,
    branchName: result.branch.name,
    branchCode: result.branch.code,
    status: result.user.status,
    accountsCount: result._count.accounts,
    loansCount: result._count.loans,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
