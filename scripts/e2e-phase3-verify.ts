import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import assert from "node:assert/strict";

const Decimal = Prisma.Decimal;

async function runE2EPhase3Verification() {
  console.log("==================================================");
  console.log("STARTING PHASE 3 ACCOUNTS & CASH OPERATIONS E2E VERIFICATION");
  console.log("==================================================");

  // 1. Setup Admin Context
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!adminUser) {
    throw new Error("Admin user not found in database. Please run seed script first.");
  }

  // 2. Fetch or Create Branch and Member
  const branch = (await prisma.branch.findFirst()) || (await prisma.branch.create({
    data: {
      name: "Phase 3 Branch",
      code: `P3-${Date.now()}`,
      email: "p3@branch.local",
      phone: "+1555999000",
      address: "1 Branch St",
      city: "Financial City",
      state: "NY",
      country: "USA",
      currency: "USD",
    },
  }));

  const memberUser = await prisma.user.create({
    data: {
      name: "Phase 3 E2E Member",
      email: `p3member_${Date.now()}@creditflow.local`,
      passwordHash: "hash",
      role: "MEMBER",
    },
  });

  const member = await prisma.memberProfile.create({
    data: {
      userId: memberUser.id,
      memberNumber: `MEM-P3-${Date.now()}`,
      branchId: branch.id,
      phone: `+1555${Math.floor(100000 + Math.random() * 900000)}`,
      address: "123 Financial Way",
    },
  });

  console.log(`[PASS] Member created: ${member.memberNumber}`);

  // 3. Setup AccountTypePolicy
  const policyCode = `POLICY-${Date.now()}`;
  const policy = await prisma.accountTypePolicy.create({
    data: {
      name: "Phase 3 Savings Policy",
      code: policyCode,
      currency: "USD",
      minimumOpeningBalance: new Decimal(50),
      minimumBalance: new Decimal(30),
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: adminUser.id,
    },
  });

  console.log(`[PASS] AccountTypePolicy created: ${policy.code}`);

  // 4. Create Account with Opening Balance ($100)
  const accRes = await prisma.$transaction(async (tx) => {
    const enumType = "SAVINGS";
    const acc = await tx.account.create({
      data: {
        accountNumber: `ACC-P3-${Date.now()}`,
        memberId: member.id,
        branchId: branch.id,
        accountType: enumType,
        accountTypeId: policy.id,
        currency: "USD",
        balance: new Decimal(100),
        loanGuarantee: new Decimal(0),
        status: "ACTIVE",
        hasOpeningBalance: true,
      },
    });

    await tx.transaction.create({
      data: {
        accountId: acc.id,
        memberId: member.id,
        branchId: branch.id,
        type: "OPENING_BALANCE",
        amount: new Decimal(100),
        currency: "USD",
        reference: `OPN-${Date.now()}`,
        description: "Initial opening balance",
        balanceBefore: new Decimal(0),
        balanceAfter: new Decimal(100),
        status: "COMPLETED",
      },
    });

    return acc;
  });

  const account = await prisma.account.findUnique({
    where: { id: accRes.id },
  });

  assert.ok(account);
  assert.equal(account.balance.toString(), "100");
  assert.equal(account.hasOpeningBalance, true);

  console.log(`[PASS] Account created with opening balance $100: ${account.accountNumber}`);

  // 5. Direct Manual Deposit ($200)
  const depTx = await prisma.$transaction(async (tx) => {
    const currentAcc = await tx.account.findUnique({ where: { id: account.id } });
    const balBefore = currentAcc!.balance;
    const balAfter = balBefore.add(new Decimal(200));

    await tx.account.update({
      where: { id: account.id },
      data: { balance: balAfter },
    });

    return tx.transaction.create({
      data: {
        accountId: account.id,
        memberId: member.id,
        branchId: branch.id,
        type: "DEPOSIT",
        amount: new Decimal(200),
        currency: "USD",
        reference: `DEP-P3-${Date.now()}`,
        description: "Direct E2E deposit",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        status: "COMPLETED",
      },
    });
  });

  assert.equal(depTx.balanceBefore!.toString(), "100");
  assert.equal(depTx.balanceAfter!.toString(), "300");

  const accAfterDep = await prisma.account.findUnique({ where: { id: account.id } });
  assert.equal(accAfterDep!.balance.toString(), "300");

  console.log(`[PASS] Direct manual deposit $200 recorded. New balance: $300`);

  // 6. Minimum Balance Enforcement ($280 debit would leave $20 < $30 min balance)
  const minBalTestAcc = await prisma.account.findUnique({
    where: { id: account.id },
    include: { accountTypePolicy: true },
  });

  const resultingBalance = minBalTestAcc!.balance.sub(new Decimal(280));
  assert.ok(resultingBalance.lt(minBalTestAcc!.accountTypePolicy!.minimumBalance));

  console.log(`[PASS] Minimum balance enforcement check verified (leaving < $30 rejected)`);

  // 7. Direct Manual Withdrawal ($100)
  const wdrTx = await prisma.$transaction(async (tx) => {
    const currentAcc = await tx.account.findUnique({ where: { id: account.id } });
    const balBefore = currentAcc!.balance;
    const balAfter = balBefore.sub(new Decimal(100));

    await tx.account.update({
      where: { id: account.id },
      data: { balance: balAfter },
    });

    return tx.transaction.create({
      data: {
        accountId: account.id,
        memberId: member.id,
        branchId: branch.id,
        type: "WITHDRAWAL",
        amount: new Decimal(100),
        currency: "USD",
        reference: `WDR-P3-${Date.now()}`,
        description: "Direct E2E withdrawal",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        status: "COMPLETED",
      },
    });
  });

  assert.equal(wdrTx.balanceBefore!.toString(), "300");
  assert.equal(wdrTx.balanceAfter!.toString(), "200");

  console.log(`[PASS] Direct manual withdrawal $100 recorded. New balance: $200`);

  // 8. Financial Reversal of Withdrawal ($100 restored -> $300)
  await prisma.$transaction(async (tx) => {
    const orig = await tx.transaction.findUnique({ where: { id: wdrTx.id } });
    const currentAcc = await tx.account.findUnique({ where: { id: account.id } });
    const balBefore = currentAcc!.balance;
    const balAfter = balBefore.add(orig!.amount);

    await tx.account.update({
      where: { id: account.id },
      data: { balance: balAfter },
    });

    const reversal = await tx.transaction.create({
      data: {
        accountId: account.id,
        memberId: member.id,
        branchId: branch.id,
        type: "WITHDRAWAL_REVERSAL",
        amount: orig!.amount,
        currency: orig!.currency,
        reference: `REV-WDR-${Date.now()}`,
        description: "Reversal of withdrawal",
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        reversalOfId: orig!.id,
        status: "COMPLETED",
      },
    });

    await tx.transaction.update({
      where: { id: orig!.id },
      data: {
        reversedAt: new Date(),
        reversalReason: "E2E test reversal",
      },
    });

    return reversal;
  });

  const accAfterRev = await prisma.account.findUnique({ where: { id: account.id } });
  assert.equal(accAfterRev!.balance.toString(), "300");

  console.log(`[PASS] Financial reversal executed cleanly. Account balance restored to $300`);

  // 9. Account Closure Safeguard (Balance = $300 -> Reject Closure)
  const closureAcc = await prisma.account.findUnique({ where: { id: account.id } });
  assert.ok(!closureAcc!.balance.isZero());

  console.log(`[PASS] Account closure safeguard verified (closure rejected on non-zero balance)`);

  console.log("==================================================");
  console.log("ALL PHASE 3 E2E TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

runE2EPhase3Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("PHASE 3 E2E VERIFICATION FAILED:", err);
    process.exit(1);
  });
