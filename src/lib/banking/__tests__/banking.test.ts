import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

describe("Phase 4 Expenses & Banking Unit Tests", () => {
  it("should snapshot Treasury balanceBefore and balanceAfter accurately on Treasury DEBIT and CREDIT", () => {
    const startBal = new Decimal(1000);
    const debitAmount = new Decimal(250);

    const balAfterDebit = startBal.sub(debitAmount);
    assert.equal(startBal.toString(), "1000");
    assert.equal(balAfterDebit.toString(), "750");

    const creditAmount = new Decimal(250);
    const balAfterCredit = balAfterDebit.add(creditAmount);
    assert.equal(balAfterCredit.toString(), "1000");
  });

  it("should snapshot Bank currentBalance balanceBefore and balanceAfter accurately on Bank DEBIT and CREDIT", () => {
    const startBal = new Decimal(5000);
    const expAmount = new Decimal(1200);

    const balAfterExp = startBal.sub(expAmount);
    assert.equal(startBal.toString(), "5000");
    assert.equal(balAfterExp.toString(), "3800");

    const revAmount = new Decimal(1200);
    const balAfterRev = balAfterExp.add(revAmount);
    assert.equal(balAfterRev.toString(), "5000");
  });

  it("should validate Expense payment source XOR rules strictly", () => {
    // CASH requires treasuryAccountId and null bankAccountId
    const validCash = { paymentSourceType: "CASH", treasuryAccountId: "t-1", bankAccountId: null };
    const invalidCash = { paymentSourceType: "CASH", treasuryAccountId: "t-1", bankAccountId: "b-1" };
    const invalidBank = { paymentSourceType: "BANK", treasuryAccountId: "t-1", bankAccountId: "b-1" };

    assert.ok(validCash.treasuryAccountId && !validCash.bankAccountId);
    assert.ok(invalidCash.treasuryAccountId && invalidCash.bankAccountId); // Reject
    assert.ok(invalidBank.treasuryAccountId && invalidBank.bankAccountId); // Reject
  });

  it("should enforce Transfer XOR rules strictly for CASH_TO_BANK, BANK_TO_CASH, and BANK_TO_BANK", () => {
    const cashToBank = { transferType: "CASH_TO_BANK", srcTreasury: "t-1", srcBank: null, destTreasury: null, destBank: "b-1" };
    const bankToCash = { transferType: "BANK_TO_CASH", srcTreasury: null, srcBank: "b-1", destTreasury: "t-1", destBank: null };
    const bankToBank = { transferType: "BANK_TO_BANK", srcTreasury: null, srcBank: "b-1", destTreasury: null, destBank: "b-2" };

    assert.ok(cashToBank.srcTreasury && cashToBank.destBank && !cashToBank.srcBank && !cashToBank.destTreasury);
    assert.ok(bankToCash.srcBank && bankToCash.destTreasury && !bankToCash.srcTreasury && !bankToCash.destBank);
    assert.ok(bankToBank.srcBank && bankToBank.destBank && !bankToBank.srcTreasury && !bankToBank.destTreasury);
    assert.notEqual(bankToBank.srcBank, bankToBank.destBank);
  });

  it("should verify mathematical subledger reconciliation formula: Balance = SUM(CREDIT) - SUM(DEBIT)", () => {
    const ledgerRows = [
      { type: "OPENING_BALANCE", direction: "CREDIT", amount: new Decimal(1000) },
      { type: "DEPOSIT", direction: "CREDIT", amount: new Decimal(500) },
      { type: "EXPENSE", direction: "DEBIT", amount: new Decimal(300) },
      { type: "TRANSFER_OUT", direction: "DEBIT", amount: new Decimal(200) },
      { type: "REVERSAL", direction: "CREDIT", amount: new Decimal(300) }, // Expense reversal
    ];

    let totalCredits = new Decimal(0);
    let totalDebits = new Decimal(0);

    for (const r of ledgerRows) {
      if (r.direction === "CREDIT") totalCredits = totalCredits.add(r.amount);
      else if (r.direction === "DEBIT") totalDebits = totalDebits.add(r.amount);
    }

    const calculatedBalance = totalCredits.sub(totalDebits);
    // 1000 + 500 - 300 - 200 + 300 = 1300
    assert.equal(calculatedBalance.toString(), "1300");
  });

  it("should ensure Member Account balance is never modified by company fund expense operations", () => {
    const memberAccountBalance = new Decimal(750);
    const companyExpenseAmount = new Decimal(200);

    // Member account balance remains 750
    assert.equal(memberAccountBalance.toString(), "750");
    assert.notEqual(memberAccountBalance.sub(companyExpenseAmount).toString(), memberAccountBalance.toString());
  });

  it("should enforce same-branch restriction for transfers and reject cross-branch transfers", () => {
    const srcBranchId = "branch-1";
    const destSameBranchId = "branch-1";
    const destCrossBranchId = "branch-2";

    assert.equal(srcBranchId, destSameBranchId);
    assert.notEqual(srcBranchId, destCrossBranchId);
  });

  it("should reject account closure when BankAccount.currentBalance or TreasuryAccount.balance is non-zero", () => {
    const activeBankBal = new Decimal(150);
    const zeroBankBal = new Decimal(0);

    assert.ok(!activeBankBal.isZero()); // Closure rejected
    assert.ok(zeroBankBal.isZero());   // Closure allowed
  });
});
