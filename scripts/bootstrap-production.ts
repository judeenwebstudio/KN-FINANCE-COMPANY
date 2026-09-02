import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { bootstrapRBAC } from "../src/lib/auth/bootstrap";
import { Role } from "../src/generated/prisma/client";

async function main() {
  console.log("[Production Bootstrap] Starting secure production database bootstrap...");

  const email = process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_SUPERADMIN_PASSWORD;
  const branchName = process.env.INITIAL_BRANCH_NAME?.trim() || "Head Office";
  const branchCode = process.env.INITIAL_BRANCH_CODE?.trim() || "HQ-01";

  // Validate environment variables before performing any database writes
  if (!email || !email.includes("@")) {
    console.error("[Production Bootstrap] ERROR: INITIAL_SUPERADMIN_EMAIL is required and must be a valid email address.");
    process.exit(1);
  }

  if (!password || password.length < 12) {
    console.error("[Production Bootstrap] ERROR: INITIAL_SUPERADMIN_PASSWORD is required and must be at least 12 characters long.");
    process.exit(1);
  }

  // 1. Create or update Primary Production Branch (Head Office)
  const primaryBranch = await prisma.branch.upsert({
    where: { code: branchCode },
    update: { name: branchName },
    create: {
      name: branchName,
      code: branchCode,
      email: email,
      phone: "+1-000-000-0000",
      address: "Primary Headquarters",
      city: "Corporate City",
      state: "Main State",
      country: "Primary Country",
      currency: "USD",
    },
  });

  // 2. Hash Password using bcryptjs (cost factor 12)
  const passwordHash = await hash(password, 12);

  // 3. Create or update Initial Production Super Admin User
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Super Administrator",
      passwordHash,
      role: Role.SUPER_ADMIN,
      hasGlobalBranchAccess: true,
      status: "ACTIVE",
    },
    create: {
      name: "Super Administrator",
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      branchId: primaryBranch.id,
      hasGlobalBranchAccess: true,
      status: "ACTIVE",
    },
  });

  // 4. Seed Required AccountTypePolicy Records
  await prisma.accountTypePolicy.upsert({
    where: { code: "SAVINGS" },
    update: {},
    create: {
      name: "Standard Savings Account",
      code: "SAVINGS",
      description: "Standard member savings account supporting deposits and withdrawals.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  await prisma.accountTypePolicy.upsert({
    where: { code: "CHECKING" },
    update: {},
    create: {
      name: "Current Checking Account",
      code: "CHECKING",
      description: "Standard checking account for daily operational cash activities.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  await prisma.accountTypePolicy.upsert({
    where: { code: "SETTLEMENT" },
    update: {},
    create: {
      name: "Loan Settlement Account",
      code: "SETTLEMENT",
      description: "Specialized settlement account for loan disbursements and repayments.",
      minimumOpeningBalance: 0,
      minimumBalance: 0,
      allowDeposits: true,
      allowWithdrawals: true,
      status: "ACTIVE",
      createdById: superAdmin.id,
    },
  });

  // 5. Seed Required Transaction Categories
  const categories = [
    { code: "CASH_DEPOSIT", name: "Cash Deposit", description: "Direct over-the-counter cash deposit", direction: "CREDIT" },
    { code: "BANK_DEPOSIT", name: "Bank Deposit", description: "Bank transfer / deposit request approval", direction: "CREDIT" },
    { code: "CASH_WITHDRAWAL", name: "Cash Withdrawal", description: "Over-the-counter cash withdrawal", direction: "DEBIT" },
    { code: "BANK_WITHDRAWAL", name: "Bank Withdrawal", description: "Bank transfer withdrawal request approval", direction: "DEBIT" },
    { code: "OPENING_BALANCE", name: "Opening Balance", description: "Initial opening balance for new account", direction: "CREDIT" },
    { code: "ADJUSTMENT", name: "Account Adjustment", description: "Operational correction or adjustment", direction: "BOTH" },
  ];

  for (const cat of categories) {
    await prisma.transactionCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description, direction: cat.direction },
      create: {
        code: cat.code,
        name: cat.name,
        description: cat.description,
        direction: cat.direction,
        status: "ACTIVE",
        createdById: superAdmin.id,
      },
    });
  }

  // 6. Execute Phase 6 RBAC Bootstrap (Seeds catalog, system roles, role permissions, and assigns relational super_admin role)
  const rbacResult = await bootstrapRBAC();

  console.log("[Production Bootstrap] SUCCESS: Secure production database bootstrap complete.");
  console.log(`[Production Bootstrap] Primary Branch: ${primaryBranch.name} (${primaryBranch.code})`);
  console.log(`[Production Bootstrap] Super Admin User: ${superAdmin.email}`);
  console.log(`[Production Bootstrap] RBAC Summary: ${rbacResult.permissionsSeeded} permissions, ${rbacResult.rolesSeeded} system roles.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("[Production Bootstrap] FAILED:", err);
    prisma.$disconnect();
    process.exit(1);
  });
