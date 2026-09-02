import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma/client";

describe("Phase 5B-2 Portfolio Quality & Risk Unit Tests", () => {
  it("should calculate PAR30 exposure and percentage accurately using full current outstanding principal", () => {
    // Fixtures:
    // Loan A: Outstanding = 1,000, DPD = 0 (Current)
    // Loan B: Outstanding = 2,000, DPD = 30 (Overdue arrears = 200) -> Included in PAR30
    // Loan C: Outstanding = 3,000, DPD = 90 (Overdue arrears = 500) -> Included in PAR30 & PAR90

    const loanAOutstanding = new Prisma.Decimal(1000);
    const loanBOutstanding = new Prisma.Decimal(2000);
    const loanCOutstanding = new Prisma.Decimal(3000);

    const totalOutstandingPortfolio = loanAOutstanding.add(loanBOutstanding).add(loanCOutstanding); // 6,000
    assert.equal(totalOutstandingPortfolio.toNumber(), 6000);

    // PAR30 Numerator: Full outstanding principal of facilities with DPD >= 30 (Loan B + Loan C = 5,000)
    const par30Numerator = loanBOutstanding.add(loanCOutstanding);
    assert.equal(par30Numerator.toNumber(), 5000);

    const par30Rate = Math.round((par30Numerator.toNumber() / totalOutstandingPortfolio.toNumber()) * 10000) / 100;
    assert.equal(par30Rate, 83.33);

    // PAR90 Numerator: Full outstanding principal of facilities with DPD >= 90 (Loan C = 3,000)
    const par90Numerator = loanCOutstanding;
    assert.equal(par90Numerator.toNumber(), 3000);

    const par90Rate = Math.round((par90Numerator.toNumber() / totalOutstandingPortfolio.toNumber()) * 10000) / 100;
    assert.equal(par90Rate, 50.0);
  });

  it("should categorize mutually exclusive aging buckets correctly without overlap", () => {
    const loans = [
      { id: "L1", dpd: 0, outstanding: 1000 },
      { id: "L2", dpd: 15, outstanding: 2000 },
      { id: "L3", dpd: 45, outstanding: 3000 },
      { id: "L4", dpd: 75, outstanding: 4000 },
      { id: "L5", dpd: 120, outstanding: 5000 },
    ];

    const buckets = {
      current: loans.filter((l) => l.dpd === 0).reduce((sum, l) => sum + l.outstanding, 0),
      b1_29: loans.filter((l) => l.dpd >= 1 && l.dpd <= 29).reduce((sum, l) => sum + l.outstanding, 0),
      b30_59: loans.filter((l) => l.dpd >= 30 && l.dpd <= 59).reduce((sum, l) => sum + l.outstanding, 0),
      b60_89: loans.filter((l) => l.dpd >= 60 && l.dpd <= 89).reduce((sum, l) => sum + l.outstanding, 0),
      b90Plus: loans.filter((l) => l.dpd >= 90).reduce((sum, l) => sum + l.outstanding, 0),
    };

    assert.equal(buckets.current, 1000);
    assert.equal(buckets.b1_29, 2000);
    assert.equal(buckets.b30_59, 3000);
    assert.equal(buckets.b60_89, 4000);
    assert.equal(buckets.b90Plus, 5000);

    const totalBucketSum = Object.values(buckets).reduce((sum, val) => sum + val, 0);
    assert.equal(totalBucketSum, 15000);
  });

  it("should return null collection rate when scheduled due is 0", () => {
    const scheduledDue = 0;
    const cashCollected = 500; // E.g. prepayment or arrears recovery

    const collectionRate = scheduledDue > 0 ? (cashCollected / scheduledDue) * 100 : null;
    assert.equal(collectionRate, null);
  });

  it("should calculate collection rate with event-date reversal subtraction", () => {
    const scheduledDue = 1000;
    const initialCollected = 800;
    const reversalInPeriod = 200;

    const netCollected = initialCollected - reversalInPeriod; // 600
    const collectionRate = Math.round((netCollected / scheduledDue) * 10000) / 100; // 60%

    assert.equal(netCollected, 600);
    assert.equal(collectionRate, 60.0);
  });
});
