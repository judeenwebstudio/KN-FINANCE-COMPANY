import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { compare, hash } from "bcryptjs";
import { prisma } from "../../prisma";
import { BCRYPT_COST, changeOwnPassword, changePasswordSchema, MINIMUM_PASSWORD_LENGTH } from "../password-security";
import { getSafeIntegrationStatus, getSafeOperationalStatus, getSafeSecurityStatus } from "../system-status";
import { bootstrapRBAC } from "../../auth/bootstrap";
import { getUserEffectivePermissions } from "../../auth/authorize";

describe("Phase 7D security and system administration", () => {
  test("password validation requires current password, minimum length, and confirmation", () => {
    assert.equal(MINIMUM_PASSWORD_LENGTH, 8);
    assert.equal(BCRYPT_COST, 12);
    assert.equal(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "12345678", confirmPassword: "12345678" }).success, false);
    assert.equal(changePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "short", confirmPassword: "short" }).success, false);
    assert.equal(changePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "new-password", confirmPassword: "different" }).success, false);
  });

  test("password change verifies current password, hashes replacement, and audits without secrets", async () => {
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currentPassword = `Current-${marker}`;
    const newPassword = `Replacement-${marker}`;
    const user = await prisma.user.create({ data: { name: "Security Test", email: `security-${marker}@example.test`, passwordHash: await hash(currentPassword, BCRYPT_COST), status: "ACTIVE" } });
    try {
      await assert.rejects(() => changeOwnPassword(user.id, { currentPassword: "incorrect-password", newPassword, confirmPassword: newPassword }), /Current password is incorrect/);
      await changeOwnPassword(user.id, { currentPassword, newPassword, confirmPassword: newPassword });
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
      assert.equal(await compare(newPassword, updated.passwordHash), true);
      assert.equal(updated.passwordHash.includes(newPassword), false);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorUserId: user.id, action: "security.password_change" }, orderBy: { createdAt: "desc" } });
      const serialized = audit.metadataJson || "";
      assert.equal(/password|hash|credential|secret/i.test(serialized), false);
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("integration and operational status expose truth without secret values or fake providers", () => {
    const integrations = getSafeIntegrationStatus();
    const security = getSafeSecurityStatus();
    const operations = getSafeOperationalStatus();
    assert.deepEqual([integrations.email.configured, integrations.sms.configured, integrations.payments.configured], [false, false, false]);
    assert.match(integrations.payments.detail, /Phase 8 pending/);
    assert.equal(integrations.storage.mode, "Private");
    assert.equal(operations.baseCurrency, "INR (₹) only");
    const output = JSON.stringify({ integrations, security, operations });
    assert.equal(/BLOB_READ_WRITE_TOKEN|DATABASE_URL|AUTH_SECRET|smtp.*password|api.?key/i.test(output), false);
  });

  test("restricted system and integration controls use relational permissions", async () => {
    await bootstrapRBAC();
    const admin = await prisma.user.findFirst({ where: { roleAssignments: { some: { role: { slug: "admin" } } }, status: "ACTIVE" } });
    if (!admin) return;
    const permissions = await getUserEffectivePermissions(admin.id);
    assert.equal(permissions.has("settings.update"), false);
    assert.equal(permissions.has("settings.integrations.manage"), false);
    assert.equal(permissions.has("settings.view"), true);
  });

  test("system status read implementation contains no database mutation or runtime DDL", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../system-status.ts", import.meta.url), "utf8"));
    assert.doesNotMatch(source, /prisma\.|CREATE TABLE|ALTER TABLE|upsert\(|insert\(/i);
  });
});
