import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import { getCompanyProfile, updateCompanyProfile, updateCompanyProfileSchema } from "../company-profile";
import { getUserEffectivePermissions } from "../../auth/authorize";

describe("Phase 7A System Settings Unit & RBAC Tests", () => {
  test("should retrieve CompanyProfile singleton record with default official branding", async () => {
    const profile = await getCompanyProfile();
    assert.ok(profile, "CompanyProfile singleton record should exist");
    assert.equal(profile.id, "company-profile-main", "Profile ID should be singleton key");
    assert.equal(profile.displayName, "KN Finance Company", "Default display name should be KN Finance Company");
    assert.equal(profile.tagline, "Empowering your future", "Default tagline should be Empowering your future");
  });

  test("should validate updateCompanyProfileSchema server-side validation rules", () => {
    // Valid input
    const valid = updateCompanyProfileSchema.parse({
      displayName: "KN Finance Group",
      email: "admin@knfinance.com",
      website: "https://kn-finance-company.vercel.app",
      dateFormat: "YYYY-MM-DD",
    });
    assert.equal(valid.displayName, "KN Finance Group");
    assert.equal(valid.email, "admin@knfinance.com");

    // Invalid email rejection
    assert.throws(() => {
      updateCompanyProfileSchema.parse({
        displayName: "Test",
        email: "invalid-email-string",
      });
    }, /Invalid email address/);

    // Invalid URL rejection
    assert.throws(() => {
      updateCompanyProfileSchema.parse({
        displayName: "Test",
        website: "not-a-valid-url",
      });
    }, /Invalid website URL/);
  });

  test("should update CompanyProfile and log audit event atomically", async () => {
    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
    assert.ok(adminUser, "Active admin user must exist for test");

    const updated = await updateCompanyProfile(adminUser.id, {
      displayName: "KN Finance Company",
      legalName: "KN Finance Corporate Ltd",
      tagline: "Empowering your financial future",
      email: "support@knfinance.com",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
    });

    assert.equal(updated.legalName, "KN Finance Corporate Ltd");
    assert.equal(updated.tagline, "Empowering your financial future");

    // Verify Audit Log entry created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "company_profile.update",
        entityType: "CompanyProfile",
        actorUserId: adminUser.id,
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(auditLog, "Audit log entry for company_profile.update should be created");
  });

  test("should verify Super Admin possesses settings.company.manage permission", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Super admin user must exist");

    const perms = await getUserEffectivePermissions(superAdmin.id);
    assert.ok(perms.has("settings.view"), "Super admin must possess settings.view");
    assert.ok(perms.has("settings.company.manage"), "Super admin must possess settings.company.manage");
  });
});
