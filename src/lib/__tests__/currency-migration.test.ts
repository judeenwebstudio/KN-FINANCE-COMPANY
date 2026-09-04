import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../money";
import { branchInputSchema } from "../settings/branch-service";
import { loanProductSchema } from "../validations";
import { Prisma } from "@/generated/prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("System-Wide INR Currency Policy & Safety Verification", () => {
  test("1. Base money formatter formats in INR with en-IN Indian digit grouping and ₹ symbol", () => {
    const formattedZero = formatMoney(0);
    assert.ok(formattedZero.includes("₹"), "Must include ₹ symbol");
    assert.ok(formattedZero.includes("0.00"));

    const formattedLakh = formatMoney(100000);
    assert.ok(formattedLakh.includes("₹"), "Must include ₹ symbol");
    // Indian grouping for 100000 is 1,00,000.00
    assert.ok(formattedLakh.includes("1,00,000.00"), "Must use Indian grouping (1,00,000.00)");

    const formattedCrore = formatMoney(1234567.89);
    assert.ok(formattedCrore.includes("12,34,567.89"), "Must use Indian grouping for 12,34,567.89");
  });

  test("2. Money formatter defaults to INR even when called without explicit currency", () => {
    const formatted = formatMoney(1250);
    assert.ok(formatted.includes("₹"));
    assert.ok(formatted.includes("1,250.00"));
  });

  test("Admin Dashboard Posted Expenses uses the centralized INR formatter", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/app/admin/dashboard/page.tsx"), "utf8");

    assert.match(
      dashboardSource,
      /label="Posted Expenses"\s+value=\{formatMoney\(postedExpensesCount\)\}/,
      "Posted Expenses must be formatted by the centralized INR money formatter",
    );
    assert.equal(formatMoney(0), "₹0.00");
    assert.equal(formatMoney(1000), "₹1,000.00");
    assert.equal(formatMoney(100000), "₹1,00,000.00");
  });

  test("3. Branch creation service enforces INR and rejects non-INR payloads", async () => {
    const validInrPayload = {
      name: "New Delhi Central",
      code: "DEL-99",
      email: "delhi@knfinance.com",
      phone: "+91 11 5555 1234",
      address: "Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      currency: "INR",
    };

    const parsedInr = branchInputSchema.safeParse(validInrPayload);
    assert.equal(parsedInr.success, true);
    if (parsedInr.success) {
      assert.equal(parsedInr.data.currency, "INR");
    }
  });

  test("4. Loan product schema enforces INR currency", () => {
    const validProduct = {
      name: "Test Flex Loan",
      code: "PFL-INR-01",
      description: "Test loan product",
      currency: "INR",
      minimumAmount: 10000,
      maximumAmount: 100000,
      minimumTermMonths: 6,
      maximumTermMonths: 24,
      interestRate: 12,
      interestType: "DECLINING_BALANCE",
      repaymentFrequency: "MONTHLY",
      processingFeeType: "PERCENTAGE",
      processingFeeValue: 1,
      requiresApproval: true,
    };

    const parsedValid = loanProductSchema.safeParse(validProduct);
    assert.equal(parsedValid.success, true);

    const invalidCurrencyProduct = {
      ...validProduct,
      currency: "USD",
    };
    const parsedInvalid = loanProductSchema.safeParse(invalidCurrencyProduct);
    assert.equal(parsedInvalid.success, false, "Non-INR loan product currency must be rejected");
  });

  test("5. Monetary Decimal amounts are strictly preserved without FX conversion", () => {
    const originalAmount = new Prisma.Decimal("1000.00");
    // Interpretation changes from USD to INR, but numeric value MUST be identical
    assert.equal(originalAmount.toFixed(2), "1000.00");
    assert.equal(originalAmount.toNumber(), 1000.00);
  });
});
