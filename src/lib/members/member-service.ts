import { hash } from "bcryptjs";
import { prisma } from "../prisma";
import {
  hasPermission,
  assertBranchAccess,
  getUserAuthorizedBranchScope,
  PermissionDeniedError,
} from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
import { createNotification } from "../notifications/notification-service";
import { Role, UserStatus, AccountStatus, LoanStatus, RepaymentScheduleStatus, Prisma } from "../../generated/prisma/client";

export type GetMembersParams = {
  search?: string;
  branchId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Privacy-minimized DTO for directory list rendering.
 * Does NOT contain passwordHash, unmasked identityNumber, or dateOfBirth.
 */
export type SafeMemberListItemDTO = {
  id: string;
  userId: string;
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  maskedIdentityNumber: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  status: UserStatus;
  accountsCount: number;
  loansCount: number;
  createdAt: string;
  updatedAt: string;
  photoUrl: string | null;
};

/**
 * Authorized Detail DTO for editing member details.
 * Exposed ONLY to authorized users with `members.edit` within authorized branch scope.
 */
export type SafeMemberDetailDTO = {
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
  password: string; // Required explicit password (min 8 chars)
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

/* Member 360° Profile DTO Specifications */

export type Member360AccountDTO = {
  id: string;
  accountNumber: string;
  accountType: string;
  accountTypeName: string | null;
  currency: string;
  balance: string;
  loanGuarantee: string;
  status: string;
  createdAt: string;
};

export type Member360LoanDTO = {
  id: string;
  loanNumber: string;
  productName: string | null;
  productCode: string | null;
  currency: string;
  principalAmount: string;
  approvedAmount: string | null;
  paidAmount: string;
  outstandingAmount: string;
  interestRate: number;
  interestType: string;
  termMonths: number;
  repaymentFrequency: string;
  status: string;
  applicationDate: string;
  disbursementDate: string | null;
  maturityDate: string | null;
  overdueDays: number;
  overdueAmount: string;
};

export type Member360RepaymentDTO = {
  id: string;
  repaymentNumber: string;
  loanId: string;
  loanNumber: string;
  accountId: string;
  accountNumber: string;
  amount: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  penaltyAmount: string;
  paymentDate: string;
  status: string;
  reference: string | null;
  notes: string | null;
};

export type Member360RepaymentScheduleDTO = {
  id: string;
  loanId: string;
  loanNumber: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  feeDue: string;
  penaltyDue: string;
  totalDue: string;
  principalPaid: string;
  interestPaid: string;
  feePaid: string;
  penaltyPaid: string;
  totalPaid: string;
  status: string;
  overdueDays: number;
  paidAt: string | null;
};

export type Member360TransactionDTO = {
  id: string;
  accountId: string | null;
  accountNumber: string | null;
  type: string;
  amount: string;
  currency: string;
  reference: string;
  description: string | null;
  status: string;
  createdAt: string;
};

export type Member360DepositRequestDTO = {
  id: string;
  requestNumber: string;
  accountId: string;
  accountNumber: string;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
};

export type Member360WithdrawalRequestDTO = {
  id: string;
  requestNumber: string;
  accountId: string;
  accountNumber: string;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
};

export type Member360CollectionNoteDTO = {
  id: string;
  loanId: string;
  loanNumber: string;
  actionType: string;
  notes: string;
  actionDate: string;
  followUpDate: string | null;
  promiseToPayAmount: string | null;
  promiseToPayDate: string | null;
  createdBy: string | null;
};

export type Member360ProfileDTO = {
  header: {
    id: string;
    memberNumber: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    dateOfBirth: string | null;
    maskedIdentityNumber: string | null;
    branchId: string;
    branchName: string;
    branchCode: string;
    currency: string;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalAccounts: number;
    activeAccounts: number;
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    totalAccountBalance: string;
    totalLoanPrincipalOutstanding: string;
  };
  accounts: Member360AccountDTO[];
  loans: Member360LoanDTO[];
  repayments: Member360RepaymentDTO[];
  schedules: Member360RepaymentScheduleDTO[];
  transactions: {
    items: Member360TransactionDTO[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
  depositRequests: Member360DepositRequestDTO[];
  withdrawalRequests: Member360WithdrawalRequestDTO[];
  collectionNotes: Member360CollectionNoteDTO[];
};

/**
 * Server-side privacy utility to mask identity numbers (shows only last 4 digits).
 */
export function maskIdentityNumber(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••-${trimmed.slice(-4)}`;
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
 * Returned DTO is strictly privacy-minimized (masked identity number, DOB omitted, zero credentials).
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

  // 4. Execute queries with authoritative ACTIVE account and loan counts
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
        _count: {
          select: {
            accounts: { where: { status: AccountStatus.ACTIVE } },
            loans: { where: { status: LoanStatus.ACTIVE } },
          },
        },
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
    maskedIdentityNumber: maskIdentityNumber(m.identityNumber),
    branchId: m.branchId,
    branchName: m.branch.name,
    branchCode: m.branch.code,
    status: m.user.status,
    accountsCount: m._count.accounts,
    loansCount: m._count.loans,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    photoUrl: m.photoStorageKey ? `/api/member-photo/${m.id}` : null,
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
 * Fetches detail DTO for editing an existing member.
 * Requires `members.edit` and branch scope authorization.
 */
export async function getMemberForEdit(
  executorUserId: string,
  memberId: string
): Promise<SafeMemberDetailDTO> {
  const allowed = await hasPermission(executorUserId, "members.edit");
  if (!allowed) {
    throw new PermissionDeniedError("Required permission missing: members.edit");
  }

  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { name: true, email: true, status: true } },
      branch: { select: { name: true, code: true } },
    },
  });

  if (!member) {
    throw new Error(`Member with ID '${memberId}' not found.`);
  }

  await assertBranchAccess(executorUserId, member.branchId);

  return {
    id: member.id,
    userId: member.userId,
    memberNumber: member.memberNumber,
    name: member.user.name,
    email: member.user.email,
    phone: member.phone,
    address: member.address,
    dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString().split("T")[0] : null,
    identityNumber: member.identityNumber || null,
    branchId: member.branchId,
    branchName: member.branch.name,
    branchCode: member.branch.code,
    status: member.user.status,
  };
}

/**
 * Authoritative Member 360° Profile read service.
 * Enforces relational RBAC (`members.view`) and strict branch scope authorization.
 * Returns consolidated, safe, fully serialized DTOs for client rendering.
 */
export async function getMember360Profile(
  executorUserId: string,
  memberId: string,
  options?: { txPage?: number; txPageSize?: number }
): Promise<Member360ProfileDTO> {
  // 1. RBAC Check
  const allowed = await hasPermission(executorUserId, "members.view");
  if (!allowed) {
    throw new PermissionDeniedError("Required permission missing: members.view");
  }

  // 2. Fetch member profile record & branch authorization
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { name: true, email: true, status: true } },
      branch: { select: { name: true, code: true, currency: true } },
    },
  });

  if (!member) {
    throw new Error(`Member with ID '${memberId}' not found.`);
  }

  await assertBranchAccess(executorUserId, member.branchId);

  // 3. Pagination setup for bounded transaction history
  const txPage = Math.max(1, options?.txPage || 1);
  const txPageSize = Math.min(50, Math.max(1, options?.txPageSize || 10));
  const txSkip = (txPage - 1) * txPageSize;

  // 4. Fetch all linked domain records in parallel
  const [
    accountsRecords,
    loansRecords,
    repaymentsRecords,
    txTotal,
    txRecords,
    depositRequestRecords,
    withdrawalRequestRecords,
    collectionNoteRecords,
  ] = await Promise.all([
    // Accounts
    prisma.account.findMany({
      where: { memberId },
      include: { accountTypePolicy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Loans with schedules
    prisma.loan.findMany({
      where: { memberId },
      include: {
        product: { select: { name: true, code: true } },
        repaymentSchedules: {
          orderBy: { installmentNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Repayments
    prisma.loanRepayment.findMany({
      where: { memberId },
      take: 20,
      include: {
        loan: { select: { loanNumber: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { paymentDate: "desc" },
    }),
    // Bounded transactions count & list
    prisma.transaction.count({ where: { memberId } }),
    prisma.transaction.findMany({
      where: { memberId },
      skip: txSkip,
      take: txPageSize,
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Deposit Requests
    prisma.depositRequest.findMany({
      where: { memberId },
      take: 20,
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Withdrawal Requests
    prisma.withdrawalRequest.findMany({
      where: { memberId },
      take: 20,
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Collection Notes
    prisma.collectionNote.findMany({
      where: { memberId },
      take: 20,
      include: {
        loan: { select: { loanNumber: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { actionDate: "desc" },
    }),
  ]);

  // 5. Authoritative Money & Summary Calculations using Prisma Decimal
  let totalAccountBalanceDecimal = new Prisma.Decimal(0);
  let activeAccountsCount = 0;

  const accountsDTO: Member360AccountDTO[] = accountsRecords.map((acc) => {
    if (acc.status === AccountStatus.ACTIVE) {
      activeAccountsCount++;
      totalAccountBalanceDecimal = totalAccountBalanceDecimal.add(acc.balance);
    } else if (acc.status === AccountStatus.FROZEN) {
      totalAccountBalanceDecimal = totalAccountBalanceDecimal.add(acc.balance);
    }

    return {
      id: acc.id,
      accountNumber: acc.accountNumber,
      accountType: acc.accountType,
      accountTypeName: acc.accountTypePolicy?.name || null,
      currency: acc.currency,
      balance: acc.balance.toFixed(2),
      loanGuarantee: acc.loanGuarantee.toFixed(2),
      status: acc.status,
      createdAt: acc.createdAt.toISOString(),
    };
  });

  let totalLoanOutstandingDecimal = new Prisma.Decimal(0);
  let activeLoansCount = 0;
  let overdueLoansCount = 0;

  const allSchedulesDTO: Member360RepaymentScheduleDTO[] = [];

  const loansDTO: Member360LoanDTO[] = loansRecords.map((loan) => {
    const baseAmount = loan.approvedAmount && loan.approvedAmount.gt(0) ? loan.approvedAmount : loan.principalAmount;
    const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), baseAmount.sub(loan.paidAmount));

    if (loan.status === LoanStatus.ACTIVE) {
      activeLoansCount++;
      totalLoanOutstandingDecimal = totalLoanOutstandingDecimal.add(outstanding);
    } else if (loan.status === LoanStatus.DEFAULTED) {
      totalLoanOutstandingDecimal = totalLoanOutstandingDecimal.add(outstanding);
    }

    let maxOverdueDays = 0;
    let loanOverdueAmountDecimal = new Prisma.Decimal(0);
    let isLoanOverdue = loan.status === LoanStatus.DEFAULTED;

    loan.repaymentSchedules.forEach((sch) => {
      if (sch.overdueDays > maxOverdueDays) {
        maxOverdueDays = sch.overdueDays;
      }
      if (sch.status === RepaymentScheduleStatus.OVERDUE || (sch.overdueDays > 0 && sch.status !== RepaymentScheduleStatus.PAID)) {
        isLoanOverdue = true;
        const schOverdue = Prisma.Decimal.max(new Prisma.Decimal(0), sch.totalDue.sub(sch.totalPaid));
        loanOverdueAmountDecimal = loanOverdueAmountDecimal.add(schOverdue);
      }

      allSchedulesDTO.push({
        id: sch.id,
        loanId: sch.loanId,
        loanNumber: loan.loanNumber,
        installmentNumber: sch.installmentNumber,
        dueDate: sch.dueDate.toISOString(),
        principalDue: sch.principalDue.toFixed(2),
        interestDue: sch.interestDue.toFixed(2),
        feeDue: sch.feeDue.toFixed(2),
        penaltyDue: sch.penaltyDue.toFixed(2),
        totalDue: sch.totalDue.toFixed(2),
        principalPaid: sch.principalPaid.toFixed(2),
        interestPaid: sch.interestPaid.toFixed(2),
        feePaid: sch.feePaid.toFixed(2),
        penaltyPaid: sch.penaltyPaid.toFixed(2),
        totalPaid: sch.totalPaid.toFixed(2),
        status: sch.status,
        overdueDays: sch.overdueDays,
        paidAt: sch.paidAt ? sch.paidAt.toISOString() : null,
      });
    });

    if (isLoanOverdue) {
      overdueLoansCount++;
    }

    return {
      id: loan.id,
      loanNumber: loan.loanNumber,
      productName: loan.product?.name || null,
      productCode: loan.product?.code || null,
      currency: loan.currency,
      principalAmount: loan.principalAmount.toFixed(2),
      approvedAmount: loan.approvedAmount ? loan.approvedAmount.toFixed(2) : null,
      paidAmount: loan.paidAmount.toFixed(2),
      outstandingAmount: outstanding.toFixed(2),
      interestRate: loan.interestRate.toNumber(),
      interestType: loan.interestType,
      termMonths: loan.termMonths,
      repaymentFrequency: loan.repaymentFrequency,
      status: loan.status,
      applicationDate: loan.applicationDate.toISOString(),
      disbursementDate: loan.disbursementDate ? loan.disbursementDate.toISOString() : null,
      maturityDate: loan.maturityDate ? loan.maturityDate.toISOString() : null,
      overdueDays: maxOverdueDays,
      overdueAmount: loanOverdueAmountDecimal.toFixed(2),
    };
  });

  const repaymentsDTO: Member360RepaymentDTO[] = repaymentsRecords.map((rep) => ({
    id: rep.id,
    repaymentNumber: rep.repaymentNumber,
    loanId: rep.loanId,
    loanNumber: rep.loan.loanNumber,
    accountId: rep.accountId,
    accountNumber: rep.account.accountNumber,
    amount: rep.amount.toFixed(2),
    principalAmount: rep.principalAmount.toFixed(2),
    interestAmount: rep.interestAmount.toFixed(2),
    feeAmount: rep.feeAmount.toFixed(2),
    penaltyAmount: rep.penaltyAmount.toFixed(2),
    paymentDate: rep.paymentDate.toISOString(),
    status: rep.status,
    reference: rep.reference || null,
    notes: rep.notes || null,
  }));

  const transactionsDTO: Member360TransactionDTO[] = txRecords.map((tx) => ({
    id: tx.id,
    accountId: tx.accountId,
    accountNumber: tx.account?.accountNumber || null,
    type: tx.type,
    amount: tx.amount.toFixed(2),
    currency: tx.currency,
    reference: tx.reference,
    description: tx.description || null,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  }));

  const depositRequestsDTO: Member360DepositRequestDTO[] = depositRequestRecords.map((dr) => ({
    id: dr.id,
    requestNumber: dr.requestNumber,
    accountId: dr.accountId,
    accountNumber: dr.account.accountNumber,
    amount: dr.amount.toFixed(2),
    currency: dr.currency,
    paymentMethod: dr.paymentMethod || null,
    reference: dr.reference || null,
    status: dr.status,
    createdAt: dr.createdAt.toISOString(),
  }));

  const withdrawalRequestsDTO: Member360WithdrawalRequestDTO[] = withdrawalRequestRecords.map((wr) => ({
    id: wr.id,
    requestNumber: wr.requestNumber,
    accountId: wr.accountId,
    accountNumber: wr.account.accountNumber,
    amount: wr.amount.toFixed(2),
    currency: wr.currency,
    paymentMethod: wr.paymentMethod || null,
    reference: wr.reference || null,
    status: wr.status,
    createdAt: wr.createdAt.toISOString(),
  }));

  const collectionNotesDTO: Member360CollectionNoteDTO[] = collectionNoteRecords.map((cn) => ({
    id: cn.id,
    loanId: cn.loanId,
    loanNumber: cn.loan.loanNumber,
    actionType: cn.actionType,
    notes: cn.notes,
    actionDate: cn.actionDate.toISOString(),
    followUpDate: cn.followUpDate ? cn.followUpDate.toISOString() : null,
    promiseToPayAmount: cn.promiseToPayAmount ? cn.promiseToPayAmount.toFixed(2) : null,
    promiseToPayDate: cn.promiseToPayDate ? cn.promiseToPayDate.toISOString() : null,
    createdBy: cn.createdBy?.name || null,
  }));

  const txTotalPages = Math.ceil(txTotal / txPageSize);

  return {
    header: {
      id: member.id,
      memberNumber: member.memberNumber,
      name: member.user.name,
      email: member.user.email,
      phone: member.phone,
      address: member.address,
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.toISOString().split("T")[0] : null,
      maskedIdentityNumber: maskIdentityNumber(member.identityNumber),
      branchId: member.branchId,
      branchName: member.branch.name,
      branchCode: member.branch.code,
      currency: member.branch.currency,
      status: member.user.status,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    },
    summary: {
      totalAccounts: accountsRecords.length,
      activeAccounts: activeAccountsCount,
      totalLoans: loansRecords.length,
      activeLoans: activeLoansCount,
      overdueLoans: overdueLoansCount,
      totalAccountBalance: totalAccountBalanceDecimal.toFixed(2),
      totalLoanPrincipalOutstanding: totalLoanOutstandingDecimal.toFixed(2),
    },
    accounts: accountsDTO,
    loans: loansDTO,
    repayments: repaymentsDTO,
    schedules: allSchedulesDTO,
    transactions: {
      items: transactionsDTO,
      pagination: {
        total: txTotal,
        page: txPage,
        pageSize: txPageSize,
        totalPages: txTotalPages,
      },
    },
    depositRequests: depositRequestsDTO,
    withdrawalRequests: withdrawalRequestsDTO,
    collectionNotes: collectionNotesDTO,
  };
}

/**
 * Creates a new Member Profile + User account atomically.
 * Requires explicit initial password (minimum 8 characters).
 */
export async function createMember(
  executorUserId: string,
  input: CreateMemberInput
): Promise<SafeMemberListItemDTO> {
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
  const plainPassword = input.password?.trim();

  if (!name) throw new Error("Member full name is required.");
  if (!email || !email.includes("@")) throw new Error("Valid email address is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!address) throw new Error("Residential address is required.");
  if (!plainPassword || plainPassword.length < 8) {
    throw new Error("Initial password is required and must be at least 8 characters long.");
  }

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
            _count: {
              select: {
                accounts: { where: { status: AccountStatus.ACTIVE } },
                loans: { where: { status: LoanStatus.ACTIVE } },
              },
            },
          },
        });

        // Audit Log (Sanitized - NO plaintext passwords, hashes, or full identity numbers)
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

      createNotification({
        userId: result.userId,
        eventKey: "MEMBER_WELCOME",
        title: "Welcome to KN Finance",
        message: `Your member profile (${result.memberNumber}) has been registered successfully.`,
        targetUrl: "/member/profile",
      }).catch(() => {});

      return {
        id: result.id,
        userId: result.userId,
        memberNumber: result.memberNumber,
        name: result.user.name,
        email: result.user.email,
        phone: result.phone,
        address: result.address,
        maskedIdentityNumber: maskIdentityNumber(result.identityNumber),
        branchId: result.branchId,
        branchName: result.branch.name,
        branchCode: result.branch.code,
        status: result.user.status,
        accountsCount: result._count.accounts,
        loansCount: result._count.loans,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        photoUrl: result.photoStorageKey ? `/api/member-photo/${result.id}` : null,
      };
    } catch (err: unknown) {
      const isPrismaUnique = (err as { code?: string })?.code === "P2002";
      if (isPrismaUnique && attempts < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to generate a unique member number. Please try again.");
}

/**
 * Updates editable fields of an existing Member Profile & User status.
 * Audit metadata strictly protects PII (records identityNumberUpdated boolean, never raw identity string).
 */
export async function updateMember(
  executorUserId: string,
  input: UpdateMemberInput
): Promise<SafeMemberDetailDTO> {
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
      },
    });

    // Audit Log (PII Protected: boolean flags only, NO identityNumber strings)
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
            dateOfBirthChanged: dateOfBirth?.toISOString() !== existing.dateOfBirth?.toISOString(),
            identityNumberChanged: identityNumber !== existing.identityNumber,
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
  };
}

/**
 * Purges an empty member profile and user account (Super Admin ONLY).
 * Strictly verifies ZERO linked financial or operational records across all 7 relations before proceeding.
 */
export async function purgeEmptyMember(
  executorUserId: string,
  memberId: string
): Promise<{ success: true; purgedMemberNumber: string }> {
  const user = await prisma.user.findUnique({
    where: { id: executorUserId },
    include: { roleAssignments: { include: { role: true } } },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new PermissionDeniedError("Account is inactive or suspended.");
  }
  const isSuperAdmin = user.roleAssignments.some(
    (ra) => ra.role.status === "ACTIVE" && ra.role.isSuperAdminRole
  );
  if (!isSuperAdmin) {
    throw new PermissionDeniedError("Super Admin privileges required to purge empty member records.");
  }

  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { name: true, email: true } },
      _count: {
        select: {
          accounts: true,
          loans: true,
          repayments: true,
          transactions: true,
          depositRequests: true,
          withdrawalRequests: true,
          collectionNotes: true,
          documents: true,
          customFieldValues: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error(`Member with ID '${memberId}' not found.`);
  }

  const notificationCount = await prisma.notification.count({
    where: { userId: member.userId },
  });

  const counts = member._count;
  const totalLinkedRecords =
    counts.accounts +
    counts.loans +
    counts.repayments +
    counts.transactions +
    counts.depositRequests +
    counts.withdrawalRequests +
    counts.collectionNotes +
    counts.documents +
    counts.customFieldValues +
    notificationCount;

  if (totalLinkedRecords > 0) {
    throw new Error(
      `Cannot purge member '${member.memberNumber}': Member has ${totalLinkedRecords} linked financial or operational records.`
    );
  }

  const purgedMemberNumber = member.memberNumber;

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.delete({ where: { id: member.id } });
    await tx.user.delete({ where: { id: member.userId } });

    await logAuditEvent(
      {
        actorUserId: executorUserId,
        action: "MEMBER_PURGED",
        entityType: "MemberProfile",
        entityId: member.id,
        metadata: {
          purgedMemberNumber,
          memberName: member.user.name,
          memberEmail: member.user.email,
        },
      },
      tx
    );
  });

  return { success: true, purgedMemberNumber };
}

export type BulkImportResult = {
  totalProcessed: number;
  successfulCount: number;
  failedCount: number;
  importedMembers: Array<{ memberNumber: string; name: string; email: string }>;
  errors: Array<{ row: number; email: string; error: string }>;
};

/**
 * Bulk imports members from structured CSV input rows within an authorized branch.
 */
export async function bulkImportMembers(
  executorUserId: string,
  branchId: string,
  rows: Array<{ name: string; email: string; phone: string; address: string; identityNumber?: string }>
): Promise<BulkImportResult> {
  const allowed = await hasPermission(executorUserId, "members.create");
  if (!allowed) {
    throw new PermissionDeniedError("Required permission missing: members.create");
  }

  await assertBranchAccess(executorUserId, branchId);

  const errors: Array<{ row: number; email: string; error: string }> = [];
  const validRowsToProcess: Array<{
    rowNumber: number;
    name: string;
    email: string;
    phone: string;
    address: string;
    identityNumber?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, email: row.email || "", error: "Name is required." });
      continue;
    }
    if (!row.email || !row.email.includes("@")) {
      errors.push({ row: rowNum, email: row.email || "", error: "Valid email is required." });
      continue;
    }
    if (!row.phone || !row.phone.trim()) {
      errors.push({ row: rowNum, email: row.email, error: "Phone number is required." });
      continue;
    }
    if (!row.address || !row.address.trim()) {
      errors.push({ row: rowNum, email: row.email, error: "Address is required." });
      continue;
    }
    validRowsToProcess.push({
      rowNumber: rowNum,
      name: row.name.trim(),
      email: row.email.trim().toLowerCase(),
      phone: row.phone.trim(),
      address: row.address.trim(),
      identityNumber: row.identityNumber?.trim() || undefined,
    });
  }

  const emailsToCheck = validRowsToProcess.map((r) => r.email);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emailsToCheck } },
    select: { email: true },
  });
  const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const importedMembers: Array<{ memberNumber: string; name: string; email: string }> = [];

  for (const item of validRowsToProcess) {
    if (existingEmailSet.has(item.email)) {
      errors.push({ row: item.rowNumber, email: item.email, error: "User with this email already exists." });
      continue;
    }

    try {
      const created = await createMember(executorUserId, {
        name: item.name,
        email: item.email,
        password: `TmpPass#${Date.now().toString().slice(-6)}`,
        phone: item.phone,
        address: item.address,
        identityNumber: item.identityNumber,
        branchId,
      });

      existingEmailSet.add(item.email);
      importedMembers.push({
        memberNumber: created.memberNumber,
        name: created.name,
        email: created.email,
      });
    } catch (err: unknown) {
      errors.push({ row: item.rowNumber, email: item.email, error: (err as Error)?.message || "Import failed for row." });
    }
  }

  if (importedMembers.length > 0) {
    await logAuditEvent({
      actorUserId: executorUserId,
      action: "MEMBERS_BULK_IMPORTED",
      entityType: "Branch",
      entityId: branchId,
      metadata: {
        importedCount: importedMembers.length,
        failedCount: errors.length,
      },
    });
  }

  return {
    totalProcessed: rows.length,
    successfulCount: importedMembers.length,
    failedCount: errors.length,
    importedMembers,
    errors,
  };
}
