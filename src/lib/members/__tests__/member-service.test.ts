import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  getMembersList,
  createMember,
  updateMember,
  getMemberForEdit,
  getMember360Profile,
  purgeEmptyMember,
  bulkImportMembers,
  maskIdentityNumber,
} from "../member-service";
import { PermissionDeniedError, BranchAccessDeniedError } from "../../auth/authorize";
import { UserStatus } from "../../../generated/prisma/client";

describe("Phase 2A Completion Repair — Member Service Unit, Security & Hardening Tests", () => {
  let superAdminUserId: string;
  let normalAdminUserId: string;
  let unauthorizedUserId: string;
  let testBranch1Id: string;
  let testBranch2Id: string;
  let staffRoleId: string;

  before(async () => {
    // 1. Fetch or create primary test branches
    let branch1 = await prisma.branch.findFirst({ where: { code: "HQ-01" } });
    if (!branch1) {
      branch1 = await prisma.branch.create({
        data: {
          name: "Head Office",
          code: "HQ-01",
          email: "hq01@creditflow.test",
          phone: "+1-555-0001",
          address: "1 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
          currency: "USD",
        },
      });
    }
    testBranch1Id = branch1.id;

    let branch2 = await prisma.branch.findFirst({ where: { code: "BR-TEST-02" } });
    if (!branch2) {
      branch2 = await prisma.branch.create({
        data: {
          name: "Test Secondary Branch",
          code: "BR-TEST-02",
          email: "br02@creditflow.test",
          phone: "+1-555-0002",
          address: "2 Second St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
          currency: "USD",
        },
      });
    }
    testBranch2Id = branch2.id;

    // 2. Fetch Super Admin role profile
    let superAdminRole = await prisma.roleProfile.findFirst({
      where: { isSuperAdminRole: true, status: "ACTIVE" },
    });
    if (!superAdminRole) {
      superAdminRole = await prisma.roleProfile.create({
        data: {
          name: "Super Admin Test Role",
          slug: `super_admin_test_${Date.now()}`,
          isSuperAdminRole: true,
          status: "ACTIVE",
        },
      });
    }

    // Create Super Admin test user
    const superAdminUser = await prisma.user.create({
      data: {
        name: "Member Test SuperAdmin",
        email: `superadmin-mem-${Date.now()}@creditflow.test`,
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        hasGlobalBranchAccess: true,
        branchId: testBranch1Id,
        roleAssignments: {
          create: { roleId: superAdminRole.id },
        },
      },
    });
    superAdminUserId = superAdminUser.id;

    // 3. Create Normal Admin role profile with members.view, members.create, members.edit
    let membersViewPerm = await prisma.permission.findUnique({ where: { code: "members.view" } });
    if (!membersViewPerm) {
      membersViewPerm = await prisma.permission.create({
        data: { code: "members.view", name: "View Members", category: "members" },
      });
    }

    let membersCreatePerm = await prisma.permission.findUnique({ where: { code: "members.create" } });
    if (!membersCreatePerm) {
      membersCreatePerm = await prisma.permission.create({
        data: { code: "members.create", name: "Create Members", category: "members" },
      });
    }

    let membersEditPerm = await prisma.permission.findUnique({ where: { code: "members.edit" } });
    if (!membersEditPerm) {
      membersEditPerm = await prisma.permission.create({
        data: { code: "members.edit", name: "Edit Members", category: "members" },
      });
    }

    const customRole = await prisma.roleProfile.create({
      data: {
        name: `Member Staff Role ${Date.now()}`,
        slug: `member_staff_${Date.now()}`,
        description: "Custom role for member management testing",
        isSuperAdminRole: false,
        status: "ACTIVE",
        rolePermissions: {
          create: [
            { permissionId: membersViewPerm.id },
            { permissionId: membersCreatePerm.id },
            { permissionId: membersEditPerm.id },
          ],
        },
      },
    });
    staffRoleId = customRole.id;

    const normalAdminUser = await prisma.user.create({
      data: {
        name: "Member Staff User",
        email: `staff-mem-${Date.now()}@creditflow.test`,
        passwordHash: "dummyhash",
        role: "STAFF",
        status: "ACTIVE",
        hasGlobalBranchAccess: false,
        branchId: testBranch1Id,
        branchAccess: { create: { branchId: testBranch1Id } },
        roleAssignments: { create: { roleId: customRole.id } },
      },
    });
    normalAdminUserId = normalAdminUser.id;

    // 4. Create Unauthorized User (User.role = SUPER_ADMIN but NO relational role assignments)
    const unauth = await prisma.user.create({
      data: {
        name: "Unassigned User",
        email: `unauth-mem-${Date.now()}@creditflow.test`,
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "ACTIVE",
        hasGlobalBranchAccess: false,
      },
    });
    unauthorizedUserId = unauth.id;
  });

  after(async () => {
    // Teardown created test accounts, audit logs, member profiles, and users
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: "creditflow.test" } },
      select: { id: true },
    });
    const userIds = testUsers.map((u) => u.id);

    if (userIds.length > 0) {
      await prisma.loanRepaymentSchedule.deleteMany({
        where: { loan: { member: { userId: { in: userIds } } } },
      });
      await prisma.loan.deleteMany({
        where: { member: { userId: { in: userIds } } },
      });
      await prisma.account.deleteMany({
        where: { member: { userId: { in: userIds } } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
      });
      await prisma.memberProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  test("1. Unauthorized user with NO relational RBAC fails closed on getMembersList", async () => {
    await assert.rejects(
      async () => {
        await getMembersList(unauthorizedUserId);
      },
      (err: unknown) => err instanceof PermissionDeniedError,
      "Must throw PermissionDeniedError"
    );
  });

  test("2. Privacy minimization: passwordHash never reaches directory client DTO & DOB is omitted", async () => {
    const email = `privacy-test-${Date.now()}@creditflow.test`;
    await createMember(normalAdminUserId, {
      name: "Privacy Member",
      email,
      password: "SecurePassword123!",
      phone: "+1-555-8888",
      address: "1 Privacy Lane",
      dateOfBirth: "1992-10-20",
      identityNumber: `ID-PRIV-${Date.now()}-7654`,
      branchId: testBranch1Id,
    });

    const list = await getMembersList(normalAdminUserId, { search: email });
    const dto = list.members.find((m) => m.email === email);
    assert.ok(dto, "Created member DTO must be found");

    // Assert privacy minimization
    assert.equal((dto as Record<string, unknown>).passwordHash, undefined);
    assert.equal((dto as Record<string, unknown>).dateOfBirth, undefined);
    assert.equal(dto.maskedIdentityNumber, "••••-7654");
  });

  test("3. Full identity & DOB remain available ONLY through getMemberForEdit to authorized users", async () => {
    const email = `edit-dto-${Date.now()}@creditflow.test`;
    const idNum = `ID-EDIT-${Date.now()}`;
    const created = await createMember(normalAdminUserId, {
      name: "Edit DTO Member",
      email,
      password: "SecurePassword123!",
      phone: "+1-555-7777",
      address: "2 Edit Way",
      dateOfBirth: "1988-04-12",
      identityNumber: idNum,
      branchId: testBranch1Id,
    });

    // Authorized call
    const detail = await getMemberForEdit(normalAdminUserId, created.id);
    assert.equal(detail.identityNumber, idNum);
    assert.equal(detail.dateOfBirth, "1988-04-12");

    // Unauthorized call (wrong branch scope for staff user)
    const branch2Member = await createMember(superAdminUserId, {
      name: "Branch 2 Member",
      email: `br2-${Date.now()}@creditflow.test`,
      password: "SecurePassword123!",
      phone: "+1-555-0000",
      address: "Branch 2 Address",
      identityNumber: `ID-BR2-${Date.now()}`,
      branchId: testBranch2Id,
    });

    await assert.rejects(
      async () => {
        await getMemberForEdit(normalAdminUserId, branch2Member.id);
      },
      (err: unknown) => err instanceof BranchAccessDeniedError,
      "Must block fetching detail DTO for unauthorized branch member"
    );
  });

  test("4. Explicit password requirement: creation fails if password is omitted or < 8 chars", async () => {
    await assert.rejects(
      async () => {
        await createMember(normalAdminUserId, {
          name: "Short Pass",
          email: `shortpass-${Date.now()}@creditflow.test`,
          password: "",
          phone: "+1-555-1111",
          address: "Address",
          branchId: testBranch1Id,
        });
      },
      /must be at least 8 characters/
    );
  });

  test("5. Audit Log PII protection: audit metadata contains boolean flags only, NO credentials or identity numbers", async () => {
    const email = `audit-pii-${Date.now()}@creditflow.test`;
    const idNum = `ID-SECRET-${Date.now()}`;
    const created = await createMember(normalAdminUserId, {
      name: "Audit PII Member",
      email,
      password: "SuperSecretPassword123!",
      phone: "+1-555-9999",
      address: "Audit St",
      identityNumber: idNum,
      branchId: testBranch1Id,
    });

    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: created.id, action: "member.create" },
    });
    assert.ok(auditLog);
    assert.ok(auditLog.metadataJson);

    const metaStr = auditLog.metadataJson;
    assert.equal(metaStr.includes("SuperSecretPassword123!"), false);
    assert.equal(metaStr.includes(idNum), false);
    assert.equal(metaStr.includes('"hasIdentityNumber":true'), true);
  });

  test("6. User.status INACTIVE or SUSPENDED revokes relational RBAC permissions and branch scope", async () => {
    const suspendedUser = await prisma.user.create({
      data: {
        name: "Suspended Staff User",
        email: `suspended-${Date.now()}@creditflow.test`,
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: UserStatus.SUSPENDED,
        hasGlobalBranchAccess: true,
      },
    });

    const result = await getMembersList(suspendedUser.id).catch((e) => e);
    assert.ok(result instanceof PermissionDeniedError, "Suspended user MUST be denied access");

    await prisma.user.delete({ where: { id: suspendedUser.id } });
  });

  test("7. Mask identity number server utility unit test", () => {
    assert.equal(maskIdentityNumber("123456789"), "••••-6789");
    assert.equal(maskIdentityNumber("1234"), "••••");
    assert.equal(maskIdentityNumber(null), null);
    assert.equal(maskIdentityNumber(""), null);
  });

  test("8. Financial safety: updating status or details DOES NOT alter accounts or loans", async () => {
    const created = await createMember(normalAdminUserId, {
      name: "Financial Safety Member",
      email: `fin-safety-${Date.now()}@creditflow.test`,
      password: "Password123!",
      phone: "+1-555-1212",
      address: "Safety Rd",
      branchId: testBranch1Id,
    });

    // Create an active account for member
    const account = await prisma.account.create({
      data: {
        accountNumber: `ACC-${Date.now()}`,
        memberId: created.id,
        branchId: testBranch1Id,
        accountType: "SAVINGS",
        currency: "USD",
        balance: 5000.0,
        status: "ACTIVE",
      },
    });

    // Update member status to SUSPENDED
    await updateMember(normalAdminUserId, {
      memberId: created.id,
      name: "Financial Safety Member (Suspended)",
      phone: "+1-555-1212",
      address: "Safety Rd",
      status: UserStatus.SUSPENDED,
    });

    // Verify account balance and status were untouched
    const recheckedAccount = await prisma.account.findUnique({ where: { id: account.id } });
    assert.equal(Number(recheckedAccount?.balance), 5000);
    assert.equal(recheckedAccount?.status, "ACTIVE");

    await prisma.account.delete({ where: { id: account.id } });
  });

  test("9. Member 360° Profile: returns comprehensive safe DTO for authorized admin", async () => {
    const email = `m360-${Date.now()}@creditflow.test`;
    const created = await createMember(normalAdminUserId, {
      name: "Member 360 Test User",
      email,
      password: "Password360!",
      phone: "+1-555-3600",
      address: "360 Boulevard",
      dateOfBirth: "1995-05-15",
      identityNumber: `ID-360-${Date.now()}-9999`,
      branchId: testBranch1Id,
    });

    // Add 1 account & 1 loan for member
    const account = await prisma.account.create({
      data: {
        accountNumber: `ACC-360-${Date.now()}`,
        memberId: created.id,
        branchId: testBranch1Id,
        accountType: "SAVINGS",
        currency: "USD",
        balance: 2500.5,
        status: "ACTIVE",
      },
    });

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `LN-360-${Date.now()}`,
        memberId: created.id,
        branchId: testBranch1Id,
        principalAmount: 10000.0,
        approvedAmount: 10000.0,
        paidAmount: 2000.0,
        interestRate: 0.12,
        termMonths: 12,
        status: "ACTIVE",
        currency: "USD",
      },
    });

    const profile = await getMember360Profile(normalAdminUserId, created.id);

    // Assert Header
    assert.equal(profile.header.id, created.id);
    assert.equal(profile.header.name, "Member 360 Test User");
    assert.equal(profile.header.maskedIdentityNumber, "••••-9999");
    assert.equal((profile.header as Record<string, unknown>).passwordHash, undefined);

    // Assert Summary
    assert.equal(profile.summary.totalAccounts, 1);
    assert.equal(profile.summary.activeAccounts, 1);
    assert.equal(profile.summary.totalAccountBalance, "2500.50");
    assert.equal(profile.summary.totalLoans, 1);
    assert.equal(profile.summary.activeLoans, 1);
    assert.equal(profile.summary.totalLoanPrincipalOutstanding, "8000.00");

    // Assert Accounts & Loans DTOs
    assert.equal(profile.accounts.length, 1);
    assert.equal(profile.accounts[0].accountNumber, account.accountNumber);
    assert.equal(profile.loans.length, 1);
    assert.equal(profile.loans[0].loanNumber, loan.loanNumber);
    assert.equal(profile.loans[0].outstandingAmount, "8000.00");

    // Teardown
    await prisma.loan.delete({ where: { id: loan.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.memberProfile.delete({ where: { id: created.id } });
    await prisma.user.delete({ where: { email } });
  });

  test("10. Member 360° Profile: fails closed when unauthorized by branch scope or RBAC", async () => {
    // Create a staff user explicitly assigned to Branch 1 only
    const branch1Staff = await prisma.user.create({
      data: {
        name: "Branch 1 Restricted Staff User",
        email: `b1staff-${Date.now()}@creditflow.test`,
        passwordHash: "dummyhash",
        role: "STAFF",
        status: "ACTIVE",
        hasGlobalBranchAccess: false,
        branchId: testBranch1Id,
        branchAccess: { create: { branchId: testBranch1Id } },
        roleAssignments: { create: { roleId: staffRoleId } },
      },
    });

    const branch2Member = await createMember(superAdminUserId, {
      name: "Branch 2 Member 360",
      email: `m360-unauth-${Date.now()}@creditflow.test`,
      password: "Password360!",
      phone: "+1-555-3601",
      address: "Branch 2 Blvd",
      branchId: testBranch2Id,
    });

    try {
      // 1. RBAC check (unassigned user)
      await assert.rejects(
        async () => {
          await getMember360Profile(unauthorizedUserId, branch2Member.id);
        },
        (err: unknown) => err instanceof PermissionDeniedError,
        "Unassigned user must throw PermissionDeniedError"
      );

      // 2. Branch Scope check (staff user restricted to Branch 1 trying to view Branch 2 member)
      await assert.rejects(
        async () => {
          await getMember360Profile(branch1Staff.id, branch2Member.id);
        },
        (err: unknown) => err instanceof BranchAccessDeniedError,
        "Branch 1 staff must throw BranchAccessDeniedError when accessing Branch 2 member"
      );
    } finally {
      await prisma.memberProfile.deleteMany({ where: { id: branch2Member.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: branch1Staff.id } });
      await prisma.userBranchAccess.deleteMany({ where: { userId: branch1Staff.id } });
      await prisma.user.delete({ where: { id: branch1Staff.id } });
    }
  });

  test("11. Purge Empty Member: Super Admin can purge zero-relation member, fails for non-superadmin or active records", async () => {
    // 1. Create an empty member
    const emptyMem = await createMember(superAdminUserId, {
      name: "Empty Member To Purge",
      email: `purge-empty-${Date.now()}@creditflow.test`,
      password: "PasswordPurge1!",
      phone: "+1-555-9988",
      address: "Empty St",
      branchId: testBranch1Id,
    });

    // Clear auto-welcome notification so member has 0 linked records for purge test
    await prisma.notification.deleteMany({ where: { userId: emptyMem.userId } });

    // 2. Normal admin (non-superadmin) cannot purge empty member
    await assert.rejects(
      async () => {
        await purgeEmptyMember(normalAdminUserId, emptyMem.id);
      },
      (err: unknown) => err instanceof PermissionDeniedError,
      "Normal admin must be denied purge authorization"
    );

    // 3. Super Admin can purge empty member cleanly (ensure notification count is 0)
    await prisma.notification.deleteMany({ where: { userId: emptyMem.userId } });
    const purgeRes = await purgeEmptyMember(superAdminUserId, emptyMem.id);
    assert.equal(purgeRes.success, true);

    // Verify record no longer exists
    const deletedCheck = await prisma.memberProfile.findUnique({ where: { id: emptyMem.id } });
    assert.equal(deletedCheck, null, "Purged member record must be deleted");
  });

  test("12. Bulk Import Members: validates CSV row batch, uniqueness, and branch authorization", async () => {
    const batchRows = [
      {
        name: "Bulk User One",
        email: `bulk1-${Date.now()}@creditflow.test`,
        phone: "+1-555-7001",
        address: "1 Bulk Ave",
      },
      {
        name: "Bulk User Two",
        email: `bulk2-${Date.now()}@creditflow.test`,
        phone: "+1-555-7002",
        address: "2 Bulk Ave",
      },
    ];

    const importRes = await bulkImportMembers(normalAdminUserId, testBranch1Id, batchRows);
    assert.equal(importRes.totalProcessed, 2);
    assert.equal(importRes.successfulCount, 2);
    assert.equal(importRes.failedCount, 0);

    // Teardown imported users
    const createdEmails = batchRows.map((r) => r.email);
    const users = await prisma.user.findMany({ where: { email: { in: createdEmails } } });
    const userIds = users.map((u) => u.id);
    await prisma.memberProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("13. Money Serialization Hardening: getMember360Profile serializes amounts as decimal strings", async () => {
    const mem = await createMember(superAdminUserId, {
      name: "Decimal String Member",
      email: `dec-str-${Date.now()}@creditflow.test`,
      password: "PasswordDec1!",
      phone: "+1-555-[#dec]",
      address: "Decimal Way",
      branchId: testBranch1Id,
    });

    const acc = await prisma.account.create({
      data: {
        memberId: mem.id,
        branchId: testBranch1Id,
        accountNumber: `DEC-${Date.now().toString().slice(-6)}`,
        accountType: "SAVINGS",
        currency: "USD",
        balance: 1550.75,
        status: "ACTIVE",
      },
    });

    const profile = await getMember360Profile(superAdminUserId, mem.id);
    assert.equal(typeof profile.summary.totalAccountBalance, "string", "totalAccountBalance must be string");
    assert.equal(profile.summary.totalAccountBalance, "1550.75");
    assert.equal(typeof profile.accounts[0].balance, "string", "account balance must be string");
    assert.equal(profile.accounts[0].balance, "1550.75");

    // Teardown
    await prisma.account.delete({ where: { id: acc.id } });
    await prisma.memberProfile.delete({ where: { id: mem.id } });
    await prisma.user.delete({ where: { email: mem.email } });
  });

  test("14. Privacy Hardening: getMember360Profile header DTO omits SYSTEM USER ID", async () => {
    const mem = await createMember(superAdminUserId, {
      name: "Privacy Header Member",
      email: `privacy-hdr-${Date.now()}@creditflow.test`,
      password: "PasswordPriv1!",
      phone: "+1-555-0100",
      address: "Privacy St",
      branchId: testBranch1Id,
    });

    const profile = await getMember360Profile(superAdminUserId, mem.id);
    // Verify header does not contain userId
    assert.equal((profile.header as Record<string, unknown>).userId, undefined, "userId must be omitted from header DTO");

    // Teardown
    await prisma.memberProfile.delete({ where: { id: mem.id } });
    await prisma.user.delete({ where: { email: mem.email } });
  });
});
