import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";

const Decimal = Prisma.Decimal;

async function runPhase4E2EVerification() {
  console.log("==================================================");
  console.log("STARTING PHASE 4 EXPENSES & BANKING E2E VERIFICATION");
  console.log("==================================================");

  // 1. Fetch or create test Branch and Admin User
  let branch = await prisma.branch.findFirst({ where: { status: "ACTIVE" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: "E2E Banking Branch",
        code: `BR-P4-${Date.now()}`,
        email: `p4-branch-${Date.now()}@creditflow.local`,
        phone: "555-0404",
        address: "100 Treasury Way",
        city: "Finance City",
        state: "FC",
        country: "US",
        currency: "USD",
      },
    });
  }

  let adminUser = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "Phase4 E2E Admin",
        email: `p4-admin-${Date.now()}@creditflow.local`,
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "ACTIVE",
        branchId: branch.id,
      },
    });
  }

  const timestamp = Date.now();

  // 2. Create TreasuryAccount with Opening Balance ($1,000)
  const treasuryAcc = await prisma.$transaction(async (tx) => {
    const created = await tx.treasuryAccount.create({
      data: {
        name: `Main Treasury Cash ${timestamp}`,
        code: `TREAS-P4-${timestamp}`,
        accountNumber: `TREAS-ACC-${timestamp}`,
        branchId: branch!.id,
        currency: "USD",
        balance: new Decimal(1000),
        status: "ACTIVE",
        createdById: adminUser!.id,
      },
    });

    await tx.treasuryTransaction.create({
      data: {
        treasuryTransactionNumber: `TTX-OPN-${timestamp}`,
        treasuryAccountId: created.id,
        type: "OPENING_BALANCE",
        direction: "CREDIT",
        amount: new Decimal(1000),
        currency: "USD",
        balanceBefore: new Decimal(0),
        balanceAfter: new Decimal(1000),
        reference: `OPN-${timestamp}`,
        description: "Opening cash balance",
        createdById: adminUser!.id,
      },
    });

    return created;
  });

  assert.equal(treasuryAcc.balance.toString(), "1000");
  console.log(`[PASS] TreasuryAccount created with $1,000 opening balance: ${treasuryAcc.accountNumber}`);

  // 3. Create BankAccount-A with Opening Balance ($5,000)
  const bankAccA = await prisma.$transaction(async (tx) => {
    const created = await tx.bankAccount.create({
      data: {
        name: `Primary Operating Bank ${timestamp}`,
        accountName: "CreditFlow Operations LLC",
        accountNumber: `BANK-A-${timestamp}`,
        bankName: "Chase Bank",
        branchName: "Main St",
        branchId: branch!.id,
        currency: "USD",
        openingBalance: new Decimal(5000),
        currentBalance: new Decimal(5000),
        status: "ACTIVE",
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-OPN-${timestamp}`,
        bankAccountId: created.id,
        type: "OPENING_BALANCE",
        direction: "CREDIT",
        amount: new Decimal(5000),
        currency: "USD",
        balanceBefore: new Decimal(0),
        balanceAfter: new Decimal(5000),
        reference: `OPN-BANK-${timestamp}`,
        description: "Opening bank balance",
        createdById: adminUser!.id,
      },
    });

    return created;
  });

  assert.equal(bankAccA.currentBalance.toString(), "5000");
  console.log(`[PASS] BankAccount-A created with $5,000 opening balance: ${bankAccA.accountNumber}`);

  // 4. Record Manual Bank Deposit ($2,000) -> $7,000
  const depTx = await prisma.$transaction(async (tx) => {
    const currentAcc = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const balBefore = currentAcc!.currentBalance;
    const balAfter = balBefore.add(new Decimal(2000));

    await tx.bankAccount.update({
      where: { id: bankAccA.id },
      data: { currentBalance: balAfter },
    });

    return tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-DEP-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "DEPOSIT",
        direction: "CREDIT",
        amount: new Decimal(2000),
        currency: "USD",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        reference: `DEP-${timestamp}`,
        description: "External wire deposit",
        createdById: adminUser!.id,
      },
    });
  });

  assert.equal(depTx.balanceAfter.toString(), "7000");
  console.log(`[PASS] Manual bank deposit $2,000 recorded. New balance: $7,000`);

  // 5. Record Manual Bank Withdrawal ($1,000) -> $6,000
  const wdrTx = await prisma.$transaction(async (tx) => {
    const currentAcc = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const balBefore = currentAcc!.currentBalance;
    const balAfter = balBefore.sub(new Decimal(1000));

    await tx.bankAccount.update({
      where: { id: bankAccA.id },
      data: { currentBalance: balAfter },
    });

    return tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-WDR-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "WITHDRAWAL",
        direction: "DEBIT",
        amount: new Decimal(1000),
        currency: "USD",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        reference: `WDR-${timestamp}`,
        description: "External bank withdrawal",
        createdById: adminUser!.id,
      },
    });
  });

  assert.equal(wdrTx.balanceAfter.toString(), "6000");
  console.log(`[PASS] Manual bank withdrawal $1,000 recorded. New balance: $6,000`);

  // 6. Create ExpenseCategory & Post Bank-funded Expense ($1,500) -> $4,500
  const expCat = await prisma.expenseCategory.create({
    data: {
      name: `Office Rent ${timestamp}`,
      code: `RENT-${timestamp}`,
      status: "ACTIVE",
      branchId: branch.id,
      createdById: adminUser.id,
    },
  });

  const expense = await prisma.$transaction(async (tx) => {
    const currentAcc = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const balBefore = currentAcc!.currentBalance;
    const balAfter = balBefore.sub(new Decimal(1500));

    await tx.bankAccount.update({
      where: { id: bankAccA.id },
      data: { currentBalance: balAfter },
    });

    const exp = await tx.expense.create({
      data: {
        expenseNumber: `EXP-P4-${timestamp}`,
        branchId: branch!.id,
        categoryId: expCat.id,
        amount: new Decimal(1500),
        currency: "USD",
        expenseDate: new Date(),
        paymentSourceType: "BANK",
        bankAccountId: bankAccA.id,
        status: "POSTED",
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-EXP-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "EXPENSE",
        direction: "DEBIT",
        amount: new Decimal(1500),
        currency: "USD",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        expenseId: exp.id,
        reference: exp.expenseNumber,
        description: `Expense: ${expCat.name}`,
        createdById: adminUser!.id,
      },
    });

    return exp;
  });

  const bankAfterExp = await prisma.bankAccount.findUnique({ where: { id: bankAccA.id } });
  assert.equal(bankAfterExp!.currentBalance.toString(), "4500");
  console.log(`[PASS] Bank-funded Expense $1,500 posted. New bank balance: $4,500`);

  // 7. Reverse Expense ($1,500 restored -> $6,000)
  await prisma.$transaction(async (tx) => {
    const origExp = await tx.expense.findUnique({
      where: { id: expense.id },
      include: { bankTransactions: { where: { type: "EXPENSE" } } },
    });
    const currentAcc = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const balBefore = currentAcc!.currentBalance;
    const balAfter = balBefore.add(origExp!.amount);

    await tx.bankAccount.update({
      where: { id: bankAccA.id },
      data: { currentBalance: balAfter },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-EXP-REV-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "REVERSAL",
        direction: "CREDIT",
        amount: origExp!.amount,
        currency: "USD",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        expenseId: origExp!.id,
        reversalOfId: origExp!.bankTransactions[0].id,
        reference: `REV-${origExp!.expenseNumber}`,
        description: "Expense Reversal",
        createdById: adminUser!.id,
      },
    });

    await tx.expense.update({
      where: { id: origExp!.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedById: adminUser!.id,
        reversalReason: "E2E Test Reversal",
      },
    });
  });

  const bankAfterExpRev = await prisma.bankAccount.findUnique({ where: { id: bankAccA.id } });
  assert.equal(bankAfterExpRev!.currentBalance.toString(), "6000");
  console.log(`[PASS] Expense reversal executed. Restored bank balance: $6,000`);

  // 8. Cash -> Bank Transfer ($500)
  // Treasury $1,000 -> $500 | Bank-A $6,000 -> $6,500
  await prisma.$transaction(async (tx) => {
    const srcTreasury = await tx.treasuryAccount.findUnique({ where: { id: treasuryAcc.id } });
    const destBank = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });

    const trfAmount = new Decimal(500);

    const srcBalBefore = srcTreasury!.balance;
    const srcBalAfter = srcBalBefore.sub(trfAmount);

    const destBalBefore = destBank!.currentBalance;
    const destBalAfter = destBalBefore.add(trfAmount);

    await tx.treasuryAccount.update({ where: { id: treasuryAcc.id }, data: { balance: srcBalAfter } });
    await tx.bankAccount.update({ where: { id: bankAccA.id }, data: { currentBalance: destBalAfter } });

    const trf = await tx.transfer.create({
      data: {
        transferNumber: `TRF-CB-${timestamp}`,
        transferType: "CASH_TO_BANK",
        sourceTreasuryAccountId: treasuryAcc.id,
        destinationBankAccountId: bankAccA.id,
        amount: trfAmount,
        currency: "USD",
        status: "COMPLETED",
        createdById: adminUser!.id,
      },
    });

    await tx.treasuryTransaction.create({
      data: {
        treasuryTransactionNumber: `TTX-TRF-OUT-${timestamp}`,
        treasuryAccountId: treasuryAcc.id,
        type: "TRANSFER_OUT",
        direction: "DEBIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: srcBalBefore,
        balanceAfter: srcBalAfter,
        transferId: trf.id,
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-TRF-IN-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "TRANSFER_IN",
        direction: "CREDIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: destBalBefore,
        balanceAfter: destBalAfter,
        transferId: trf.id,
        createdById: adminUser!.id,
      },
    });

    return trf;
  });

  const treasuryAfterTrf = await prisma.treasuryAccount.findUnique({ where: { id: treasuryAcc.id } });
  const bankAfterTrf = await prisma.bankAccount.findUnique({ where: { id: bankAccA.id } });
  assert.equal(treasuryAfterTrf!.balance.toString(), "500");
  assert.equal(bankAfterTrf!.currentBalance.toString(), "6500");
  console.log(`[PASS] Cash -> Bank Transfer ($500) completed. Treasury: $500, Bank-A: $6,500`);

  // 9. Bank -> Bank Transfer ($1,000 from Bank-A to Bank-B)
  const bankAccB = await prisma.bankAccount.create({
    data: {
      name: `Secondary Bank ${timestamp}`,
      accountName: "CreditFlow Reserve LLC",
      accountNumber: `BANK-B-${timestamp}`,
      bankName: "Wells Fargo",
      branchId: branch.id,
      currency: "USD",
      openingBalance: new Decimal(0),
      currentBalance: new Decimal(0),
      status: "ACTIVE",
      createdById: adminUser.id,
    },
  });

  const b2bTransfer = await prisma.$transaction(async (tx) => {
    const srcBank = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const destBank = await tx.bankAccount.findUnique({ where: { id: bankAccB.id } });

    const trfAmount = new Decimal(1000);

    const srcBalBefore = srcBank!.currentBalance;
    const srcBalAfter = srcBalBefore.sub(trfAmount);

    const destBalBefore = destBank!.currentBalance;
    const destBalAfter = destBalBefore.add(trfAmount);

    await tx.bankAccount.update({ where: { id: bankAccA.id }, data: { currentBalance: srcBalAfter } });
    await tx.bankAccount.update({ where: { id: bankAccB.id }, data: { currentBalance: destBalAfter } });

    const trf = await tx.transfer.create({
      data: {
        transferNumber: `TRF-BB-${timestamp}`,
        transferType: "BANK_TO_BANK",
        sourceBankAccountId: bankAccA.id,
        destinationBankAccountId: bankAccB.id,
        amount: trfAmount,
        currency: "USD",
        status: "COMPLETED",
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-B2B-OUT-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "TRANSFER_OUT",
        direction: "DEBIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: srcBalBefore,
        balanceAfter: srcBalAfter,
        transferId: trf.id,
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-B2B-IN-${timestamp}`,
        bankAccountId: bankAccB.id,
        type: "TRANSFER_IN",
        direction: "CREDIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: destBalBefore,
        balanceAfter: destBalAfter,
        transferId: trf.id,
        createdById: adminUser!.id,
      },
    });

    return trf;
  });

  const bankAAfterB2B = await prisma.bankAccount.findUnique({ where: { id: bankAccA.id } });
  const bankBAfterB2B = await prisma.bankAccount.findUnique({ where: { id: bankAccB.id } });
  assert.equal(bankAAfterB2B!.currentBalance.toString(), "5500");
  assert.equal(bankBAfterB2B!.currentBalance.toString(), "1000");
  console.log(`[PASS] Bank -> Bank Transfer ($1,000) completed. Bank-A: $5,500, Bank-B: $1,000`);

  // 10. Reverse Bank -> Bank Transfer ($1,000)
  await prisma.$transaction(async (tx) => {
    const origTrf = await tx.transfer.findUnique({ where: { id: b2bTransfer.id } });
    const srcBank = await tx.bankAccount.findUnique({ where: { id: bankAccA.id } });
    const destBank = await tx.bankAccount.findUnique({ where: { id: bankAccB.id } });

    const trfAmount = origTrf!.amount;

    // Verify destination has sufficient balance for reversing debit
    assert.ok(destBank!.currentBalance.gte(trfAmount));

    const srcBalBefore = srcBank!.currentBalance;
    const srcBalAfter = srcBalBefore.add(trfAmount);

    const destBalBefore = destBank!.currentBalance;
    const destBalAfter = destBalBefore.sub(trfAmount);

    await tx.bankAccount.update({ where: { id: bankAccA.id }, data: { currentBalance: srcBalAfter } });
    await tx.bankAccount.update({ where: { id: bankAccB.id }, data: { currentBalance: destBalAfter } });

    await tx.transfer.update({
      where: { id: origTrf!.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedById: adminUser!.id,
        reversalReason: "E2E B2B Transfer Reversal",
      },
    });

    const revTrf = await tx.transfer.create({
      data: {
        transferNumber: `TRF-REV-BB-${timestamp}`,
        transferType: "BANK_TO_BANK",
        sourceBankAccountId: bankAccB.id,
        destinationBankAccountId: bankAccA.id,
        amount: trfAmount,
        currency: "USD",
        status: "COMPLETED",
        reversalOfId: origTrf!.id,
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-REV-B2B-DEB-${timestamp}`,
        bankAccountId: bankAccB.id,
        type: "REVERSAL",
        direction: "DEBIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: destBalBefore,
        balanceAfter: destBalAfter,
        transferId: revTrf.id,
        createdById: adminUser!.id,
      },
    });

    await tx.bankTransaction.create({
      data: {
        bankTransactionNumber: `BTX-REV-B2B-CRE-${timestamp}`,
        bankAccountId: bankAccA.id,
        type: "REVERSAL",
        direction: "CREDIT",
        amount: trfAmount,
        currency: "USD",
        balanceBefore: srcBalBefore,
        balanceAfter: srcBalAfter,
        transferId: revTrf.id,
        createdById: adminUser!.id,
      },
    });
  });

  const bankAFinal = await prisma.bankAccount.findUnique({ where: { id: bankAccA.id } });
  const bankBFinal = await prisma.bankAccount.findUnique({ where: { id: bankAccB.id } });
  assert.equal(bankAFinal!.currentBalance.toString(), "6500");
  assert.equal(bankBFinal!.currentBalance.toString(), "0");
  console.log(`[PASS] Bank -> Bank Transfer Reversal completed. Bank-A restored to $6,500, Bank-B restored to $0`);

  // 11. SUBLEDGER MATHEMATICAL RECONCILIATION
  // For Bank-A:
  const bankATxs = await prisma.bankTransaction.findMany({ where: { bankAccountId: bankAccA.id } });
  let btxCredits = new Decimal(0);
  let btxDebits = new Decimal(0);

  for (const t of bankATxs) {
    if (t.direction === "CREDIT") btxCredits = btxCredits.add(t.amount);
    else if (t.direction === "DEBIT") btxDebits = btxDebits.sub(t.amount); // DEBIT reduces balance
  }

  // Current balance = SUM(CREDIT) - SUM(DEBIT)
  const calcBankABal = btxCredits.sub(btxDebits.abs());
  assert.equal(bankAFinal!.currentBalance.toString(), calcBankABal.toString());
  console.log(`[PASS] BankAccount-A Subledger Reconciled Perfectly: DB balance = $${bankAFinal!.currentBalance} == Sum(Ledger) = $${calcBankABal}`);

  // For TreasuryAccount:
  const treasuryTxs = await prisma.treasuryTransaction.findMany({ where: { treasuryAccountId: treasuryAcc.id } });
  let ttxCredits = new Decimal(0);
  let ttxDebits = new Decimal(0);

  for (const t of treasuryTxs) {
    if (t.direction === "CREDIT") ttxCredits = ttxCredits.add(t.amount);
    else if (t.direction === "DEBIT") ttxDebits = ttxDebits.sub(t.amount);
  }

  const calcTreasuryBal = ttxCredits.sub(ttxDebits.abs());
  assert.equal(treasuryAfterTrf!.balance.toString(), calcTreasuryBal.toString());
  console.log(`[PASS] TreasuryAccount Subledger Reconciled Perfectly: DB balance = $${treasuryAfterTrf!.balance} == Sum(Ledger) = $${calcTreasuryBal}`);

  console.log("==================================================");
  console.log("ALL PHASE 4 E2E TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runPhase4E2EVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Phase 4 E2E Verification Failed:", err);
    process.exit(1);
  });
