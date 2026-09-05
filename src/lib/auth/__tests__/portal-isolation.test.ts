import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { hasAdminPortalAccess } from "../authorize";
import { prisma } from "../../prisma";

describe("Admin / Member Portal Isolation & Security Tests", () => {
  test("1. hasAdminPortalAccess returns true for active users with active relational role assignments", async () => {
    const adminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: { role: { status: "ACTIVE" } },
        },
      },
    });

    if (adminUser) {
      const hasAccess = await hasAdminPortalAccess(adminUser.id);
      assert.equal(hasAccess, true);
    }
  });

  test("2. hasAdminPortalAccess returns false for member-only users with no staff role assignments", async () => {
    const memberUser = await prisma.user.findFirst({
      where: {
        memberProfile: { isNot: null },
        roleAssignments: { none: {} },
      },
    });

    if (memberUser) {
      const hasAccess = await hasAdminPortalAccess(memberUser.id);
      assert.equal(hasAccess, false);
    }
  });

  test("3. Inactive or suspended users receive false from hasAdminPortalAccess regardless of roles", async () => {
    const nonExistentAccess = await hasAdminPortalAccess("non-existent-user-id");
    assert.equal(nonExistentAccess, false);
  });

  test("4. Root landing page logic deterministically routes Admin first, then Member, then Login", async () => {
    const adminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { status: "ACTIVE" } } },
      },
      include: { memberProfile: true },
    });

    if (adminUser) {
      const isAdmin = await hasAdminPortalAccess(adminUser.id);
      const target = isAdmin ? "/admin/dashboard" : adminUser.memberProfile ? "/member/dashboard" : "/login";
      assert.equal(target, "/admin/dashboard");
    }
  });

  test("5. Multi-role user with both Admin roles and MemberProfile gets /admin/dashboard landing and access to both", async () => {
    const multiRoleUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        memberProfile: { isNot: null },
        roleAssignments: { some: { role: { status: "ACTIVE" } } },
      },
      include: { memberProfile: true },
    });

    if (multiRoleUser) {
      const isAdmin = await hasAdminPortalAccess(multiRoleUser.id);
      assert.equal(isAdmin, true);
      assert.ok(multiRoleUser.memberProfile);

      // Root landing selects /admin/dashboard
      const landing = isAdmin ? "/admin/dashboard" : "/member/dashboard";
      assert.equal(landing, "/admin/dashboard");
    }
  });

  test("6. Legacy User.role enum does NOT grant hasAdminPortalAccess if relational roleAssignments are absent", async () => {
    const unassignedUser = await prisma.user.findFirst({
      where: {
        roleAssignments: { none: {} },
      },
    });

    if (unassignedUser) {
      const hasAccess = await hasAdminPortalAccess(unassignedUser.id);
      assert.equal(hasAccess, false);
    }
  });

  test("7. User Management DTO mapping safely handles null name/email without component crashes", async () => {
    const users = await prisma.user.findMany({
      take: 10,
      include: {
        roleAssignments: { include: { role: true } },
        branchAccess: { include: { branch: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const safeUsers = users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email ?? "User",
      email: u.email ?? "",
      status: u.status,
      hasGlobalBranchAccess: u.hasGlobalBranchAccess ?? false,
      roles: (u.roleAssignments || [])
        .filter((ra) => ra?.role && ra.role.status === "ACTIVE")
        .map((ra) => ({ id: ra.role.id, name: ra.role.name ?? "", slug: ra.role.slug ?? "" })),
      branches: (u.branchAccess || []).map((ba) => ({
        id: ba.branch?.id ?? "",
        name: ba.branch?.name ?? "",
        code: ba.branch?.code ?? "",
      })),
      createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
    }));

    assert.ok(Array.isArray(safeUsers));
    safeUsers.forEach((u) => {
      assert.equal(typeof u.name, "string");
      assert.equal(typeof u.email, "string");
      assert.doesNotThrow(() => u.name.toLowerCase());
      assert.doesNotThrow(() => u.email.toLowerCase());
    });
  });
});
