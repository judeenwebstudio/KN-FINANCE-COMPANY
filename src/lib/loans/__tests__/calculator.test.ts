import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateProcessingFee,
  calculateFlatInterest,
  generateFlatRepaymentSchedule,
  generateDecliningBalanceSchedule,
  calculateLoanPreview,
} from "../calculator";

describe("Financial Calculation Engine", () => {
  describe("Processing Fee", () => {
    it("should calculate fixed processing fee", () => {
      const fee = calculateProcessingFee(1000, "FIXED", 50);
      assert.equal(fee.toString(), "50");
    });

    it("should calculate percentage processing fee", () => {
      const fee = calculateProcessingFee(1000, "PERCENTAGE", 2.5);
      assert.equal(fee.toString(), "25");
    });
  });

  describe("Flat Interest", () => {
    it("should calculate flat interest for 12 months at 12%", () => {
      const interest = calculateFlatInterest(10000, 12, 12);
      assert.equal(interest.toString(), "1200");
    });

    it("should calculate flat interest for 6 months at 12%", () => {
      const interest = calculateFlatInterest(10000, 12, 6);
      assert.equal(interest.toString(), "600");
    });

    it("should generate exact flat schedule with matching totals and zero remainder", () => {
      const startDate = new Date("2026-10-01");
      const res = generateFlatRepaymentSchedule({
        principalAmount: 10000,
        annualInterestRate: 12,
        termMonths: 12,
        repaymentFrequency: "MONTHLY",
        processingFee: 100,
        startDate,
      });

      assert.equal(res.installmentCount, 12);
      assert.equal(res.principalAmount.toString(), "10000");
      assert.equal(res.totalInterest.toString(), "1200");
      assert.equal(res.processingFee.toString(), "100");
      assert.equal(res.totalPayable.toString(), "11300");

      let sumP = 0;
      let sumI = 0;
      let sumF = 0;
      for (const row of res.schedule) {
        sumP += Number(row.principalDue);
        sumI += Number(row.interestDue);
        sumF += Number(row.feeDue);
      }

      assert.equal(sumP.toFixed(2), "10000.00");
      assert.equal(sumI.toFixed(2), "1200.00");
      assert.equal(sumF.toFixed(2), "100.00");
    });
  });

  describe("Declining Balance Interest", () => {
    it("should generate declining balance schedule clearing principal completely", () => {
      const startDate = new Date("2026-10-01");
      const res = generateDecliningBalanceSchedule({
        principalAmount: 12000,
        annualInterestRate: 12,
        termMonths: 12,
        repaymentFrequency: "MONTHLY",
        processingFee: 120,
        startDate,
      });

      assert.equal(res.installmentCount, 12);
      let sumP = 0;
      for (const row of res.schedule) {
        sumP += Number(row.principalDue);
      }
      assert.equal(sumP.toFixed(2), "12000.00");
      assert.ok(Number(res.totalInterest) > 0);
    });

    it("should support weekly and biweekly schedules", () => {
      const startDate = new Date("2026-10-01");
      const biweeklyRes = generateDecliningBalanceSchedule({
        principalAmount: 5000,
        annualInterestRate: 10,
        termMonths: 6,
        repaymentFrequency: "BIWEEKLY",
        processingFee: 50,
        startDate,
      });

      assert.equal(biweeklyRes.installmentCount, 13); // 6 * 26 / 12 = 13
      let sumP = 0;
      for (const row of biweeklyRes.schedule) {
        sumP += Number(row.principalDue);
      }
      assert.equal(sumP.toFixed(2), "5000.00");
    });
  });

  describe("Loan Preview", () => {
    it("should return valid preview summary and schedule", () => {
      const preview = calculateLoanPreview({
        principalAmount: 5000,
        annualInterestRate: 15,
        termMonths: 12,
        interestType: "FLAT",
        repaymentFrequency: "MONTHLY",
        feeType: "PERCENTAGE",
        feeValue: 2,
      });

      assert.equal(preview.processingFee.toString(), "100");
      assert.equal(preview.principalAmount.toString(), "5000");
      assert.equal(preview.totalInterest.toString(), "750");
      assert.equal(preview.totalPayable.toString(), "5850");
      assert.equal(preview.schedule.length, 12);
    });
  });
});
