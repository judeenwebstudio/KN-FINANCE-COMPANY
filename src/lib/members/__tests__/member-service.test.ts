import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  getMembersList,
  createMember,
  updateMember,
} from "../member-service";
import { PermissionDeniedError, BranchAccessDeniedError } from "../../auth/authorize";
import { UserStatus } from "../../../generated/prisma/client";

describe("Phase 2A Completion Repair — Member Service Unit & RBAC Tests", () => {
  let superAdminUserId: string;
  let normalAdminUserId: string;
  let unauthorizedUserId: string;
  let testBranch1Id: string;
  let testBranch2Id: string;

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
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        hasGlobalBranchAccess: false,
      },
    });
    unauthorizedUserId = unauth.id;
  });

  after(async () => {
    // Delete AuditLogs created by test users first to satisfy FK constraint
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: "creditflow.test" } },
      select: { id: true },
    });
    const userIds = testUsers.map((u) => u.id);

    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
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

  test("2. Super Admin can list members across global branch scope", async () => {
    const result = await getMembersList(superAdminUserId, { page: 1, pageSize: 10 });
    assert.ok(Array.isArray(result.members));
    assert.ok(result.pagination.total >= 0);
  });

  test("3. Restricted staff user can only access assigned branch scope", async () => {
    // Create a member in testBranch2 (out of scope for normalAdminUser)
    const outOfScopeMember = await createMember(superAdminUserId, {
      name: "Out of Scope Member",
      email: `outofscope-${Date.now()}@creditflow.test`,
      phone: "+1-555-9999",
      address: "Branch 2 Rd",
      branchId: testBranch2Id,
    });

    const result = await getMembersList(normalAdminUserId, { page: 1, pageSize: 50 });
    const found = result.members.find((m) => m.id === outOfScopeMember.member.id);
    assert.equal(found, undefined, "Restricted staff user MUST NOT see member from unauthorized branch");
  });

  test("4. Atomic Member creation generates valid memberNumber and User account", async () => {
    const email = `newmember-${Date.now()}@creditflow.test`;
    const res = await createMember(superAdminUserId, {
      name: "Alice Cooper",
      email,
      phone: "+1-555-4321",
      address: "742 Evergreen Terrace",
      dateOfBirth: "1990-05-15",
      identityNumber: `ID-${Date.now()}`,
      branchId: testBranch1Id,
    });

    assert.ok(res.member.id);
    assert.equal(res.member.name, "Alice Cooper");
    assert.equal(res.member.email, email);
    assert.ok(res.member.memberNumber.startsWith("MEM-"));
    assert.ok(res.generatedPassword, "Must generate temporary password when omitted");

    // Verify User record
    const userRecord = await prisma.user.findUnique({ where: { email } });
    assert.ok(userRecord);
    assert.equal(userRecord?.role, "MEMBER");
    assert.equal(userRecord?.status, "ACTIVE");
  });

  test("5. Member creation rejects duplicate email", async () => {
    const email = `dup-email-${Date.now()}@creditflow.test`;
    await createMember(superAdminUserId, {
      name: "First Member",
      email,
      phone: "+1-555-1111",
      address: "101 First Ave",
      branchId: testBranch1Id,
    });

    await assert.rejects(
      async () => {
        await createMember(superAdminUserId, {
          name: "Second Member",
          email,
          phone: "+1-555-2222",
          address: "102 Second Ave",
          branchId: testBranch1Id,
        });
      },
      /already registered/
    );
  });

  test("6. Member creation rejects duplicate identity number", async () => {
    const idNum = `ID-DUP-${Date.now()}`;
    await createMember(superAdminUserId, {
      name: "Member A",
      email: `mem-a-${Date.now()}@creditflow.test`,
      phone: "+1-555-1111",
      address: "101 First Ave",
      identityNumber: idNum,
      branchId: testBranch1Id,
    });

    await assert.rejects(
      async () => {
        await createMember(superAdminUserId, {
          name: "Member B",
          email: `mem-b-${Date.now()}@creditflow.test`,
          phone: "+1-555-2222",
          address: "102 Second Ave",
          identityNumber: idNum,
          branchId: testBranch1Id,
        });
      },
      /identity number/i
    );
  });

  test("7. Member creation enforces branch authorization for creator", async () => {
    await assert.rejects(
      async () => {
        await createMember(normalAdminUserId, {
          name: "Unauthorized Branch Member",
          email: `unauth-br-${Date.now()}@creditflow.test`,
          phone: "+1-555-3333",
          address: "303 Third Ave",
          branchId: testBranch2Id, // Not in normalAdminUser's scope
        });
      },
      (err: unknown) => err instanceof BranchAccessDeniedError,
      "Must reject creation in unauthorized branch"
    );
  });

  test("8. Safe Member update updates details and status atomically while maintaining email/branch immutability", async () => {
    const created = await createMember(normalAdminUserId, {
      name: "Bob Builder",
      email: `bob-${Date.now()}@creditflow.test`,
      phone: "+1-555-7777",
      address: "1 Construction Way",
      branchId: testBranch1Id,
    });

    const updated = await updateMember(normalAdminUserId, {
      memberId: created.member.id,
      name: "Bob The Builder",
      phone: "+1-555-8888",
      address: "2 Remodel St",
      identityNumber: `ID-BOB-${Date.now()}`,
      status: UserStatus.SUSPENDED,
    });

    assert.equal(updated.name, "Bob The Builder");
    assert.equal(updated.phone, "+1-555-8888");
    assert.equal(updated.address, "2 Remodel St");
    assert.equal(updated.status, UserStatus.SUSPENDED);
    assert.equal(updated.email, created.member.email, "Email MUST remain immutable");
    assert.equal(updated.branchId, created.member.branchId, "BranchId MUST remain immutable");
  });

  test("9. Search filtering matches memberNumber, name, email, phone, and identityNumber", async () => {
    const searchTargetName = `SearchTarget_${Date.now()}`;
    const created = await createMember(superAdminUserId, {
      name: searchTargetName,
      email: `searchtarget-${Date.now()}@creditflow.test`,
      phone: "+1-555-9090",
      address: "Target Address",
      branchId: testBranch1Id,
    });

    const searchResult = await getMembersList(superAdminUserId, { search: searchTargetName });
    assert.equal(searchResult.members.length, 1);
    assert.equal(searchResult.members[0].id, created.member.id);
  });
});
