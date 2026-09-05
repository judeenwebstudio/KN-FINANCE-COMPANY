import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, updateUser } from "../users-service";
import { getUserPrimaryRoleName } from "../authorize";
import { prisma } from "../../prisma";
import { bootstrapRBAC } from "../bootstrap";

describe("Admin User Profile & Identity Management Tests", () => {
  test("Full Name update persists User.name and records safe audit log", async () => {
    await bootstrapRBAC();

    const superAdmin = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { isSuperAdminRole: true } } },
      },
    });

    assert.ok(superAdmin, "Super Admin user required for test");

    const testEmail = `profile-test-${Date.now()}@example.com`;
    const testUser = await createUser({
      name: "Original Profile Name",
      email: testEmail,
      password: "TestPassword123!",
      actorUserId: superAdmin.id,
    });

    try {
      // 1. Update Full Name
      const updated = await updateUser({
        userId: testUser.id,
        name: "  Updated Profile Name  ",
        actorUserId: superAdmin.id,
      });

      assert.equal(updated.name, "Updated Profile Name", "User.name should be trimmed and updated in database");

      // Verify persistence from database
      const reFetched = await prisma.user.findUnique({ where: { id: testUser.id } });
      assert.equal(reFetched?.name, "Updated Profile Name");

      // Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityId: testUser.id, action: "USER_UPDATED" },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(auditLog, "Audit log for USER_UPDATED should be created");
      const metadata = JSON.parse(auditLog?.metadataJson || "{}");
      assert.equal(metadata.nameUpdated, true, "Metadata should reflect nameUpdated: true");
    } finally {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  test("Email update enforces normalization and rejects duplicate email", async () => {
    await bootstrapRBAC();

    const superAdmin = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { isSuperAdminRole: true } } },
      },
    });

    assert.ok(superAdmin, "Super Admin user required for test");

    const timestamp = Date.now();
    const userA = await createUser({
      name: "User A",
      email: `usera-${timestamp}@example.com`,
      password: "TestPassword123!",
      actorUserId: superAdmin.id,
    });

    const userB = await createUser({
      name: "User B",
      email: `userb-${timestamp}@example.com`,
      password: "TestPassword123!",
      actorUserId: superAdmin.id,
    });

    try {
      // 1. Attempt to update User B's email to User A's email (should fail with duplicate rejection)
      await assert.rejects(
        async () => {
          await updateUser({
            userId: userB.id,
            email: `UserA-${timestamp}@example.com`, // Case variation of existing user A email
            actorUserId: superAdmin.id,
          });
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("already in use"),
            `Expected duplicate email error, got: ${err.message}`
          );
          return true;
        }
      );

      // 2. Successful email update to new unique email
      const updatedUserB = await updateUser({
        userId: userB.id,
        email: `  UserB-New-${timestamp}@Example.com  `,
        actorUserId: superAdmin.id,
      });

      assert.equal(
        updatedUserB.email,
        `userb-new-${timestamp}@example.com`,
        "Email should be safely normalized to lowercase trimmed string"
      );
    } finally {
      await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    }
  });

  test("Empty Full Name is rejected server-side", async () => {
    await bootstrapRBAC();

    const superAdmin = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { isSuperAdminRole: true } } },
      },
    });

    assert.ok(superAdmin, "Super Admin user required");

    const testUser = await createUser({
      name: "Valid User",
      email: `empty-name-${Date.now()}@example.com`,
      password: "TestPassword123!",
      actorUserId: superAdmin.id,
    });

    try {
      await assert.rejects(
        async () => {
          await updateUser({
            userId: testUser.id,
            name: "   ",
            actorUserId: superAdmin.id,
          });
        },
        (err: Error) => {
          assert.ok(err.message.includes("Full Name cannot be empty"), `Got error: ${err.message}`);
          return true;
        }
      );
    } finally {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  test("getUserPrimaryRoleName provides consistent relational role resolution across header and user DTOs", async () => {
    await bootstrapRBAC();

    const superAdminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { isSuperAdminRole: true } } },
      },
      include: {
        roleAssignments: { include: { role: true } },
      },
    });

    assert.ok(superAdminUser, "Super Admin user required");

    const resolvedRoleName = await getUserPrimaryRoleName(superAdminUser.id);
    const assignedRelationalRoleNames = superAdminUser.roleAssignments.map((ra) => ra.role.name);

    assert.ok(
      assignedRelationalRoleNames.includes(resolvedRoleName),
      `Resolved primary role '${resolvedRoleName}' must match one of the assigned relational roles: ${assignedRelationalRoleNames.join(", ")}`
    );
  });
});
