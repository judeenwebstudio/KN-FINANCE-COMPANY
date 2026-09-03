import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import { createBranch, updateBranch, toggleBranchStatus, BranchValidationError } from "../branch-service";
import { getUserEffectivePermissions } from "../../auth/authorize";
import { bootstrapRBAC } from "../../auth/bootstrap";
import { BranchStatus } from "@/generated/prisma/client";

describe("Phase 7B Branch Management & Financial Configuration Unit & RBAC Tests", () => {
  const testBranchCode = "TEST-BR-" + Math.floor(Math.random() * 10000);
  let createdBranchId: string;

  test("should create a new branch and log audit event", async () => {
    // Ensure RBAC catalog is synced to database
    await bootstrapRBAC();

    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    assert.ok(adminUser, "Super admin user must exist");

    const newBranch = await createBranch(adminUser.id, {
      name: "Test Branch " + testBranchCode,
      code: testBranchCode,
      email: `test.${testBranchCode.toLowerCase()}@knfinance.com`,
      phone: "+1 (800) 555-0199",
      address: "100 Test St",
      city: "Testville",
      state: "TS",
      country: "USA",
      currency: "USD",
    });

    assert.ok(newBranch.id);
    assert.equal(newBranch.code, testBranchCode);
    assert.equal(newBranch.status, BranchStatus.ACTIVE);
    createdBranchId = newBranch.id;

    // Verify audit log entry
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "branch.create",
        entityType: "Branch",
        entityId: newBranch.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditLog, "Audit log entry for branch.create should exist");
  });

  test("should reject duplicate branch code creation", async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    assert.ok(adminUser);

    await assert.rejects(
      async () => {
        await createBranch(adminUser.id, {
          name: "Duplicate Code Branch",
          code: testBranchCode,
          email: "duplicate@knfinance.com",
          phone: "+1 (800) 000-0000",
          address: "123 St",
          city: "City",
          state: "ST",
          country: "USA",
          currency: "USD",
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BranchValidationError);
        assert.match(err.message, /already in use/);
        return true;
      }
    );
  });

  test("should update existing branch and log audit event", async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    assert.ok(adminUser);

    const updated = await updateBranch(adminUser.id, createdBranchId, {
      name: "Updated Branch " + testBranchCode,
      code: testBranchCode,
      email: `test.${testBranchCode.toLowerCase()}@knfinance.com`,
      phone: "+1 (800) 999-8888",
      address: "200 Updated Ave",
      city: "UpdatedCity",
      state: "TS",
      country: "USA",
      currency: "USD",
    });

    assert.equal(updated.name, "Updated Branch " + testBranchCode);
    assert.equal(updated.phone, "+1 (800) 999-8888");

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "branch.update",
        entityType: "Branch",
        entityId: createdBranchId,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditLog, "Audit log entry for branch.update should exist");
  });

  test("should toggle branch status and protect HQ-01 headquarters deactivation", async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    assert.ok(adminUser);

    // Toggle created test branch to INACTIVE
    const deactivated = await toggleBranchStatus(adminUser.id, createdBranchId, BranchStatus.INACTIVE);
    assert.equal(deactivated.status, BranchStatus.INACTIVE);

    // Toggle created test branch back to ACTIVE
    const reactivated = await toggleBranchStatus(adminUser.id, createdBranchId, BranchStatus.ACTIVE);
    assert.equal(reactivated.status, BranchStatus.ACTIVE);

    // Deactivating HQ-01 must throw BranchValidationError
    const hq = await prisma.branch.findUnique({ where: { code: "HQ-01" } });
    if (hq) {
      await assert.rejects(
        async () => {
          await toggleBranchStatus(adminUser.id, hq.id, BranchStatus.INACTIVE);
        },
        (err: unknown) => {
          assert.ok(err instanceof BranchValidationError);
          assert.match(err.message, /Primary Headquarters branch \(HQ-01\) cannot be deactivated/);
          return true;
        }
      );
    }
  });

  test("should verify RBAC permissions for Super Admin vs Admin", async () => {
    await bootstrapRBAC();

    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Super admin user must exist");

    const superAdminPerms = await getUserEffectivePermissions(superAdmin.id);
    assert.ok(superAdminPerms.has("settings.branch.manage"), "Super admin must possess settings.branch.manage");
    assert.ok(superAdminPerms.has("settings.financial.manage"), "Super admin must possess settings.financial.manage");

    const admin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "admin" } } }, status: "ACTIVE" },
    });
    if (admin) {
      const adminPerms = await getUserEffectivePermissions(admin.id);
      assert.ok(adminPerms.has("settings.branch.manage"), "Admin must possess settings.branch.manage");
      assert.equal(
        adminPerms.has("settings.financial.manage"),
        false,
        "Admin must NOT possess settings.financial.manage"
      );
    }
  });
});
