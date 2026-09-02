import { Prisma } from "@/generated/prisma/client";
import type { TransactionType } from "@/generated/prisma/client";
import crypto from "node:crypto";

const Decimal = Prisma.Decimal;

export interface CreditAccountParams {
  accountId: string;
  memberId: string;
  branchId: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  type: TransactionType;
  description: string;
  referencePrefix?: string;
  categoryId?: string | null;
  createdById?: string | null;
  isManualCashOperation?: boolean;
}

export interface DebitAccountParams {
  accountId: string;
  memberId: string;
  branchId: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  type: TransactionType;
  description: string;
  referencePrefix?: string;
  categoryId?: string | null;
  createdById?: string | null;
  isManualCashOperation?: boolean;
}

export async function creditAccount(
  tx: Prisma.TransactionClient,
  params: CreditAccountParams
) {
  const amountDecimal = new Decimal(params.amount.toString());

  if (amountDecimal.lte(0)) {
    throw new Error("Credit amount must be greater than 0");
  }

  // 1. Re-fetch account inside transaction to avoid stale balance assumptions
  const account = await tx.account.findUnique({
    where: { id: params.accountId },
    include: { accountTypePolicy: true },
  });

  if (!account) throw new Error("Account not found");

  if (account.status === "CLOSED") {
    throw new Error(`Account ${account.accountNumber} is CLOSED. No new financial operations allowed.`);
  }

  if (account.status === "FROZEN" && params.isManualCashOperation) {
    throw new Error(`Account ${account.accountNumber} is FROZEN. Manual deposit operations are blocked.`);
  }

  if (account.currency !== params.currency) {
    throw new Error(`Currency mismatch: account uses ${account.currency}, transaction is ${params.currency}`);
  }

  if (params.isManualCashOperation && account.accountTypePolicy) {
    if (!account.accountTypePolicy.allowDeposits) {
      throw new Error(`Account type '${account.accountTypePolicy.name}' does not allow deposits.`);
    }
  }

  // 2. Authoritative balanceBefore and balanceAfter snapshot
  const balanceBefore = account.balance;
  const balanceAfter = balanceBefore.add(amountDecimal);

  // 3. Increment balance
  const updatedAccount = await tx.account.update({
    where: { id: params.accountId },
    data: {
      balance: balanceAfter,
    },
  });

  // 4. Create Transaction log with balance snapshots
  const prefix = params.referencePrefix ?? "TX";
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const reference = `${prefix}-${Date.now()}-${randomHex}`;

  const transaction = await tx.transaction.create({
    data: {
      accountId: params.accountId,
      memberId: params.memberId,
      branchId: params.branchId,
      type: params.type,
      amount: amountDecimal,
      currency: params.currency,
      reference,
      description: params.description,
      balanceBefore,
      balanceAfter,
      categoryId: params.categoryId || null,
      createdById: params.createdById || null,
      status: "COMPLETED",
    },
  });

  return { account: updatedAccount, transaction };
}

export async function debitAccount(
  tx: Prisma.TransactionClient,
  params: DebitAccountParams
) {
  const amountDecimal = new Decimal(params.amount.toString());

  if (amountDecimal.lte(0)) {
    throw new Error("Debit amount must be greater than 0");
  }

  // 1. Re-fetch account inside transaction to avoid stale balance assumptions
  const account = await tx.account.findUnique({
    where: { id: params.accountId },
    include: { accountTypePolicy: true },
  });

  if (!account) throw new Error("Account not found");

  if (account.status === "CLOSED") {
    throw new Error(`Account ${account.accountNumber} is CLOSED. No new financial operations allowed.`);
  }

  if (account.status === "FROZEN" && params.isManualCashOperation) {
    throw new Error(`Account ${account.accountNumber} is FROZEN. Manual withdrawal operations are blocked.`);
  }

  if (account.currency !== params.currency) {
    throw new Error(`Currency mismatch: account uses ${account.currency}, transaction is ${params.currency}`);
  }

  if (params.isManualCashOperation && account.accountTypePolicy) {
    if (!account.accountTypePolicy.allowWithdrawals) {
      throw new Error(`Account type '${account.accountTypePolicy.name}' does not allow withdrawals.`);
    }
  }

  // 2. Authoritative minimum balance and available balance checks
  const minBalance = account.accountTypePolicy
    ? new Decimal(account.accountTypePolicy.minimumBalance.toString())
    : new Decimal(0);

  const balanceBefore = account.balance;
  const balanceAfter = balanceBefore.sub(amountDecimal);

  if (balanceAfter.lt(minBalance)) {
    throw new Error(
      `Insufficient available balance in account ${account.accountNumber}. Minimum balance required is ${minBalance.toString()} ${account.currency}, current balance is ${balanceBefore.toString()}, requested debit is ${amountDecimal.toString()}`
    );
  }

  const availableAfterGuarantee = balanceBefore.sub(account.loanGuarantee);
  if (availableAfterGuarantee.lt(amountDecimal)) {
    throw new Error(
      `Account ${account.accountNumber} has ${account.loanGuarantee.toString()} ${account.currency} locked as loan guarantee. Available unencumbered balance: ${Decimal.max(0, availableAfterGuarantee).toString()}`
    );
  }

  // 3. Decrement balance
  const updatedAccount = await tx.account.update({
    where: { id: params.accountId },
    data: {
      balance: balanceAfter,
    },
  });

  // 4. Create Transaction log with balance snapshots
  const prefix = params.referencePrefix ?? "WDR";
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const reference = `${prefix}-${Date.now()}-${randomHex}`;

  const transaction = await tx.transaction.create({
    data: {
      accountId: params.accountId,
      memberId: params.memberId,
      branchId: params.branchId,
      type: params.type,
      amount: amountDecimal,
      currency: params.currency,
      reference,
      description: params.description,
      balanceBefore,
      balanceAfter,
      categoryId: params.categoryId || null,
      createdById: params.createdById || null,
      status: "COMPLETED",
    },
  });

  return { account: updatedAccount, transaction };
}
