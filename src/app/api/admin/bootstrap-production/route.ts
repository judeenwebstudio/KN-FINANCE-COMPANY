import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { bootstrapRBAC } from "@/lib/auth/bootstrap";
import { Role } from "@/generated/prisma/client";

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL || "";
    const email = process.env.FINAL_SUPERADMIN_EMAIL?.trim().toLowerCase() || process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase() || "kabhinishainfotech@gmail.com";
    const password = process.env.FINAL_SUPERADMIN_PASSWORD || process.env.INITIAL_SUPERADMIN_PASSWORD;
    const branchName = process.env.INITIAL_BRANCH_NAME?.trim() || "Head Office";
    const branchCode = process.env.INITIAL_BRANCH_CODE?.trim() || "HQ-01";

    // 1. Target Database Verification
    if (!rawUrl || (!rawUrl.startsWith("postgres://") && !rawUrl.startsWith("postgresql://"))) {
      return NextResponse.json({ error: "Target DATABASE_URL is missing or not a valid PostgreSQL URL." }, { status: 500 });
    }

    const hostMatch = rawUrl.match(/@([^:\/]+)/);
    const host = hostMatch ? hostMatch[1] : "NONE";

    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "NONE") {
      return NextResponse.json({ error: `Refusing execution: Target DATABASE_URL host (${host}) is localhost or unresolvable.` }, { status: 500 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Target Super Admin email is missing or invalid." }, { status: 500 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "FINAL_SUPERADMIN_PASSWORD / INITIAL_SUPERADMIN_PASSWORD is missing or shorter than 6 characters." }, { status: 500 });
    }

    const sanitizedHost = host.includes("neon.tech") ? `Neon Hosted PostgreSQL (${host})` : `Hosted PostgreSQL (${host.split(".").slice(-2).join(".")})`;

    // 2. Ensure Primary Branch & Base RBAC
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

    // Seed RBAC permissions & roles
    await bootstrapRBAC();

    // 3. Locate Existing Super Admin unambiguously
    const existingSuperAdmins = await prisma.user.findMany({
      where: {
        OR: [
          { role: Role.SUPER_ADMIN },
          { roleAssignments: { some: { role: { slug: "super_admin" } } } },
        ],
      },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    if (existingSuperAdmins.length > 1) {
      return NextResponse.json({
        error: `Ambiguous Super Admin match: Found ${existingSuperAdmins.length} Super Admin users in production database. Stopping without modification.`,
        matchCount: existingSuperAdmins.length,
      }, { status: 500 });
    }

    const passwordHash = await hash(password, 12);
    let targetSuperAdminUser;

    if (existingSuperAdmins.length === 1) {
      // Update existing Super Admin user atomically
      const existing = existingSuperAdmins[0];
      targetSuperAdminUser = await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: email,
          passwordHash: passwordHash,
          role: Role.SUPER_ADMIN,
          hasGlobalBranchAccess: true,
          status: "ACTIVE",
        },
        include: {
          roleAssignments: {
            include: { role: true },
          },
        },
      });
    } else {
      // Create single initial Super Admin user
      targetSuperAdminUser = await prisma.user.create({
        data: {
          name: "Super Administrator",
          email: email,
          passwordHash: passwordHash,
          role: Role.SUPER_ADMIN,
          branchId: primaryBranch.id,
          hasGlobalBranchAccess: true,
          status: "ACTIVE",
        },
        include: {
          roleAssignments: {
            include: { role: true },
          },
        },
      });
    }

    // Ensure relational super_admin role assignment & global branch access
    await bootstrapRBAC();

    // 4. Seed Required Policies & Categories
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
        createdById: targetSuperAdminUser.id,
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
        createdById: targetSuperAdminUser.id,
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
        createdById: targetSuperAdminUser.id,
      },
    });

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
          createdById: targetSuperAdminUser.id,
        },
      });
    }

    // 5. Post-Update Read-Only Verification
    const allSuperAdmins = await prisma.user.findMany({
      where: {
        OR: [
          { role: Role.SUPER_ADMIN },
          { roleAssignments: { some: { role: { slug: "super_admin" } } } },
        ],
      },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    const verifyUser = await prisma.user.findUnique({
      where: { email },
      include: {
        roleAssignments: {
          include: { role: true },
        },
      },
    });

    const isPasswordValid = verifyUser ? await compare(password, verifyUser.passwordHash) : false;
    const hasSuperAdminRoleProfile = verifyUser?.roleAssignments.some(ra => ra.role.slug === "super_admin" && ra.role.status === "ACTIVE") ?? false;

    const branchCheck = await prisma.branch.findUnique({ where: { code: branchCode } });
    const permissionCount = await prisma.permission.count();
    const roleCount = await prisma.roleProfile.count({ where: { isSystem: true } });
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

    return NextResponse.json({
      status: "SUCCESS",
      targetVerification: {
        databaseUrlPresent: true,
        databaseProvider: "PostgreSQL",
        isLocalhost: false,
        sanitizedTarget: sanitizedHost,
      },
      superAdminUpdateResult: {
        matchCount: allSuperAdmins.length,
        noDuplicateCreated: allSuperAdmins.length === 1,
        finalSuperAdminEmail: verifyUser?.email,
        accountStatus: verifyUser?.status,
        legacyRole: verifyUser?.role,
        relationalSuperAdminRoleActive: hasSuperAdminRoleProfile,
        hasGlobalBranchAccess: verifyUser?.hasGlobalBranchAccess,
        passwordVerification: isPasswordValid ? "PASS" : "FAIL",
      },
      systemCounts: {
        primaryBranch: `${branchCheck?.name} (${branchCheck?.code})`,
        permissionCount,
        roleCount,
        policyCount,
        categoryCount,
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
      temporaryEnvStatus: {
        safeToRemoveTemporaryVariables: true,
        note: "FINAL_SUPERADMIN_PASSWORD / FINAL_SUPERADMIN_EMAIL can now be safely removed from Vercel environment settings.",
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "ERROR", error: errMessage }, { status: 500 });
  }
}
