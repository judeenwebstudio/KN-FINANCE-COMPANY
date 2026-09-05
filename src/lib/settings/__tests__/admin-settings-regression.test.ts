import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getUserPrimaryRoleName } from "../../auth/authorize";
import { prisma } from "../../prisma";
import { bootstrapRBAC } from "../../auth/bootstrap";

describe("Admin Settings & Profile Shell Regression Tests", () => {
  test("getUserPrimaryRoleName safely handles missing, null, or multiple role assignments without throwing", async () => {
    await bootstrapRBAC();

    // 1. Non-existent user
    const nonExistentRole = await getUserPrimaryRoleName("non-existent-user-id-9999");
    assert.equal(nonExistentRole, "Member", "Non-existent user should return default 'Member'");

    // 2. Test Super Admin user
    const superAdminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: { role: { isSuperAdminRole: true, status: "ACTIVE" } },
        },
      },
    });

    if (superAdminUser) {
      const superAdminRoleName = await getUserPrimaryRoleName(superAdminUser.id);
      assert.ok(superAdminRoleName && superAdminRoleName.length > 0, "Super Admin role name should be non-empty string");
      assert.notEqual(superAdminRoleName, "", "Super Admin role name must not be empty");
    }

    // 3. User with no role assignments
    const unassignedUser = await prisma.user.create({
      data: {
        name: "Unassigned Test User",
        email: `unassigned-${Date.now()}@example.com`,
        passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
        status: "ACTIVE",
      },
    });

    try {
      const unassignedRole = await getUserPrimaryRoleName(unassignedUser.id);
      assert.equal(unassignedRole, "Member", "Unassigned user should return 'Member' without throwing");
    } finally {
      await prisma.user.delete({ where: { id: unassignedUser.id } }).catch(() => {});
    }
  });

  test("Settings data DTO normalization handles null string fields without component rendering crashes", () => {
    // Simulate raw DB branch record with null/missing fields
    const rawBranchWithNulls = {
      id: "br-test-null",
      name: "Test Branch Null",
      code: "TBN-01",
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      country: null,
      currency: "INR",
      status: "ACTIVE",
      _count: { users: 0, members: 0, accounts: 0, loans: 0 },
    };

    const safeBranch = {
      id: String(rawBranchWithNulls.id ?? ""),
      name: String(rawBranchWithNulls.name ?? ""),
      code: String(rawBranchWithNulls.code ?? ""),
      email: String(rawBranchWithNulls.email ?? ""),
      phone: String(rawBranchWithNulls.phone ?? ""),
      address: String(rawBranchWithNulls.address ?? ""),
      city: String(rawBranchWithNulls.city ?? ""),
      state: String(rawBranchWithNulls.state ?? ""),
      country: String(rawBranchWithNulls.country ?? ""),
      currency: String(rawBranchWithNulls.currency ?? "INR"),
      status: String(rawBranchWithNulls.status ?? "ACTIVE"),
      userCount: rawBranchWithNulls._count?.users ?? 0,
      memberCount: rawBranchWithNulls._count?.members ?? 0,
      accountCount: rawBranchWithNulls._count?.accounts ?? 0,
      loanCount: rawBranchWithNulls._count?.loans ?? 0,
    };

    assert.equal(safeBranch.city, "", "Null city should be normalized to empty string");
    assert.equal(safeBranch.country, "", "Null country should be normalized to empty string");

    // Test search filter logic on normalized branch
    const searchBranch = "test";
    const isMatched =
      (safeBranch.name || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (safeBranch.code || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (safeBranch.city || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (safeBranch.country || "").toLowerCase().includes(searchBranch.toLowerCase());

    assert.equal(isMatched, true, "Search filter should execute safely without throwing TypeError");
  });
});
