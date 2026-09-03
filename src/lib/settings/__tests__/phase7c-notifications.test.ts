import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  NOTIFICATION_CATALOG,
  validateNotificationTemplateContent,
  renderNotificationText,
  getAllNotificationTemplates,
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
} from "../email-service";
import { getUserEffectivePermissions } from "../../auth/authorize";

describe("Phase 7C Email & Notification Templates Unit & RBAC Tests", () => {
  test("1. Should verify registered notification event catalog contains exactly 5 valid system events", () => {
    assert.equal(NOTIFICATION_CATALOG.length, 5, "Catalog must contain exactly 5 notification events");
    const codes = NOTIFICATION_CATALOG.map((item) => item.code);
    assert.deepEqual(
      codes.sort(),
      ["LOAN_APPROVED", "LOAN_DISBURSED", "MEMBER_WELCOME", "OVERDUE_NOTICE", "REPAYMENT_RECEIVED"].sort(),
      "Event catalog must contain MEMBER_WELCOME, LOAN_APPROVED, LOAN_DISBURSED, REPAYMENT_RECEIVED, OVERDUE_NOTICE"
    );
  });

  test("2 & 3. Should accept valid placeholders and reject unknown or unsupported event codes", () => {
    // Valid placeholders for LOAN_APPROVED
    assert.doesNotThrow(() => {
      validateNotificationTemplateContent(
        "LOAN_APPROVED",
        "Your loan {{loanReference}} is approved",
        "Hello {{memberName}}, approved amount: USD {{approvedAmount}} on {{approvedDate}}."
      );
    });

    // Rejects unregistered event code
    assert.throws(
      () => {
        validateNotificationTemplateContent("CUSTOM_UNREGISTERED_EVENT", "Subject", "Body");
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError && err.message.includes("not a registered system event")
    );
  });

  test("4 & 5. Should reject unknown placeholders and malformed syntax", () => {
    // Rejects placeholder not in allowlist
    assert.throws(
      () => {
        validateNotificationTemplateContent(
          "LOAN_APPROVED",
          "Subject",
          "Hello {{memberName}}, your secret: {{adminPassword}}"
        );
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError && err.message.includes("Invalid placeholder '{{adminPassword}}'")
    );

    // Rejects malformed placeholder syntax
    assert.throws(
      () => {
        validateNotificationTemplateContent(
          "LOAN_APPROVED",
          "Subject",
          "Hello {{ memberName + ' ' + secret }}"
        );
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError
    );
  });

  test("6. Should reject executable HTML tags, event handlers, and javascript: schemes", () => {
    assert.throws(
      () => {
        validateNotificationTemplateContent(
          "MEMBER_WELCOME",
          "Subject",
          "Welcome {{memberName}} <script>alert(1)</script>"
        );
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError && err.message.includes("prohibited executable HTML tags")
    );

    assert.throws(
      () => {
        validateNotificationTemplateContent(
          "MEMBER_WELCOME",
          "Subject",
          "Welcome {{memberName}} <img src='x' onerror='alert(1)' />"
        );
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError && err.message.includes("prohibited executable HTML tags")
    );

    assert.throws(
      () => {
        validateNotificationTemplateContent(
          "MEMBER_WELCOME",
          "Subject",
          "Welcome <a href='javascript:alert(1)'>Click me</a>"
        );
      },
      (err: unknown) => err instanceof NotificationTemplateValidationError && err.message.includes("prohibited executable HTML tags")
    );
  });

  test("7 & 8. Should perform deterministic string placeholder substitution and render safe sample preview", () => {
    const rendered = renderNotificationText("Welcome {{memberName}} to {{companyName}}!", {
      memberName: "Jane Doe",
      companyName: "KN Finance Company",
    });

    assert.equal(rendered, "Welcome Jane Doe to KN Finance Company!");

    const preview = renderTemplatePreview(
      "MEMBER_WELCOME",
      "Welcome {{memberName}}",
      "Welcome {{memberName}} to {{companyName}}! Member No: {{memberNumber}}"
    );

    assert.equal(preview.renderedSubject, "Welcome Alex Mercer");
    assert.ok(preview.renderedBody.includes("Alex Mercer"), "Preview must render synthetic sample data");
    assert.ok(preview.renderedBody.includes("MEM-2026-0042"), "Preview must render synthetic member number");
  });

  test("9 & 10. Should update notification template, toggle status, and log audit events cleanly", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin user must exist for test");

    // Initialize templates
    await getAllNotificationTemplates();

    const updated = await updateNotificationTemplate(superAdmin.id, "MEMBER_WELCOME", {
      subject: "Welcome to KN Finance, {{memberName}}",
      bodyTemplate: "Dear {{memberName}},\n\nWelcome to {{companyName}}! Member ID: {{memberNumber}}.",
    });

    assert.equal(updated.subject, "Welcome to KN Finance, {{memberName}}");

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "notification_template.update", entityType: "NotificationTemplate" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(auditLog, "Audit log entry for notification_template.update must be created");

    // Toggle status
    const disabled = await toggleNotificationTemplateStatus(superAdmin.id, "MEMBER_WELCOME", false);
    assert.equal(disabled.isEnabled, false);

    const toggleLog = await prisma.auditLog.findFirst({
      where: { action: "notification_template.disable", entityType: "NotificationTemplate" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(toggleLog, "Audit log entry for notification_template.disable must be created");

    // Re-enable template
    await toggleNotificationTemplateStatus(superAdmin.id, "MEMBER_WELCOME", true);
  });

  test("11. Should verify RBAC permissions for settings.notifications.manage and settings.integrations.manage", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const superAdminPerms = await getUserEffectivePermissions(superAdmin.id);
    assert.ok(superAdminPerms.has("settings.notifications.manage"), "Super Admin must possess settings.notifications.manage");
    assert.ok(superAdminPerms.has("settings.integrations.manage"), "Super Admin must possess settings.integrations.manage");

    // Create a temporary Admin user to verify permission ceiling
    const adminRole = await prisma.roleProfile.findUnique({ where: { slug: "admin" } });
    assert.ok(adminRole, "Admin role profile must exist");

    const testAdminUser = await prisma.user.create({
      data: {
        email: `admin-p7c-${Date.now()}@test.com`,
        name: "Phase 7C Admin Test",
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
      await prisma.userRoleAssignment.deleteMany({ where: { userId: testAdminUser.id } });
      await prisma.user.delete({ where: { id: testAdminUser.id } });
    }
  });

  test("13, 14 & 15. Should verify unconfigured provider behavior, test email blocking, and zero secret leakage", async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roleAssignments: { some: { role: { slug: "super_admin" } } }, status: "ACTIVE" },
    });
    assert.ok(superAdmin, "Active Super Admin must exist");

    const status = getEmailProviderStatus();
    assert.equal(typeof status.configured, "boolean");

    // If provider credentials are absent in test environment, verify delivery is blocked
    if (!status.configured) {
      const testResult = await sendTestEmail(superAdmin.id, "recipient@test.com");
      assert.equal(testResult.success, false);
      assert.equal(testResult.delivered, false);
      assert.equal(testResult.message, "Email provider is not configured. Delivery skipped.");
    }

    // Verify non-secret email configuration update
    const updatedConfig = await updateEmailConfiguration(superAdmin.id, {
      enabled: false,
      senderName: "KN Finance Company",
      senderEmail: "notifications@knfinance.com",
      replyToEmail: "support@knfinance.com",
    });

    assert.equal(updatedConfig.senderName, "KN Finance Company");
    assert.equal(updatedConfig.senderEmail, "notifications@knfinance.com");

    const readConfig = await getEmailConfiguration();
    assert.equal(readConfig.senderEmail, "notifications@knfinance.com");

    // Ensure no password, key, or token fields exist on EmailConfiguration model
    assert.equal((readConfig as Record<string, unknown>).password, undefined, "EmailConfiguration must not contain password field");
    assert.equal((readConfig as Record<string, unknown>).apiKey, undefined, "EmailConfiguration must not contain apiKey field");
  });
});
