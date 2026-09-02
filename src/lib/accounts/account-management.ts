"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { creditAccount } from "./service";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

function generateAccountNumber(typeCode: string): string {
  const prefix = typeCode.slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${year}-${hex}`;
}

export async function createMemberAccountAction(data: {
  memberId: string;
  accountTypeId: string;
  currency: string;
  openingBalance?: number;
}) {
  const admin = await requirePermission("accounts.create");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const member = await prisma.memberProfile.findUnique({
    where: { id: data.memberId },
    include: { branch: true },
  });

  if (!member) return { error: "Member profile not found" };

  if (!accessibleBranchIds.includes(member.branchId)) {
    return { error: "You are not authorized to create accounts for this branch" };
  }

  const policy = await prisma.accountTypePolicy.findUnique({
    where: { id: data.accountTypeId },
  });

  if (!policy) return { error: "Selected account type policy not found" };
  if (policy.status !== "ACTIVE") return { error: `Account type '${policy.name}' is currently INACTIVE` };

  const currency = data.currency.trim().toUpperCase();
  if (policy.currency && policy.currency !== currency) {
    return { error: `Account type '${policy.name}' strictly requires currency ${policy.currency}, but ${currency} was submitted` };
  }

  const openingAmount = data.openingBalance ? new Decimal(data.openingBalance.toString()) : new Decimal(0);
  if (openingAmount.lt(0)) {
    return { error: "Opening balance cannot be negative" };
  }

  const minOpening = new Decimal(policy.minimumOpeningBalance.toString());
  if (openingAmount.gt(0) && openingAmount.lt(minOpening)) {
    return { error: `Minimum opening balance for '${policy.name}' is ${minOpening.toString()} ${currency}` };
  }

  const accountNumber = generateAccountNumber(policy.code);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Map enum AccountType for legacy field compatibility
      const enumType: "CHECKING" | "SAVINGS" = policy.code.includes("CHECK") ? "CHECKING" : "SAVINGS";

      const createdAcc = await tx.account.create({
        data: {
          accountNumber,
          memberId: member.id,
          branchId: member.branchId,
          accountType: enumType,
          accountTypeId: policy.id,
          currency,
          balance: new Decimal(0),
          loanGuarantee: new Decimal(0),
          status: "ACTIVE",
          hasOpeningBalance: openingAmount.gt(0),
        },
      });

      if (openingAmount.gt(0)) {
        await creditAccount(tx, {
          accountId: createdAcc.id,
          memberId: member.id,
          branchId: member.branchId,
          amount: openingAmount,
          currency,
          type: "OPENING_BALANCE",
          description: `Initial opening balance for ${accountNumber}`,
          referencePrefix: "OPN",
          createdById: admin.id,
          isManualCashOperation: false,
        });
      }

      return tx.account.findUnique({
        where: { id: createdAcc.id },
        include: { member: { include: { user: true } }, branch: true, accountTypePolicy: true },
      });
    });

    revalidatePath("/admin/accounts");
    revalidatePath("/member/accounts");
    return { success: true, data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create account" };
  }
}

export async function updateAccountStatusAction(
  accountId: string,
  newStatus: "ACTIVE" | "FROZEN" | "CLOSED"
) {
  await requirePermission("accounts.update_status");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      member: true,
      depositRequests: { where: { status: "PENDING" } },
      withdrawalRequests: { where: { status: "PENDING" } },
      repayments: { where: { status: "POSTED" } },
    },
  });

  if (!account) return { error: "Account not found" };

  if (!accessibleBranchIds.includes(account.branchId)) {
    return { error: "You are not authorized to modify accounts for this branch" };
  }

  if (newStatus === "CLOSED") {
    // 1. Cannot close account if balance != 0 or loanGuarantee != 0
    if (!account.balance.isZero()) {
      return { error: `Cannot close account ${account.accountNumber} with non-zero balance (${account.balance.toString()} ${account.currency}). Balance must be zero.` };
    }
    if (!account.loanGuarantee.isZero()) {
      return { error: `Cannot close account ${account.accountNumber} with locked loan guarantee funds (${account.loanGuarantee.toString()} ${account.currency}).` };
    }

    // 2. Cannot close account if pending deposit or withdrawal requests exist
    if (account.depositRequests.length > 0 || account.withdrawalRequests.length > 0) {
      return { error: `Cannot close account ${account.accountNumber} while pending deposit or withdrawal requests exist.` };
    }

    // 3. Cannot close account if linked to ACTIVE loans for member
    const activeLoansCount = await prisma.loan.count({
      where: { memberId: account.memberId, status: "ACTIVE" },
    });
    if (activeLoansCount > 0) {
      return { error: `Cannot close account ${account.accountNumber} because member has active loan facilities.` };
    }
  }

  try {
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: { status: newStatus },
      include: { member: { include: { user: true } }, branch: true, accountTypePolicy: true },
    });

    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
    revalidatePath("/member/accounts");
    return { success: true, data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update account status" };
  }
}
