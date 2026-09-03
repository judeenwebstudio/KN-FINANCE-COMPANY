import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import { getCompanyProfile, updateCompanyProfile, updateCompanyProfileSchema } from "../company-profile";
import { getUserEffectivePermissions } from "../../auth/authorize";

describe("Phase 7A System Settings Unit & RBAC Tests", () => {
  test("should retrieve CompanyProfile singleton record without database mutation if missing", async () => {
    // Delete singleton if present to test read-only fallback
    await prisma.companyProfile.deleteMany({ where: { id: "company-profile-main" } });

    const fallbackProfile = await getCompanyProfile();
    assert.ok(fallbackProfile, "Fallback CompanyProfile record should exist");
    assert.equal(fallbackProfile.id, "company-profile-main", "Profile ID should be singleton key");
    assert.equal(fallbackProfile.displayName, "KN Finance Company", "Default display name should be KN Finance Company");
    assert.equal(fallbackProfile.tagline, "Empowering your future", "Default tagline should be Empowering your future");

    // Verify read-only behavior (no row inserted into DB by getCompanyProfile)
    const dbCheck = await prisma.companyProfile.findUnique({ where: { id: "company-profile-main" } });
    assert.equal(dbCheck, null, "getCompanyProfile must remain strictly read-only and not insert DB records");
  });

  test("should validate updateCompanyProfileSchema server-side validation rules and asset URL schemes", () => {
    // Valid input with safe relative logo path and HTTPS favicon
    const valid = updateCompanyProfileSchema.parse({
      displayName: "KN Finance Group",
      email: "admin@knfinance.com",
      website: "https://kn-finance-company.vercel.app",
      dateFormat: "YYYY-MM-DD",
      logoUrl: "/branding/kn-finance-logo.png",
      faviconUrl: "https://kn-finance-company.vercel.app/favicon.ico",
    });
    assert.equal(valid.displayName, "KN Finance Group");
    assert.equal(valid.email, "admin@knfinance.com");
    assert.equal(valid.logoUrl, "/branding/kn-finance-logo.png");

    // Invalid email rejection
    assert.throws(() => {
      updateCompanyProfileSchema.parse({
        displayName: "Test",
        email: "invalid-email-string",
      });
    }, /Invalid email address/);

    // Unsafe javascript: scheme logo rejection
    assert.throws(() => {
      updateCompanyProfileSchema.parse({
        displayName: "Test",
        logoUrl: "javascript:alert(1)",
      });
    }, /Logo URL must be a relative path/);

    // Unsafe data: scheme logo rejection
    assert.throws(() => {
      updateCompanyProfileSchema.parse({
        displayName: "Test",
        logoUrl: "data:text/html,<script>alert(1)</script>",
      });
    }, /Logo URL must be a relative path/);
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
      logoUrl: "/branding/kn-finance-logo.png",
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
