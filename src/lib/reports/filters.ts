import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { TransactionType, Prisma } from "@/generated/prisma/client";

export type DateRangeFilter = {
  startDate?: string;
  endDate?: string;
};

export function normalizeDateRange(startDate?: string | Date, endDate?: string | Date): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) {
      // Set to 00:00:00.000 UTC
      start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
    }
  }

  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e.getTime())) {
      // Half-open upper boundary: set to start of NEXT day 00:00:00.000 UTC for [start, end)
      end = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate() + 1, 0, 0, 0, 0));
    }
  }

  return { start, end };
}

export type AccountTransactionForDirection = {
  type: TransactionType;
  balanceBefore?: Prisma.Decimal | number | null;
  balanceAfter?: Prisma.Decimal | number | null;
  description?: string | null;
};

export function mapTransactionDirection(tx: AccountTransactionForDirection): "CREDIT" | "DEBIT" | "UNAVAILABLE" {
  switch (tx.type) {
    case TransactionType.DEPOSIT:
    case TransactionType.TRANSFER_IN:
    case TransactionType.LOAN_DISBURSEMENT:
    case TransactionType.OPENING_BALANCE:
    case TransactionType.WITHDRAWAL_REVERSAL:
      return "CREDIT";

    case TransactionType.WITHDRAWAL:
    case TransactionType.TRANSFER_OUT:
    case TransactionType.LOAN_REPAYMENT:
    case TransactionType.FEE:
    case TransactionType.DEPOSIT_REVERSAL:
      return "DEBIT";

    case TransactionType.ADJUSTMENT: {
      if (tx.balanceBefore != null && tx.balanceAfter != null) {
        const bBefore = Number(tx.balanceBefore);
        const bAfter = Number(tx.balanceAfter);
        if (bAfter > bBefore) return "CREDIT";
        if (bAfter < bBefore) return "DEBIT";
      }
      if (tx.description && tx.description.toLowerCase().includes("credit")) return "CREDIT";
      if (tx.description && tx.description.toLowerCase().includes("debit")) return "DEBIT";
      return "UNAVAILABLE";
    }

    default: {
      throw new Error(`Unhandled TransactionType enum value: ${String(tx.type)}`);
    }
  }
}

export async function resolveAuthorizedBranchIds(
  requestedBranchId?: string,
  overrideBranchIds?: string[]
): Promise<string[]> {
  let accessibleBranchIds: string[];

  if (overrideBranchIds && overrideBranchIds.length > 0) {
    accessibleBranchIds = overrideBranchIds;
  } else {
    accessibleBranchIds = await getAccessibleBranchIds();
  }

  if (!requestedBranchId || requestedBranchId === "ALL") {
    return accessibleBranchIds;
  }

  if (!accessibleBranchIds.includes(requestedBranchId)) {
    return [];
  }

  return [requestedBranchId];
}

export async function getBranchScopedSelectors(branchIds: string[]) {
  const [branches, members, accounts, loans, bankAccounts, treasuryAccounts, expenseCategories] =
    await Promise.all([
      prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true, code: true, currency: true },
        orderBy: { name: "asc" },
      }),

      prisma.memberProfile.findMany({
        where: { branchId: { in: branchIds } },
        select: {
          id: true,
          memberNumber: true,
          user: { select: { name: true } },
        },
        orderBy: { memberNumber: "asc" },
        take: 500,
      }),

      prisma.account.findMany({
        where: { branchId: { in: branchIds } },
        select: {
          id: true,
          accountNumber: true,
          accountType: true,
          currency: true,
          member: { select: { user: { select: { name: true } } } },
        },
        orderBy: { accountNumber: "asc" },
        take: 500,
      }),

      prisma.loan.findMany({
        where: { branchId: { in: branchIds } },
        select: {
          id: true,
          loanNumber: true,
          currency: true,
          member: { select: { user: { select: { name: true } } } },
        },
        orderBy: { loanNumber: "asc" },
        take: 500,
      }),

      prisma.bankAccount.findMany({
        where: { branchId: { in: branchIds } },
        select: { id: true, name: true, bankName: true, currency: true },
        orderBy: { name: "asc" },
      }),

      prisma.treasuryAccount.findMany({
        where: { branchId: { in: branchIds } },
        select: { id: true, name: true, code: true, currency: true },
        orderBy: { name: "asc" },
      }),

      prisma.expenseCategory.findMany({
        where: { OR: [{ branchId: null }, { branchId: { in: branchIds } }] },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return {
    branches,
    members: members.map((m) => ({ id: m.id, memberNumber: m.memberNumber, name: m.user.name })),
    accounts: accounts.map((a) => ({
      id: a.id,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      currency: a.currency,
      memberName: a.member.user.name,
    })),
    loans: loans.map((l) => ({
      id: l.id,
      loanNumber: l.loanNumber,
      currency: l.currency,
      memberName: l.member.user.name,
    })),
    bankAccounts,
    treasuryAccounts,
    expenseCategories,
  };
}
