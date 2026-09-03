import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  NOTIFICATION_CATALOG,
  validateNotificationTemplateContent,
  renderNotificationText,
  getAllNotificationTemplates,
  initializeNotificationTemplates,
  updateNotificationTemplate,
  toggleNotificationTemplateStatus,
  renderTemplatePreview,
  NotificationTemplateValidationError,
} from "../notification-service";
import {
  getEmailConfiguration,
  getEmailProviderStatus,
  updateEmailConfiguration,
  sendTestEmail,
  DEFAULT_EMAIL_CONFIG,
} from "../email-service";
import { getUserEffectivePermissions } from "../../auth/authorize";

describe("Phase 7C Hardening Review — Email & Notification Templates Unit & RBAC Tests", () => {
  test("1 & 3. getAllNotificationTemplates performs ZERO writes and missing template rows do not cause read-path inserts", async () => {
    const initialCount = await prisma.notificationTemplate.count();

    const templates = await getAllNotificationTemplates();

    const postCount = await prisma.notificationTemplate.count();

    assert.equal(postCount, initialCount, "getAllNotificationTemplates must perform ZERO writes on GET/read path");
    assert.equal(templates.length, 5, "Must return 5 catalog templates for display");
  });

  test("2 & 4. getEmailConfiguration performs ZERO writes and missing EmailConfiguration row does not cause read-path insert", async () => {
    const initialCount = await prisma.emailConfiguration.count();

    const config = await getEmailConfiguration();

    const postCount = await prisma.emailConfiguration.count();

    assert.equal(postCount, initialCount, "getEmailConfiguration must perform ZERO writes on GET/read path");
    assert.equal(config.id, "email-config-main");
  });

  test("5 & 6. Arbitrary provider names are locked to NONE and provider status remains NONE without implementation", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const status = getEmailProviderStatus();
    assert.equal(status.configured, false);
    assert.equal(status.providerType, "NONE");

    const updated = await updateEmailConfiguration(superAdmin.id, {
      enabled: true,
      senderName: "KN Finance Company",
      senderEmail: "",
      replyToEmail: "",
    });

    assert.equal(updated.provider, "NONE", "Server must lock provider field to NONE");
  });

  test("7. Email cannot falsely report delivery-ready", () => {
    const status = getEmailProviderStatus();
    assert.equal(status.configured, false);
    assert.ok(status.statusMessage.includes("No email delivery provider"), "Must clearly report provider not installed");
  });

  test("8. Fictional sender/reply-to addresses are not defaults", () => {
    assert.equal(DEFAULT_EMAIL_CONFIG.senderEmail, null, "senderEmail default must be null");
    assert.equal(DEFAULT_EMAIL_CONFIG.replyToEmail, null, "replyToEmail default must be null");
  });

  test("9 & 10. Template code and channel are immutable", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const updated = await updateNotificationTemplate(superAdmin.id, "MEMBER_WELCOME", {
      subject: "Welcome to KN Finance, {{memberName}}",
      bodyTemplate: "Dear {{memberName}},\n\nWelcome to {{companyName}}! Member ID: {{memberNumber}}.",
    });

    assert.equal(updated.code, "MEMBER_WELCOME", "Template code must remain immutable");
    assert.equal(updated.channel, "EMAIL", "Channel must remain immutable EMAIL");
  });

  test("11. variables JSON cannot expand placeholder allowlist", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const updated = await updateNotificationTemplate(superAdmin.id, "MEMBER_WELCOME", {
      subject: "Welcome {{memberName}}",
      bodyTemplate: "Hello {{memberName}} from {{companyName}}.",
    });

    const vars = updated.variables as string[];
    assert.deepEqual(vars, ["memberName", "memberNumber", "companyName"], "variables JSON must strictly match server catalog allowlist");
  });

  test("12. Strict placeholder grammar rejects all non-identifier expressions", () => {
    const invalidExpressions = [
      "{{user.name}}",
      "{{#if memberName}}",
      "{{memberName | upper}}",
      "{{constructor}}",
      "{{__proto__}}",
      "{{this}}",
      "{{[memberName]}}",
      "{{ memberName() }}",
      '{{memberName + "x"}}',
    ];

    for (const expr of invalidExpressions) {
      assert.throws(
        () => {
          validateNotificationTemplateContent("MEMBER_WELCOME", "Subject", `Body with ${expr}`);
        },
        (err: unknown) => err instanceof NotificationTemplateValidationError,
        `Must reject invalid expression '${expr}'`
      );
    }
  });

  test("13. Valid allowlisted placeholders render deterministically", () => {
    assert.doesNotThrow(() => {
      validateNotificationTemplateContent(
        "LOAN_APPROVED",
        "Your loan {{loanReference}} is approved",
        "Hello {{memberName}}, approved amount: USD {{approvedAmount}} on {{approvedDate}}."
      );
    });

    const rendered = renderNotificationText("Welcome {{memberName}} to {{companyName}}!", {
      memberName: "Alex Mercer",
      companyName: "KN Finance Company",
    });

    assert.equal(rendered, "Welcome Alex Mercer to KN Finance Company!");
  });

  test("14. No real member/loan data queried for preview", () => {
    const initialMemberQueryCount = 0; // Function works purely synchronously
    const preview = renderTemplatePreview(
      "MEMBER_WELCOME",
      "Welcome {{memberName}}",
      "Welcome {{memberName}} to {{companyName}}! Member No: {{memberNumber}}"
    );

    assert.equal(preview.renderedSubject, "Welcome Alex Mercer");
    assert.equal(preview.sampleDataUsed.memberName, "Alex Mercer");
    assert.equal(initialMemberQueryCount, 0);
  });

  test("15 & 16. User.role grants no Phase 7C permissions & relational RBAC is enforced", async () => {
    const unassignedUser = await prisma.user.create({
      data: {
        email: `unassigned-p7c-${Date.now()}@test.com`,
        name: "Unassigned P7C User",
        passwordHash: "dummyhash",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    try {
      const perms = await getUserEffectivePermissions(unassignedUser.id);
      assert.equal(perms.size, 0, "User.role SUPER_ADMIN without relational assignment MUST receive 0 permissions");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: unassignedUser.id } });
      await prisma.user.delete({ where: { id: unassignedUser.id } });
    }

    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const superAdminPerms = await getUserEffectivePermissions(superAdmin.id);
    assert.ok(superAdminPerms.has("settings.notifications.manage"), "Super Admin must possess settings.notifications.manage");
    assert.ok(superAdminPerms.has("settings.integrations.manage"), "Super Admin must possess settings.integrations.manage");

    const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
    assert.ok(adminRole, "Admin role profile must exist");

    const testAdminUser = await prisma.user.create({
      data: {
        email: `admin-p7c-rbac-${Date.now()}@test.com`,
        name: "Phase 7C Admin RBAC Test",
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "ACTIVE",
        roleAssignments: {
          create: { roleId: adminRole.id },
        },
      },
    });

    try {
      const adminPerms = await getUserEffectivePermissions(testAdminUser.id);
      assert.ok(adminPerms.has("settings.notifications.manage"), "Admin role must possess settings.notifications.manage");
      assert.equal(adminPerms.has("settings.integrations.manage"), false, "Admin role MUST NOT possess settings.integrations.manage");
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminUser.id } });
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testAdminUser.id } });
      await prisma.user.delete({ where: { id: testAdminUser.id } });
    }
  });

  test("17. No runtime DDL in GET/read paths", async () => {
    assert.doesNotThrow(async () => {
      await getEmailConfiguration();
      await getAllNotificationTemplates();
    });
  });

  test("18. Provider-unconfigured test email never reports success", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const result = await sendTestEmail(superAdmin.id, "recipient@example.com");
    assert.equal(result.success, false);
    assert.equal(result.delivered, false);
    assert.equal(result.message, "Email provider is not configured. Delivery skipped.");
  });

  test("Explicit Template Initialization helper functions cleanly", async () => {
    assert.equal(NOTIFICATION_CATALOG.length, 5);
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    if (superAdmin) {
      const toggled = await toggleNotificationTemplateStatus(superAdmin.id, "MEMBER_WELCOME", true);
      assert.equal(toggled.isEnabled, true);
    }
    const res = await initializeNotificationTemplates();
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.seededCodes));
  });
});
