import { hash } from "bcryptjs";
import { prisma } from "../prisma";
import {
  hasPermission,
  assertBranchAccess,
  getUserAuthorizedBranchScope,
  PermissionDeniedError,
} from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
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
  balance: number;
  loanGuarantee: number;
  status: string;
  createdAt: string;
};

export type Member360LoanDTO = {
  id: string;
  loanNumber: string;
  productName: string | null;
  productCode: string | null;
  currency: string;
  principalAmount: number;
  approvedAmount: number | null;
  paidAmount: number;
  outstandingAmount: number;
  interestRate: number;
  interestType: string;
  termMonths: number;
  repaymentFrequency: string;
  status: string;
  applicationDate: string;
  disbursementDate: string | null;
  maturityDate: string | null;
  overdueDays: number;
  overdueAmount: number;
};

export type Member360RepaymentDTO = {
  id: string;
  repaymentNumber: string;
  loanId: string;
  loanNumber: string;
  accountId: string;
  accountNumber: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  feeAmount: number;
  penaltyAmount: number;
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
  principalDue: number;
  interestDue: number;
  feeDue: number;
  penaltyDue: number;
  totalDue: number;
  principalPaid: number;
  interestPaid: number;
  feePaid: number;
  penaltyPaid: number;
  totalPaid: number;
  status: string;
  overdueDays: number;
  paidAt: string | null;
};

export type Member360TransactionDTO = {
  id: string;
  accountId: string | null;
  accountNumber: string | null;
  type: string;
  amount: number;
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
  amount: number;
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
  amount: number;
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
  promiseToPayAmount: number | null;
  promiseToPayDate: string | null;
  createdBy: string | null;
};

export type Member360ProfileDTO = {
  header: {
    id: string;
    userId: string;
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
    totalAccountBalance: number;
    totalLoanPrincipalOutstanding: number;
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
      balance: acc.balance.toNumber(),
      loanGuarantee: acc.loanGuarantee.toNumber(),
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
        principalDue: sch.principalDue.toNumber(),
        interestDue: sch.interestDue.toNumber(),
        feeDue: sch.feeDue.toNumber(),
        penaltyDue: sch.penaltyDue.toNumber(),
        totalDue: sch.totalDue.toNumber(),
        principalPaid: sch.principalPaid.toNumber(),
        interestPaid: sch.interestPaid.toNumber(),
        feePaid: sch.feePaid.toNumber(),
        penaltyPaid: sch.penaltyPaid.toNumber(),
        totalPaid: sch.totalPaid.toNumber(),
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
      principalAmount: loan.principalAmount.toNumber(),
      approvedAmount: loan.approvedAmount ? loan.approvedAmount.toNumber() : null,
      paidAmount: loan.paidAmount.toNumber(),
      outstandingAmount: outstanding.toNumber(),
      interestRate: loan.interestRate.toNumber(),
      interestType: loan.interestType,
      termMonths: loan.termMonths,
      repaymentFrequency: loan.repaymentFrequency,
      status: loan.status,
      applicationDate: loan.applicationDate.toISOString(),
      disbursementDate: loan.disbursementDate ? loan.disbursementDate.toISOString() : null,
      maturityDate: loan.maturityDate ? loan.maturityDate.toISOString() : null,
      overdueDays: maxOverdueDays,
      overdueAmount: loanOverdueAmountDecimal.toNumber(),
    };
  });

  const repaymentsDTO: Member360RepaymentDTO[] = repaymentsRecords.map((rep) => ({
    id: rep.id,
    repaymentNumber: rep.repaymentNumber,
    loanId: rep.loanId,
    loanNumber: rep.loan.loanNumber,
    accountId: rep.accountId,
    accountNumber: rep.account.accountNumber,
    amount: rep.amount.toNumber(),
    principalAmount: rep.principalAmount.toNumber(),
    interestAmount: rep.interestAmount.toNumber(),
    feeAmount: rep.feeAmount.toNumber(),
    penaltyAmount: rep.penaltyAmount.toNumber(),
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
    amount: tx.amount.toNumber(),
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
    amount: dr.amount.toNumber(),
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
    amount: wr.amount.toNumber(),
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
    promiseToPayAmount: cn.promiseToPayAmount ? cn.promiseToPayAmount.toNumber() : null,
    promiseToPayDate: cn.promiseToPayDate ? cn.promiseToPayDate.toISOString() : null,
    createdBy: cn.createdBy?.name || null,
  }));

  const txTotalPages = Math.ceil(txTotal / txPageSize);

  return {
    header: {
      id: member.id,
      userId: member.userId,
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
      totalAccountBalance: totalAccountBalanceDecimal.toNumber(),
      totalLoanPrincipalOutstanding: totalLoanOutstandingDecimal.toNumber(),
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
