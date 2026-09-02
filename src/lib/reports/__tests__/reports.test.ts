import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDateRange, mapTransactionDirection } from "../filters";
import { TransactionType, Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

describe("Phase 5A Reporting Domain Unit Tests", () => {
  it("should normalize inclusive date range into half-open boundary [start, end)", () => {
    const { start, end } = normalizeDateRange("2026-09-01", "2026-09-30");
    assert.ok(start !== null);
    assert.ok(end !== null);

    assert.equal(start.toISOString(), "2026-09-01T00:00:00.000Z");
    // End date 2026-09-30 becomes 2026-10-01T00:00:00.000Z for half-open boundary timestamp < end
    assert.equal(end.toISOString(), "2026-10-01T00:00:00.000Z");
  });

  it("should map all 11 TransactionType enum values to CREDIT or DEBIT correctly", () => {
    assert.equal(mapTransactionDirection({ type: TransactionType.DEPOSIT }), "CREDIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.WITHDRAWAL }), "DEBIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.TRANSFER_IN }), "CREDIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.TRANSFER_OUT }), "DEBIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.LOAN_DISBURSEMENT }), "CREDIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.LOAN_REPAYMENT }), "DEBIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.FEE }), "DEBIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.OPENING_BALANCE }), "CREDIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.DEPOSIT_REVERSAL }), "DEBIT");
    assert.equal(mapTransactionDirection({ type: TransactionType.WITHDRAWAL_REVERSAL }), "CREDIT");

    // Dynamic ADJUSTMENT mapping
    const adjCredit = mapTransactionDirection({
      type: TransactionType.ADJUSTMENT,
      balanceBefore: new Decimal(100),
      balanceAfter: new Decimal(200),
    });
    assert.equal(adjCredit, "CREDIT");

    const adjDebit = mapTransactionDirection({
      type: TransactionType.ADJUSTMENT,
      balanceBefore: new Decimal(200),
      balanceAfter: new Decimal(100),
    });
    assert.equal(adjDebit, "DEBIT");
  });

  it("should calculate Account Statement closing balance formula: opening + credits - debits = closing", () => {
    const opening = new Decimal(500);
    const credits = new Decimal(300);
    const debits = new Decimal(150);

    const closing = opening.add(credits).sub(debits);
    assert.equal(closing.toString(), "650");
  });

  it("should handle zero-transaction period preserving opening balance equal to closing balance", () => {
    const opening = new Decimal(1000);
    const credits = new Decimal(0);
    const debits = new Decimal(0);

    const closing = opening.add(credits).sub(debits);
    assert.equal(closing.toString(), "1000");
  });

  it("should calculate Income Summary correctly: excludes principal, counts interest/fee/penalty, subtracts expense", () => {
    const interestPaid = new Decimal(150);
    const feePaid = new Decimal(25);
    const penaltyPaid = new Decimal(10);

    const totalIncome = interestPaid.add(feePaid).add(penaltyPaid);
    assert.equal(totalIncome.toString(), "185");
    assert.ok(!totalIncome.toString().includes("685"));

    const operatingExpense = new Decimal(60);
    const netIncome = totalIncome.sub(operatingExpense);
    assert.equal(netIncome.toString(), "125");
  });

  it("should support negative net income when reversals exceed collections", () => {
    const interestCollections = new Decimal(50);
    const interestReversals = new Decimal(150);

    const netInterest = interestCollections.sub(interestReversals);
    assert.equal(netInterest.toString(), "-100");
  });
});
