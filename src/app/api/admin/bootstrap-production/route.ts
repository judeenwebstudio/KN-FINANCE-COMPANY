import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { bootstrapRBAC } from "@/lib/auth/bootstrap";
import { Role } from "@/generated/prisma/client";

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL || "";
    const email = process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.INITIAL_SUPERADMIN_PASSWORD;
    const branchName = process.env.INITIAL_BRANCH_NAME?.trim() || "Head Office";
    const branchCode = process.env.INITIAL_BRANCH_CODE?.trim() || "HQ-01";

    // 1. Target Verification
    if (!rawUrl || (!rawUrl.startsWith("postgres://") && !rawUrl.startsWith("postgresql://"))) {
      return NextResponse.json({ error: "Target DATABASE_URL is missing or not a valid PostgreSQL URL." }, { status: 500 });
    }

    const hostMatch = rawUrl.match(/@([^:\/]+)/);
    const host = hostMatch ? hostMatch[1] : "NONE";

    if (host === "localhost" || host === "127.0.0.1" || host === "NONE") {
      return NextResponse.json({ error: `Refusing execution: Target DATABASE_URL host (${host}) is localhost or unresolvable.` }, { status: 500 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "INITIAL_SUPERADMIN_EMAIL is missing or invalid." }, { status: 500 });
    }

    if (!password || password.length < 12) {
      return NextResponse.json({ error: "INITIAL_SUPERADMIN_PASSWORD is missing or shorter than 12 characters." }, { status: 500 });
    }

    const sanitizedHost = host.includes("neon.tech") ? `Neon Hosted PostgreSQL (${host})` : `Hosted PostgreSQL (${host.split(".").slice(-2).join(".")})`;

    // 2. Production Database Bootstrap Execution
    // Create / update Primary Production Branch
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

    // Hash Password
    const passwordHash = await hash(password, 12);

    // Create / update Initial Super Admin
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

    // Account Type Policies
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

    // Transaction Categories
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

    // RBAC Bootstrap (Seeds 50 permissions & 8 roles, maps relational role to superAdmin)
    await bootstrapRBAC();

    // 3. Post-Bootstrap Read-Only Verification
    const branchCheck = await prisma.branch.findUnique({ where: { code: branchCode } });
    const permissionCount = await prisma.permission.count();
    const roleCount = await prisma.roleProfile.count({ where: { isSystem: true } });
    const superAdminUser = await prisma.user.findUnique({
      where: { email },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });
    const policyCount = await prisma.accountTypePolicy.count();
    const categoryCount = await prisma.transactionCategory.count();

    // Demo Data Checks
    const demoUserCount = await prisma.user.count({ where: { email: { endsWith: "@creditflow.demo" } } });
    const demoMemberCount = await prisma.memberProfile.count();
    const demoAccountCount = await prisma.account.count();
    const demoLoanCount = await prisma.loan.count();
    const demoRepaymentCount = await prisma.loanRepayment.count();
    const demoTransactionCount = await prisma.transaction.count();
    const demoProductCount = await prisma.loanProduct.count();
    const demoPenaltyRuleCount = await prisma.loanPenaltyRule.count();

    const hasSuperAdminRoleProfile = superAdminUser?.roleAssignments.some(ra => ra.role.slug === "super_admin" && ra.role.status === "ACTIVE") ?? false;

    return NextResponse.json({
      status: "SUCCESS",
      targetVerification: {
        databaseUrlPresent: true,
        databaseProvider: "PostgreSQL",
        isLocalhost: false,
        sanitizedTarget: sanitizedHost,
      },
      bootstrapSummary: {
        branch: {
          code: branchCheck?.code,
          name: branchCheck?.name,
          verified: branchCheck?.code === "HQ-01" && branchCheck?.name === "Head Office",
        },
        permissionCount,
        roleCount,
        policyCount,
        categoryCount,
        superAdminVerification: {
          exists: Boolean(superAdminUser),
          email: superAdminUser?.email,
          roleEnum: superAdminUser?.role,
          hasGlobalBranchAccess: superAdminUser?.hasGlobalBranchAccess,
          hasRelationalSuperAdminRole: hasSuperAdminRoleProfile,
        },
      },
      demoDataAbsenceVerification: {
        demoUsers: demoUserCount,
        demoMembers: demoMemberCount,
        demoAccounts: demoAccountCount,
        demoLoans: demoLoanCount,
        demoRepayments: demoRepaymentCount,
        demoTransactions: demoTransactionCount,
        sampleProducts: demoProductCount,
        samplePenaltyRules: demoPenaltyRuleCount,
        isCleanProduction: demoUserCount === 0 && demoMemberCount === 0 && demoAccountCount === 0 && demoLoanCount === 0,
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "ERROR", error: errMessage }, { status: 500 });
  }
}
