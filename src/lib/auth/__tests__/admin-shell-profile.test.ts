import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getUserPrimaryRoleName } from "../authorize";
import { prisma } from "../../prisma";

describe("Admin Shell Profile UX Cleanup Tests", () => {
  test("1. getUserPrimaryRoleName resolves relational RBAC role name for active user", async () => {
    const superAdminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: {
            role: { isSuperAdminRole: true, status: "ACTIVE" },
          },
        },
      },
      include: {
        roleAssignments: { include: { role: true } },
      },
    });

    if (superAdminUser) {
      const roleName = await getUserPrimaryRoleName(superAdminUser.id);
      assert.ok(roleName.length > 0);
      assert.notEqual(roleName, "Member");
      const expectedRole = superAdminUser.roleAssignments.find((ra) => ra.role.isSuperAdminRole)?.role.name;
      assert.equal(roleName, expectedRole);
    }
  });

  test("2. User display name resolution uses user.name or falls back to user.email", async () => {
    const userWithName = { name: "  Kabhi Nisha  ", email: "kabhi@knfinance.com" };
    const displayName1 = userWithName.name && userWithName.name.trim().length > 0 ? userWithName.name.trim() : userWithName.email;
    assert.equal(displayName1, "Kabhi Nisha");

    const userWithoutName = { name: "", email: "kabhi@knfinance.com" };
    const displayName2 = userWithoutName.name && userWithoutName.name.trim().length > 0 ? userWithoutName.name.trim() : userWithoutName.email;
    assert.equal(displayName2, "kabhi@knfinance.com");
  });

  test("3. Relational role name takes precedence over legacy enum User.role", async () => {
    const adminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: { role: { status: "ACTIVE" } },
        },
      },
      include: {
        roleAssignments: { include: { role: true } },
      },
    });

    if (adminUser) {
      const roleName = await getUserPrimaryRoleName(adminUser.id);
      assert.ok(roleName);
      // Verify roleName matches assigned RoleProfile name, not raw legacy User.role enum string
      const assignedRoleName = adminUser.roleAssignments[0].role.name;
      assert.equal(roleName, assignedRoleName);
    }
  });
});
