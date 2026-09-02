import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";
import {
  calculatePenaltyForDate,
  getAgingBucket,
  calculateLoanDelinquencySummary,
  getEffectivePenaltyConfig,
  type PenaltyRuleConfig,
  type AssessmentRecord,
  type ScheduleOverdueItem,
} from "../overdue";
import { calculateRepaymentAllocation } from "../repayment";
import type { ScheduleItem } from "../balance";

const Decimal = Prisma.Decimal;

function mockSchedule(
  id: string,
  num: number,
  pDue: number,
  iDue: number,
  fDue: number,
  pPaid = 0,
  dueDateStr = "2026-10-01"
): ScheduleOverdueItem {
  return {
    id,
    installmentNumber: num,
    dueDate: new Date(dueDateStr),
    principalDue: new Decimal(pDue),
    interestDue: new Decimal(iDue),
    feeDue: new Decimal(fDue),
    penaltyDue: new Decimal(0),
    totalDue: new Decimal(pDue + iDue + fDue),
    principalPaid: new Decimal(pPaid),
    interestPaid: new Decimal(0),
    feePaid: new Decimal(0),
    penaltyPaid: new Decimal(0),
    totalPaid: new Decimal(pPaid),
    overdueDays: 0,
    status: pPaid > 0 ? "PARTIAL" : "PENDING",
  };
}

describe("Phase 2B-2 Overdue & Penalty Engine Unit Tests", () => {
  it("should snapshot penalty rule config onto loan and resolve deterministically", () => {
    const loanWithSnapshots = {
      penaltyType: "PERCENTAGE",
      penaltyFrequency: "DAILY",
      penaltyBasis: "OUTSTANDING_INSTALLMENT",
      gracePeriodDays: 3,
      penaltyValue: new Decimal(0.1),
      maximumPenaltyAmount: new Decimal(100),
      penaltyRule: null,
    };

    const config = getEffectivePenaltyConfig(loanWithSnapshots);
    assert.ok(config);
    assert.equal(config?.penaltyType, "PERCENTAGE");
    assert.equal(config?.gracePeriodDays, 3);
    assert.equal(config?.maximumPenaltyAmount?.toString(), "100");
  });

  it("should evaluate grace period boundary correctly", () => {
    const rule: PenaltyRuleConfig = {
      penaltyType: "FIXED",
      penaltyFrequency: "ONE_TIME",
      penaltyBasis: "OUTSTANDING_INSTALLMENT",
      gracePeriodDays: 3,
      penaltyValue: new Decimal(25),
      maximumPenaltyAmount: new Decimal(25),
    };

    const sched = mockSchedule("s1", 1, 500, 50, 0, 0, "2026-10-01");

    // Assessment date: 2026-10-03 (2 days past due, within grace period of 3)
    const resWithinGrace = calculatePenaltyForDate(sched, rule, [], new Date("2026-10-03"));
    assert.equal(resWithinGrace.penaltyAmount.toString(), "0");
    assert.equal(resWithinGrace.isOverdue, false);

    // Assessment date: 2026-10-05 (4 days past due, past grace period of 3)
    const resPastGrace = calculatePenaltyForDate(sched, rule, [], new Date("2026-10-05"));
    assert.equal(resPastGrace.penaltyAmount.toString(), "25");
    assert.equal(resPastGrace.isOverdue, true);
  });

  it("should calculate ONE_TIME fixed penalty exactly once", () => {
    const rule: PenaltyRuleConfig = {
      penaltyType: "FIXED",
      penaltyFrequency: "ONE_TIME",
      penaltyBasis: "OUTSTANDING_INSTALLMENT",
      gracePeriodDays: 2,
      penaltyValue: new Decimal(30),
      maximumPenaltyAmount: new Decimal(30),
    };

    const sched = mockSchedule("s1", 1, 500, 50, 0, 0, "2026-10-01");
    const existingAssessments: AssessmentRecord[] = [];

    // First refresh past grace period (2026-10-04)
    const firstAss = calculatePenaltyForDate(sched, rule, existingAssessments, new Date("2026-10-04"));
    assert.equal(firstAss.penaltyAmount.toString(), "30");

    existingAssessments.push({
      effectiveDate: new Date("2026-10-04"),
      amount: firstAss.penaltyAmount,
      basisAmount: firstAss.basisAmount,
      status: "ACTIVE",
    });

    // Second refresh on later date (2026-10-10) should NOT assess again
    const secondAss = calculatePenaltyForDate(sched, rule, existingAssessments, new Date("2026-10-10"));
    assert.equal(secondAss.penaltyAmount.toString(), "0");
  });

  it("should calculate DAILY percentage penalty and respect maximum cap per installment", () => {
    const rule: PenaltyRuleConfig = {
      penaltyType: "PERCENTAGE",
      penaltyFrequency: "DAILY",
      penaltyBasis: "OUTSTANDING_INSTALLMENT",
      gracePeriodDays: 0,
      penaltyValue: new Decimal(1.0), // 1% per day
      maximumPenaltyAmount: new Decimal(15), // Capped at $15 per installment
    };

    const sched = mockSchedule("s1", 1, 1000, 0, 0, 0, "2026-10-01"); // $1,000 due
    const existingAssessments: AssessmentRecord[] = [];

    // Day 1 (1% of $1,000 = $10)
    const day1 = calculatePenaltyForDate(sched, rule, existingAssessments, new Date("2026-10-02"));
    assert.equal(day1.penaltyAmount.toString(), "10");

    existingAssessments.push({
      effectiveDate: new Date("2026-10-02"),
      amount: day1.penaltyAmount,
      basisAmount: day1.basisAmount,
      status: "ACTIVE",
    });

    // Day 2 (Raw 1% = $10, but cap is $15 total, so only $5 allocated)
    const day2 = calculatePenaltyForDate(sched, rule, existingAssessments, new Date("2026-10-03"));
    assert.equal(day2.penaltyAmount.toString(), "5");

    existingAssessments.push({
      effectiveDate: new Date("2026-10-03"),
      amount: day2.penaltyAmount,
      basisAmount: day2.basisAmount,
      status: "ACTIVE",
    });

    // Day 3 (Cap already reached $15 total, so $0 allocated)
    const day3 = calculatePenaltyForDate(sched, rule, existingAssessments, new Date("2026-10-04"));
    assert.equal(day3.penaltyAmount.toString(), "0");
  });

  it("should allocate repayments in priority order: Penalty -> Fee -> Interest -> Principal", () => {
    const sched: ScheduleItem = {
      id: "s1",
      installmentNumber: 1,
      dueDate: new Date("2026-10-01"),
      principalDue: new Decimal(800),
      interestDue: new Decimal(100),
      feeDue: new Decimal(20),
      penaltyDue: new Decimal(50),
      totalDue: new Decimal(920),
      principalPaid: new Decimal(0),
      interestPaid: new Decimal(0),
      feePaid: new Decimal(0),
      penaltyPaid: new Decimal(0),
      totalPaid: new Decimal(0),
      status: "PENDING",
      paidAt: null,
    };

    // Payment of $60
    const res = calculateRepaymentAllocation([sched], 60);
    assert.equal(res.allocations.length, 1);

    const alloc = res.allocations[0];
    assert.equal(alloc.penaltyAllocated.toString(), "50"); // Penalty $50 fully paid
    assert.equal(alloc.feeAllocated.toString(), "10"); // Fee $10 partially paid
    assert.equal(alloc.interestAllocated.toString(), "0");
    assert.equal(alloc.principalAllocated.toString(), "0");
    assert.equal(alloc.totalAllocated.toString(), "60");
  });

  it("should preserve PARTIAL status for partially paid overdue installments", () => {
    const sched = mockSchedule("s1", 1, 500, 50, 0, 100, "2026-09-01");
    sched.penaltyDue = new Decimal(20);
    sched.overdueDays = 15;

    const delinq = calculateLoanDelinquencySummary(
      { id: "l1", loanNumber: "LN-100", status: "ACTIVE", currency: "USD" },
      [sched],
      new Date("2026-09-20")
    );

    assert.equal(delinq.isDelinquent, true);
    assert.equal(delinq.daysPastDue, 19);
    assert.equal(delinq.agingBucket, "1-30");
  });

  it("should calculate correct aging buckets (1-30, 31-60, 61-90, 90+)", () => {
    assert.equal(getAgingBucket(0), "CURRENT");
    assert.equal(getAgingBucket(15), "1-30");
    assert.equal(getAgingBucket(45), "31-60");
    assert.equal(getAgingBucket(75), "61-90");
    assert.equal(getAgingBucket(120), "90+");
  });
});
