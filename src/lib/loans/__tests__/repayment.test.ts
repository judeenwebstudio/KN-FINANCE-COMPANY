import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";
import { calculateRepaymentAllocation } from "../repayment";
import type { ScheduleItem } from "../balance";

const Decimal = Prisma.Decimal;

function mockScheduleItem(
  id: string,
  num: number,
  pDue: number,
  iDue: number,
  fDue: number,
  dueDateStr = "2026-10-01"
): ScheduleItem {
  const total = pDue + iDue + fDue;
  return {
    id,
    installmentNumber: num,
    dueDate: new Date(dueDateStr),
    principalDue: new Decimal(pDue),
    interestDue: new Decimal(iDue),
    feeDue: new Decimal(fDue),
    totalDue: new Decimal(total),
    principalPaid: new Decimal(0),
    interestPaid: new Decimal(0),
    feePaid: new Decimal(0),
    totalPaid: new Decimal(0),
    status: "PENDING",
    paidAt: null,
  };
}

describe("Repayment Allocation Engine", () => {
  it("should allocate payment in priority order: Fee -> Interest -> Principal", () => {
    const schedules = [mockScheduleItem("s1", 1, 800, 100, 20)];
    // Partial payment of 50
    const res = calculateRepaymentAllocation(schedules, 50);

    assert.equal(res.allocations.length, 1);
    const alloc = res.allocations[0];
    assert.equal(alloc.feeAllocated.toString(), "20"); // Fee 20 fully covered
    assert.equal(alloc.interestAllocated.toString(), "30"); // Interest 30 covered
    assert.equal(alloc.principalAllocated.toString(), "0"); // Principal 0
    assert.equal(alloc.totalAllocated.toString(), "50");
    assert.equal(alloc.newStatus, "PARTIAL");
  });

  it("should handle exact installment payment", () => {
    const schedules = [mockScheduleItem("s1", 1, 800, 100, 20)];
    const res = calculateRepaymentAllocation(schedules, 920);

    assert.equal(res.allocations.length, 1);
    const alloc = res.allocations[0];
    assert.equal(alloc.feeAllocated.toString(), "20");
    assert.equal(alloc.interestAllocated.toString(), "100");
    assert.equal(alloc.principalAllocated.toString(), "800");
    assert.equal(alloc.newStatus, "PAID");
    assert.ok(res.isFullPayoff);
  });

  it("should allocate across multiple installments starting from oldest", () => {
    const schedules = [
      mockScheduleItem("s1", 1, 500, 50, 10), // Total 560
      mockScheduleItem("s2", 2, 500, 50, 10), // Total 560
    ];
    // Payment of 800
    const res = calculateRepaymentAllocation(schedules, 800);

    assert.equal(res.allocations.length, 2);
    // Installment 1: fully paid (560)
    assert.equal(res.allocations[0].totalAllocated.toString(), "560");
    assert.equal(res.allocations[0].newStatus, "PAID");

    // Installment 2: 240 remaining allocated (Fee 10, Interest 50, Principal 180)
    assert.equal(res.allocations[1].feeAllocated.toString(), "10");
    assert.equal(res.allocations[1].interestAllocated.toString(), "50");
    assert.equal(res.allocations[1].principalAllocated.toString(), "180");
    assert.equal(res.allocations[1].totalAllocated.toString(), "240");
    assert.equal(res.allocations[1].newStatus, "PARTIAL");
  });

  it("should reject overpayment beyond total outstanding balance", () => {
    const schedules = [mockScheduleItem("s1", 1, 500, 50, 10)]; // Total 560
    assert.throws(
      () => calculateRepaymentAllocation(schedules, 600),
      /Overpayment rejected/
    );
  });

  it("should reject zero or negative payment amounts", () => {
    const schedules = [mockScheduleItem("s1", 1, 500, 50, 10)];
    assert.throws(
      () => calculateRepaymentAllocation(schedules, 0),
      /Repayment amount must be greater than 0/
    );
    assert.throws(
      () => calculateRepaymentAllocation(schedules, -100),
      /Repayment amount must be greater than 0/
    );
  });
});
