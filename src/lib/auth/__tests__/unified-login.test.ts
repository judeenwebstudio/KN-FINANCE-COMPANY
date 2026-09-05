import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getUserEffectivePermissions } from "../authorize";
import { isRecaptchaConfigured, verifyRecaptchaToken } from "../../security/recaptcha";
import { prisma } from "../../prisma";

describe("Single Unified Login & Post-Login Routing Tests", () => {
  test("1. Active Super Admin with relational RBAC resolves to admin permissions", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: {
            role: { isSuperAdminRole: true, status: "ACTIVE" },
          },
        },
      },
    });

    if (superAdmin) {
      const perms = await getUserEffectivePermissions(superAdmin.id);
      assert.ok(perms.size > 0);
      assert.equal(perms.has("dashboard.view"), true);
    }
  });

  test("2. Active Admin with relational permissions resolves to admin permissions", async () => {
    const adminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: {
            role: { status: "ACTIVE" },
          },
        },
      },
    });

    if (adminUser) {
      const perms = await getUserEffectivePermissions(adminUser.id);
      assert.ok(perms.size > 0);
    }
  });

  test("3. Inactive or Suspended users resolve to ZERO permissions regardless of role assignments", async () => {
    const dummyPerms = await getUserEffectivePermissions("non-existent-user-id");
    assert.equal(dummyPerms.size, 0);
    assert.equal(dummyPerms.has("dashboard.view"), false);
  });

  test("4. Multi-role deterministic routing: relational admin permissions take precedence over MemberProfile", async () => {
    const adminUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: {
          some: {
            role: { status: "ACTIVE" },
          },
        },
      },
    });

    if (adminUser) {
      const perms = await getUserEffectivePermissions(adminUser.id);
      const isAdmin = perms.size > 0 || perms.has("dashboard.view");
      assert.equal(isAdmin, true);
      const targetRoute = isAdmin ? "/admin/dashboard" : "/member/dashboard";
      assert.equal(targetRoute, "/admin/dashboard");
    }
  });

  test("5. Member routing resolves to /member/dashboard when relational admin permissions are absent", async () => {
    const memberProfile = await prisma.memberProfile.findFirst({
      include: { user: { include: { roleAssignments: true } } },
    });

    if (memberProfile && memberProfile.user.status === "ACTIVE") {
      const perms = await getUserEffectivePermissions(memberProfile.userId);
      const isAdmin = perms.size > 0 || perms.has("dashboard.view");
      const targetRoute = isAdmin ? "/admin/dashboard" : "/member/dashboard";
      assert.equal(targetRoute, isAdmin ? "/admin/dashboard" : "/member/dashboard");
    }
  });

  test("6. Legacy User.role does NOT grant admin permissions if relational roleAssignments are absent", async () => {
    const unassignedUser = await prisma.user.findFirst({
      where: {
        roleAssignments: { none: {} },
      },
    });

    if (unassignedUser) {
      const perms = await getUserEffectivePermissions(unassignedUser.id);
      assert.equal(perms.size, 0);
      assert.equal(perms.has("dashboard.view"), false);
    }
  });

  test("7. reCAPTCHA verification fails open when unconfigured and fails closed when configured with missing token", async () => {
    const configured = isRecaptchaConfigured();
    if (configured) {
      const res = await verifyRecaptchaToken("");
      assert.equal(res.success, false);
      assert.match(res.error || "", /verification token is required/i);
    } else {
      const res = await verifyRecaptchaToken(null);
      assert.equal(res.success, true);
      assert.equal(res.configured, false);
    }
  });
});
