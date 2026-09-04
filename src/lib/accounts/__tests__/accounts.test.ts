import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";
import { creditAccount, debitAccount } from "../service";

const Decimal = Prisma.Decimal;

describe("Phase 3 Accounts & Cash Operations Unit Tests", () => {
  it("should snapshot balanceBefore and balanceAfter accurately on creditAccount", async () => {
    let storedBalance = new Decimal(500);
    const mockTx = {
      account: {
        findUnique: async () => ({
          id: "acc-1",
          accountNumber: "SAV-1001",
          balance: storedBalance,
          currency: "INR",
          status: "ACTIVE",
          accountTypePolicy: { allowDeposits: true, allowWithdrawals: true, minimumBalance: 0 },
        }),
        update: async (args: { data: { balance: Prisma.Decimal } }) => {
          storedBalance = args.data.balance;
          return { id: "acc-1", balance: storedBalance };
        },
      },
      transaction: {
        create: async (args: { data: Record<string, unknown> }) => ({
          id: "tx-1",
          ...args.data,
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const res = await creditAccount(mockTx, {
      accountId: "acc-1",
      memberId: "mem-1",
      branchId: "b-1",
      amount: 200,
      currency: "INR",
      type: "DEPOSIT",
      description: "Test Deposit",
      isManualCashOperation: true,
    });

    assert.equal(res.transaction.balanceBefore!.toString(), "500");
    assert.equal(res.transaction.balanceAfter!.toString(), "700");
    assert.equal(res.transaction.amount.toString(), "200");
  });

  it("should snapshot balanceBefore and balanceAfter accurately on debitAccount and enforce minimum balance", async () => {
    let storedBalance = new Decimal(500);
    const mockTx = {
      account: {
        findUnique: async () => ({
          id: "acc-1",
          accountNumber: "SAV-1001",
          balance: storedBalance,
          loanGuarantee: new Decimal(0),
          currency: "INR",
          status: "ACTIVE",
          accountTypePolicy: { allowDeposits: true, allowWithdrawals: true, minimumBalance: 100 },
        }),
        update: async (args: { data: { balance: Prisma.Decimal } }) => {
          storedBalance = args.data.balance;
          return { id: "acc-1", balance: storedBalance };
        },
      },
      transaction: {
        create: async (args: { data: Record<string, unknown> }) => ({
          id: "tx-2",
          ...args.data,
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const res = await debitAccount(mockTx, {
      accountId: "acc-1",
      memberId: "mem-1",
      branchId: "b-1",
      amount: 300,
      currency: "INR",
      type: "WITHDRAWAL",
      description: "Test Withdrawal",
      isManualCashOperation: true,
    });

    assert.equal(res.transaction.balanceBefore!.toString(), "500");
    assert.equal(res.transaction.balanceAfter!.toString(), "200");

    await assert.rejects(
      async () => {
        await debitAccount(mockTx, {
          accountId: "acc-1",
          memberId: "mem-1",
          branchId: "b-1",
          amount: 150,
          currency: "INR",
          type: "WITHDRAWAL",
          description: "Overdraw test",
          isManualCashOperation: true,
        });
      },
      (err: Error) => err.message.includes("Minimum balance required is 100")
    );
  });

  it("should block manual operations on FROZEN accounts while allowing internal flows like LOAN_REPAYMENT", async () => {
    const mockTx = {
      account: {
        findUnique: async () => ({
          id: "acc-1",
          accountNumber: "SAV-1001",
          balance: new Decimal(500),
          loanGuarantee: new Decimal(0),
          currency: "INR",
          status: "FROZEN",
          accountTypePolicy: { allowDeposits: true, allowWithdrawals: true, minimumBalance: 0 },
        }),
        update: async () => ({ id: "acc-1", balance: new Decimal(400) }),
      },
      transaction: {
        create: async (args: { data: Record<string, unknown> }) => ({ id: "tx-3", ...args.data }),
      },
    } as unknown as Prisma.TransactionClient;

    await assert.rejects(
      async () => {
        await debitAccount(mockTx, {
          accountId: "acc-1",
          memberId: "mem-1",
          branchId: "b-1",
          amount: 100,
          currency: "INR",
          type: "WITHDRAWAL",
          description: "Manual test",
          isManualCashOperation: true,
        });
      },
      (err: Error) => err.message.includes("FROZEN")
    );

    const res = await debitAccount(mockTx, {
      accountId: "acc-1",
      memberId: "mem-1",
      branchId: "b-1",
      amount: 100,
      currency: "INR",
      type: "LOAN_REPAYMENT",
      description: "Loan repayment",
      isManualCashOperation: false,
    });

    assert.ok(res.transaction);
    assert.equal(res.transaction.type, "LOAN_REPAYMENT");
  });

  it("should block all financial operations on CLOSED accounts", async () => {
    const mockTx = {
      account: {
        findUnique: async () => ({
          id: "acc-closed",
          accountNumber: "SAV-CLOSED",
          balance: new Decimal(0),
          currency: "INR",
          status: "CLOSED",
        }),
      },
    } as unknown as Prisma.TransactionClient;

    await assert.rejects(
      async () => {
        await creditAccount(mockTx, {
          accountId: "acc-closed",
          memberId: "mem-1",
          branchId: "b-1",
          amount: 50,
          currency: "INR",
          type: "DEPOSIT",
          description: "Credit closed account",
        });
      },
      (err: Error) => err.message.includes("CLOSED")
    );
  });
});
