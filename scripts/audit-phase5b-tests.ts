import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  processBankStatementImport,
  executeManualMatch,
  executeUnmatch,
  executeIgnoreLine,
  executeUnignoreLine,
} from "../src/lib/reconciliation/service";
import { getPortfolioQualityReport } from "../src/lib/reports/portfolio-quality-reports";
import { Decimal } from "../src/generated/prisma/internal/prismaNamespace";

async function runPhase5bAuditTests() {
  console.log("==================================================");
  console.log("STARTING PHASE 5B AUDIT VERIFICATION SUITE");
  console.log("==================================================");

  const timestamp = Date.now();

  const adminUser =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ||
    (await prisma.user.create({
      data: {
        email: `admin-audit-${timestamp}@creditflow.local`,
        name: `Admin Audit ${timestamp}`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuu",
        role: "ADMIN",
      },
    }));

  const branch = await prisma.branch.create({
    data: {
      name: `Branch Audit ${timestamp}`,
      code: `BR-AUD-${timestamp}`,
      email: `branch-audit-${timestamp}@creditflow.local`,
      phone: "555-0900",
      address: "900 Audit Way",
      city: "Metro",
      state: "ST",
      country: "US",
      currency: "USD",
    },
  });

  const bankAcc = await prisma.bankAccount.create({
    data: {
      name: `Audit Bank ${timestamp}`,
      accountName: `Ops Account ${timestamp}`,
      accountNumber: `BANK-AUD-${timestamp}`,
      bankName: "Audit Central Bank",
      currency: "USD",
      openingBalance: new Decimal(20000),
      currentBalance: new Decimal(20000),
      branchId: branch.id,
      createdById: adminUser.id,
    },
  });

  // ==================================================
  // AUDIT ITEM 2: REMATCH HISTORY TEST
  // ==================================================
  console.log("\n--------------------------------------------------");
  console.log("AUDIT ITEM 2: Testing Rematch History Lifecycle...");

  // Create 1 statement line and 3 internal bank transactions
  const csvRematch = `Date,Description,Reference,Credit,Balance
2026-09-01,Rematch Line A,REF-REMATCH-${timestamp},100.00,20100.00`;

  const importRematch = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `rematch-${timestamp}.csv`,
    fileContent: csvRematch,
    createdById: adminUser.id,
  });

  const rematchLines = await prisma.bankStatementLine.findMany({ where: { statementImportId: importRematch.id } });
  const lineA = rematchLines[0];

  const txX = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-X-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(100),
      currency: "USD",
      balanceBefore: new Decimal(20000),
      balanceAfter: new Decimal(20100),
      transactionDate: new Date("2026-09-01T10:00:00Z"),
      reference: `REF-X-${timestamp}`,
      description: "Match Candidate X",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  const txY = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-Y-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(100),
      currency: "USD",
      balanceBefore: new Decimal(20100),
      balanceAfter: new Decimal(20200),
      transactionDate: new Date("2026-09-01T11:00:00Z"),
      reference: `REF-Y-${timestamp}`,
      description: "Match Candidate Y",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  const txZ = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-Z-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(100),
      currency: "USD",
      balanceBefore: new Decimal(20200),
      balanceAfter: new Decimal(20300),
      transactionDate: new Date("2026-09-01T12:00:00Z"),
      reference: `REF-Z-${timestamp}`,
      description: "Match Candidate Z",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  // Step 1: Match Line A -> Tx X -> Unmatch
  const match1 = await executeManualMatch({ statementLineId: lineA.id, bankTransactionId: txX.id, actorId: adminUser.id });
  await executeUnmatch({ matchId: match1.id, unmatchReason: "Re-matching to candidate Y", actorId: adminUser.id });

  // Step 2: Match Line A -> Tx Y -> Unmatch
  const match2 = await executeManualMatch({ statementLineId: lineA.id, bankTransactionId: txY.id, actorId: adminUser.id });
  await executeUnmatch({ matchId: match2.id, unmatchReason: "Re-matching to final candidate Z", actorId: adminUser.id });

  // Step 3: Match Line A -> Tx Z
  const match3 = await executeManualMatch({ statementLineId: lineA.id, bankTransactionId: txZ.id, actorId: adminUser.id });

  // Assertions for Rematch History
  const allMatchesForLineA = await prisma.bankReconciliationMatch.findMany({
    where: { statementLineId: lineA.id },
    orderBy: { matchedAt: "asc" },
  });

  assert.equal(allMatchesForLineA.length, 3, "Expected exactly 3 match history records for Line A");
  assert.equal(allMatchesForLineA[0].status, "UNMATCHED", "First match must be UNMATCHED");
  assert.equal(allMatchesForLineA[1].status, "UNMATCHED", "Second match must be UNMATCHED");
  assert.equal(allMatchesForLineA[2].status, "ACTIVE", "Third match must be ACTIVE");

  assert.equal(allMatchesForLineA[0].matchedById, adminUser.id, "Original matchedById must be preserved on 1st match");
  assert.equal(allMatchesForLineA[1].matchedById, adminUser.id, "Original matchedById must be preserved on 2nd match");
  assert.equal(allMatchesForLineA[2].matchedById, adminUser.id, "Original matchedById must be preserved on 3rd match");

  const updatedLineA = await prisma.bankStatementLine.findUnique({ where: { id: lineA.id } });
  assert.equal(updatedLineA?.activeMatchId, match3.id, "BankStatementLine.activeMatchId must point to match3");

  const updatedTxZ = await prisma.bankTransaction.findUnique({ where: { id: txZ.id } });
  assert.equal(updatedTxZ?.activeMatchId, match3.id, "BankTransaction.activeMatchId must point to match3");

  console.log("[PASS] AUDIT ITEM 2: Rematch history lifecycle verified cleanly (3 history records, 2 UNMATCHED, 1 ACTIVE, original matchedById preserved).");

  // ==================================================
  // AUDIT ITEM 3: CONCURRENT MATCH TEST
  // ==================================================
  console.log("\n--------------------------------------------------");
  console.log("AUDIT ITEM 3: Testing Concurrent Match DB Safety...");

  const csvConcurrent = `Date,Description,Reference,Credit,Balance
2026-09-02,Concurrent Line B,REF-CONC-${timestamp},250.00,20350.00`;

  const importConcurrent = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `concurrent-${timestamp}.csv`,
    fileContent: csvConcurrent,
    createdById: adminUser.id,
  });

  const concurrentLines = await prisma.bankStatementLine.findMany({ where: { statementImportId: importConcurrent.id } });
  const lineB = concurrentLines[0];

  const txP = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-P-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(250),
      currency: "USD",
      balanceBefore: new Decimal(20350),
      balanceAfter: new Decimal(20600),
      transactionDate: new Date("2026-09-02T10:00:00Z"),
      reference: `REF-P-${timestamp}`,
      description: "Concurrent Match Candidate P",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  const txQ = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-Q-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(250),
      currency: "USD",
      balanceBefore: new Decimal(20600),
      balanceAfter: new Decimal(20850),
      transactionDate: new Date("2026-09-02T11:00:00Z"),
      reference: `REF-Q-${timestamp}`,
      description: "Concurrent Match Candidate Q",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  // Attempt 2 concurrent match calls against same statement line (Line B -> Tx P vs Line B -> Tx Q)
  const results = await Promise.allSettled([
    executeManualMatch({ statementLineId: lineB.id, bankTransactionId: txP.id, actorId: adminUser.id }),
    executeManualMatch({ statementLineId: lineB.id, bankTransactionId: txQ.id, actorId: adminUser.id }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "Exactly one concurrent match request must succeed");
  assert.equal(rejected.length, 1, "Exactly one concurrent match request must fail");

  console.log(`[PASS] AUDIT ITEM 3: Concurrent match safety verified cleanly (1 succeeded, 1 rejected: "${(rejected[0] as PromiseRejectedResult).reason.message}").`);

  // ==================================================
  // AUDIT ITEM 6: CSV DUPLICATE OVERLAP TEST
  // ==================================================
  console.log("\n--------------------------------------------------");
  console.log("AUDIT ITEM 6: Testing CSV Duplicate Overlap Behavior...");

  const csvImportA = `Date,Description,Reference,Debit,Credit,Balance
2026-08-15,Overlap Tx 1,REF-OVERLAP-1,100.00,,19900.00
2026-08-20,Overlap Tx 2,REF-OVERLAP-2,,300.00,20200.00`;

  const csvImportB = `Date,Description,Reference,Debit,Credit,Balance
2026-08-20,Overlap Tx 2,REF-OVERLAP-2,,300.00,20200.00
2026-09-05,New Tx 3,REF-NEW-3,50.00,,20150.00`;

  const importA = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `importA-${timestamp}.csv`,
    fileContent: csvImportA,
    createdById: adminUser.id,
  });

  const importB = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `importB-${timestamp}.csv`,
    fileContent: csvImportB,
    createdById: adminUser.id,
  });

  assert.equal(importA.validRowCount, 2, "Import A must have 2 valid lines");
  assert.equal(importB.validRowCount, 2, "Import B must have 2 valid lines");

  const linesImportA = await prisma.bankStatementLine.findMany({ where: { statementImportId: importA.id } });
  const linesImportB = await prisma.bankStatementLine.findMany({ where: { statementImportId: importB.id } });

  // Check duplicate external transaction ID constraint scoping
  const overlapLineA = linesImportA.find((l) => l.reference === "REF-OVERLAP-2");
  const overlapLineB = linesImportB.find((l) => l.reference === "REF-OVERLAP-2");

  assert.ok(overlapLineA && overlapLineB, "Both statement lines exist deterministically across imports");
  assert.notEqual(overlapLineA.id, overlapLineB.id, "Statement lines remain distinct rows per import");

  console.log("[PASS] AUDIT ITEM 6: CSV duplicate overlap behavior verified (deterministic distinct statement line rows per import without silent merging or duplicate evidence creation).");

  // ==================================================
  // AUDIT ITEM 7: ZERO FINANCIAL MUTATION PROOF
  // ==================================================
  console.log("\n--------------------------------------------------");
  console.log("AUDIT ITEM 7: Proving Zero Financial Mutation...");

  const testBtx = await prisma.bankTransaction.create({
    data: {
      bankTransactionNumber: `BTX-MUT-${timestamp}`,
      bankAccountId: bankAcc.id,
      type: "DEPOSIT",
      direction: "CREDIT",
      amount: new Decimal(400),
      currency: "USD",
      balanceBefore: new Decimal(20000),
      balanceAfter: new Decimal(20400),
      transactionDate: new Date("2026-09-01T00:00:00Z"),
      reference: `REF-MUT-${timestamp}`,
      description: "Mutation Test Transaction",
      reconciliationStatus: "UNRECONCILED",
      createdById: adminUser.id,
    },
  });

  const csvMutation = `Date,Description,Reference,Credit,Balance
2026-09-01,Mutation Test Line,REF-MUT-${timestamp},400.00,20400.00`;

  const importMutation = await processBankStatementImport({
    bankAccountId: bankAcc.id,
    fileName: `mutation-${timestamp}.csv`,
    fileContent: csvMutation,
    createdById: adminUser.id,
  });

  const mutationLines = await prisma.bankStatementLine.findMany({ where: { statementImportId: importMutation.id } });
  const lineMut = mutationLines[0];

  // Helper to snapshot bank account and transaction financial fields
  async function snapshotFinancials() {
    const acc = await prisma.bankAccount.findUnique({ where: { id: bankAcc.id } });
    const tx = await prisma.bankTransaction.findUnique({ where: { id: testBtx.id } });

    return {
      currentBalance: acc?.currentBalance.toString(),
      amount: tx?.amount.toString(),
      direction: tx?.direction,
      type: tx?.type,
      balanceBefore: tx?.balanceBefore.toString(),
      balanceAfter: tx?.balanceAfter.toString(),
      transactionDate: tx?.transactionDate.toISOString(),
    };
  }

  const snapBefore = await snapshotFinancials();

  // 1. Manual Match
  const mutMatch = await executeManualMatch({ statementLineId: lineMut.id, bankTransactionId: testBtx.id, actorId: adminUser.id });
  const snapAfterMatch = await snapshotFinancials();
  assert.deepEqual(snapBefore, snapAfterMatch, "Financial fields must be 100% identical after match");

  // 2. Unmatch
  await executeUnmatch({ matchId: mutMatch.id, unmatchReason: "Mutation proof test", actorId: adminUser.id });
  const snapAfterUnmatch = await snapshotFinancials();
  assert.deepEqual(snapBefore, snapAfterUnmatch, "Financial fields must be 100% identical after unmatch");

  // 3. Ignore Line
  await executeIgnoreLine({ statementLineId: lineMut.id, ignoreReason: "Mutation proof ignore test", actorId: adminUser.id });
  const snapAfterIgnore = await snapshotFinancials();
  assert.deepEqual(snapBefore, snapAfterIgnore, "Financial fields must be 100% identical after ignore");

  // 4. Unignore Line
  await executeUnignoreLine(lineMut.id, adminUser.id);
  const snapAfterUnignore = await snapshotFinancials();
  assert.deepEqual(snapBefore, snapAfterUnignore, "Financial fields must be 100% identical after unignore");

  console.log("[PASS] AUDIT ITEM 7: Zero Financial Mutation proven mathematically across match, unmatch, ignore, and unignore!");

  // ==================================================
  // AUDIT ITEM 8: PAR MATHEMATICAL ASSERTION
  // ==================================================
  console.log("\n--------------------------------------------------");
  console.log("AUDIT ITEM 8: Testing PAR Mathematical Assertion...");

  const auditMember = await prisma.memberProfile.create({
    data: {
      userId: (await prisma.user.create({
        data: {
          email: `member-par-${timestamp}@creditflow.local`,
          name: `Member PAR ${timestamp}`,
          passwordHash: "$2a$10$abcdefghijklmnopqrstuu",
          role: "MEMBER",
        },
      })).id,
      memberNumber: `MBR-PAR-${timestamp}`,
      branchId: branch.id,
      phone: "555-0999",
      address: "999 PAR St",
    },
  });

  const auditProduct = await prisma.loanProduct.create({
    data: {
      name: `PAR Product ${timestamp}`,
      code: `PROD-PAR-${timestamp}`,
      branchId: branch.id,
      currency: "USD",
      minimumAmount: new Decimal(500),
      maximumAmount: new Decimal(50000),
      minimumTermMonths: 6,
      maximumTermMonths: 36,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      repaymentFrequency: "MONTHLY",
      processingFeeType: "FIXED",
      processingFeeValue: new Decimal(0),
      status: "ACTIVE",
    },
  });

  // Loan A: $1,000 DPD 0
  await prisma.loan.create({
    data: {
      loanNumber: `LN-PAR-A-${timestamp}`,
      memberId: auditMember.id,
      branchId: branch.id,
      productId: auditProduct.id,
      principalAmount: new Decimal(1000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-08-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date("2026-09-15T00:00:00Z"),
            principalDue: new Decimal(1000),
            interestDue: new Decimal(100),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(1100),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 0,
            status: "PENDING",
          },
        ],
      },
    },
  });

  // Loan B: $2,000 DPD 30
  await prisma.loan.create({
    data: {
      loanNumber: `LN-PAR-B-${timestamp}`,
      memberId: auditMember.id,
      branchId: branch.id,
      productId: auditProduct.id,
      principalAmount: new Decimal(2000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-07-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            principalDue: new Decimal(2000),
            interestDue: new Decimal(200),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(2200),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 30,
            status: "OVERDUE",
          },
        ],
      },
    },
  });

  // Loan C: $3,000 DPD 90
  await prisma.loan.create({
    data: {
      loanNumber: `LN-PAR-C-${timestamp}`,
      memberId: auditMember.id,
      branchId: branch.id,
      productId: auditProduct.id,
      principalAmount: new Decimal(3000),
      currency: "USD",
      termMonths: 12,
      interestRate: new Decimal(12),
      interestType: "FLAT",
      status: "ACTIVE",
      disbursementDate: new Date("2026-05-01T00:00:00Z"),
      repaymentSchedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            principalDue: new Decimal(3000),
            interestDue: new Decimal(300),
            feeDue: new Decimal(0),
            penaltyDue: new Decimal(0),
            totalDue: new Decimal(3300),
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            feePaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            totalPaid: new Decimal(0),
            overdueDays: 90,
            status: "OVERDUE",
          },
        ],
      },
    },
  });

  const report = await getPortfolioQualityReport({ branchId: branch.id, currency: "USD" }, [branch.id]);
  const parUsd = report.parSummaries.find((s) => s.currency === "USD");

  assert.ok(parUsd, "USD PAR summary must exist");
  assert.equal(parUsd.totalOutstandingPrincipal, 6000, "Total portfolio principal must be $6,000");
  assert.equal(parUsd.par30Amount, 5000, "PAR30 exposure must be $5,000");
  assert.equal(parUsd.par30Rate, 83.33, "PAR30 rate must be 83.33%");
  assert.equal(parUsd.par90Amount, 3000, "PAR90 exposure must be $3,000");
  assert.equal(parUsd.par90Rate, 50.0, "PAR90 rate must be 50.00%");

  console.log(`   Total Outstanding Principal Portfolio: $${parUsd.totalOutstandingPrincipal.toLocaleString()}`);
  console.log(`   PAR30 Rate: ${parUsd.par30Rate}% ($${parUsd.par30Amount.toLocaleString()})`);
  console.log(`   PAR90 Rate: ${parUsd.par90Rate}% ($${parUsd.par90Amount.toLocaleString()})`);

  console.log("[PASS] AUDIT ITEM 8: PAR mathematical assertions verified!");

  console.log("==================================================");
  console.log("ALL PHASE 5B AUDIT TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runPhase5bAuditTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 5B Audit Tests Failed:", err);
    process.exit(1);
  });
