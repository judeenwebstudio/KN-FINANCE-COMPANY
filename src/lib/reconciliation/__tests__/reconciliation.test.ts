import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";
import { parseBankStatementCsv, calculateFileHash } from "../parser";
import { findAutoMatches, evaluateCandidateMatch, normalizeReference, MatchingCandidate } from "../matching";

describe("Phase 5B-1 Bank Reconciliation Unit Tests", () => {
  it("should calculate deterministic file hash for file content", () => {
    const content = "Date,Description,Amount\n2026-09-01,Deposit,100.00";
    const hash1 = calculateFileHash(content);
    const hash2 = calculateFileHash(content);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 hex length
  });

  it("should parse valid CSV bank statement rows and handle quoted fields and line endings", () => {
    const csvContent = `Date,Description,Reference,Debit,Credit,Balance
2026-09-01,"Direct Deposit, Salary",REF-101,,500.00,1500.00
2026-09-02,"Vendor ""Supply"" Payment",REF-102,150.00,,1350.00`;

    const result = parseBankStatementCsv(csvContent, "USD");

    assert.equal(result.rowCount, 2);
    assert.equal(result.validRows.length, 2);
    assert.equal(result.errors.length, 0);

    const row1 = result.validRows[0];
    assert.equal(row1.direction, "CREDIT");
    assert.equal(row1.amount.toString(), "500");
    assert.equal(row1.description, "Direct Deposit, Salary");
    assert.equal(row1.reference, "REF-101");

    const row2 = result.validRows[1];
    assert.equal(row2.direction, "DEBIT");
    assert.equal(row2.amount.toString(), "150");
    assert.equal(row2.description, 'Vendor "Supply" Payment');
    assert.equal(row2.reference, "REF-102");
  });

  it("should reject malformed CSV rows and preserve diagnostic error details", () => {
    const csvContent = `Date,Description,Amount
2026-99-99,Invalid Date,100.00
2026-09-01,Invalid Amount,ABC`;

    const result = parseBankStatementCsv(csvContent, "USD");

    assert.equal(result.validRows.length, 0);
    assert.equal(result.errors.length, 2);
    assert.equal(result.errors[0].lineNumber, 2);
    assert.equal(result.errors[0].field, "Date");
    assert.equal(result.errors[1].lineNumber, 3);
    assert.equal(result.errors[1].field, "Amount/Direction");
  });

  it("should normalize reference strings conservatively", () => {
    assert.equal(normalizeReference("  REF-100-AB  "), "REF100AB");
    assert.equal(normalizeReference("TX_9988"), "TX9988");
    assert.equal(normalizeReference("  "), null);
    assert.equal(normalizeReference("A"), null);
  });

  it("should evaluate EXACT auto-match candidate correctly", () => {
    const line = {
      transactionDate: new Date("2026-09-01T00:00:00Z"),
      amount: new Prisma.Decimal(250),
      direction: "CREDIT" as const,
      currency: "USD",
      reference: "DEP-7788",
    };

    const candidate: MatchingCandidate = {
      bankTransactionId: "BTX-1",
      bankTransactionNumber: "BTX-20260901-01",
      transactionDate: new Date("2026-09-01T10:00:00Z"),
      amount: new Prisma.Decimal(250),
      direction: "CREDIT",
      currency: "USD",
      reference: "DEP-7788",
      description: "Deposit",
      reconciliationStatus: "UNRECONCILED",
    };

    const evalResult = evaluateCandidateMatch(line, candidate);
    assert.ok(evalResult);
    assert.equal(evalResult?.confidence, "EXACT");
  });

  it("should evaluate STRONG candidate within ±2 calendar days tolerance", () => {
    const line = {
      transactionDate: new Date("2026-09-01T00:00:00Z"),
      amount: new Prisma.Decimal(100),
      direction: "DEBIT" as const,
      currency: "USD",
      reference: "EXP-101",
    };

    const candidate: MatchingCandidate = {
      bankTransactionId: "BTX-2",
      bankTransactionNumber: "BTX-20260902-01",
      transactionDate: new Date("2026-09-02T12:00:00Z"), // +1 calendar day
      amount: new Prisma.Decimal(100),
      direction: "DEBIT",
      currency: "USD",
      reference: "EXP-101",
      description: "Expense",
      reconciliationStatus: "UNRECONCILED",
    };

    const evalResult = evaluateCandidateMatch(line, candidate);
    assert.ok(evalResult);
    assert.equal(evalResult?.confidence, "STRONG");
  });

  it("should leave ambiguous candidate matches UNMATCHED", () => {
    const statementLines = [
      {
        id: "LINE-1",
        transactionDate: new Date("2026-09-01T00:00:00Z"),
        amount: new Prisma.Decimal(500),
        direction: "CREDIT" as const,
        currency: "USD",
        reference: null,
        status: "UNMATCHED",
      },
    ];

    // Two candidates with exact same date & amount & direction, no reference -> Ambiguous
    const candidates: MatchingCandidate[] = [
      {
        bankTransactionId: "BTX-101",
        bankTransactionNumber: "BTX-101",
        transactionDate: new Date("2026-09-01T08:00:00Z"),
        amount: new Prisma.Decimal(500),
        direction: "CREDIT",
        currency: "USD",
        reference: null,
        description: "Deposit A",
        reconciliationStatus: "UNRECONCILED",
      },
      {
        bankTransactionId: "BTX-102",
        bankTransactionNumber: "BTX-102",
        transactionDate: new Date("2026-09-01T09:00:00Z"),
        amount: new Prisma.Decimal(500),
        direction: "CREDIT",
        currency: "USD",
        reference: null,
        description: "Deposit B",
        reconciliationStatus: "UNRECONCILED",
      },
    ];

    const autoMatches = findAutoMatches(statementLines, candidates);
    assert.equal(autoMatches.length, 0); // Must leave UNMATCHED due to ambiguity
  });
});
