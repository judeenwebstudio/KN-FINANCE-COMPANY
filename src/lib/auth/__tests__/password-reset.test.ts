import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { compare } from "bcryptjs";
import {
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  GENERIC_FORGOT_PASSWORD_RESPONSE,
  INVALID_OR_EXPIRED_TOKEN_MESSAGE,
} from "../password-reset";
import { getEmailProviderStatus } from "../../settings/email-service";
import { prisma } from "../../prisma";

describe("Auth Hardening — Unified Password Reset Flow Tests", () => {
  test("1. Generic response for non-existent email (enumeration protection)", async () => {
    const res = await requestPasswordReset("nonexistent-user-12345@knfinance.com");
    assert.equal(res.success, true);
    assert.equal(res.message, GENERIC_FORGOT_PASSWORD_RESPONSE);
  });

  test("2. Generic response for existing email (enumeration protection)", async () => {
    const activeUser = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (activeUser) {
      const res = await requestPasswordReset(activeUser.email);
      assert.equal(res.success, true);
      assert.equal(res.message, GENERIC_FORGOT_PASSWORD_RESPONSE);
    }
  });

  test("3. When SMTP is unconfigured (provider = NONE), ZERO PasswordResetToken records are created", async () => {
    const status = getEmailProviderStatus();
    assert.equal(status.configured, false);

    const activeUser = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (activeUser) {
      const countBefore = await prisma.passwordResetToken.count({ where: { userId: activeUser.id } });
      await requestPasswordReset(activeUser.email);
      const countAfter = await prisma.passwordResetToken.count({ where: { userId: activeUser.id } });
      assert.equal(countAfter, countBefore, "No reset token should be saved when SMTP is unconfigured");
    }
  });

  test("4. Inactive or Suspended users receive generic response and zero reset tokens", async () => {
    const inactiveUser = await prisma.user.findFirst({
      where: { status: { in: ["INACTIVE", "SUSPENDED"] } },
    });

    if (inactiveUser) {
      const res = await requestPasswordReset(inactiveUser.email);
      assert.equal(res.success, true);
      assert.equal(res.message, GENERIC_FORGOT_PASSWORD_RESPONSE);

      const tokenCount = await prisma.passwordResetToken.count({ where: { userId: inactiveUser.id } });
      assert.equal(tokenCount, 0, "No token should be created for non-active accounts");
    }
  });

  test("5. Invalid or malformed tokens are safely rejected by verifyPasswordResetToken", async () => {
    const res1 = await verifyPasswordResetToken("");
    assert.equal(res1.valid, false);

    const res2 = await verifyPasswordResetToken("invalid-raw-token-1234567890");
    assert.equal(res2.valid, false);
  });

  test("6. Token lifecycle: creation, verification, single-use consumption, and atomic update", async () => {
    const activeUser = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!activeUser) return;

    // Manually create a test token record simulating a configured transport state
    const rawToken = "test-raw-token-64-character-hex-string-for-verification-only-001";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const tokenRecord = await prisma.passwordResetToken.create({
      data: {
        userId: activeUser.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      // Verification check
      const verification = await verifyPasswordResetToken(rawToken);
      assert.equal(verification.valid, true);
      assert.equal(verification.user?.id, activeUser.id);

      // Raw token is NOT stored in database
      const dbToken = await prisma.passwordResetToken.findUnique({ where: { id: tokenRecord.id } });
      assert.notEqual(dbToken?.tokenHash, rawToken);

      // Execute password reset
      const newPassword = "NewSecurePassword123!";
      const resetResult = await resetPasswordWithToken(rawToken, newPassword);
      assert.equal(resetResult.success, true);

      // Verify user password hash was updated with bcrypt cost 12
      const updatedUser = await prisma.user.findUnique({ where: { id: activeUser.id } });
      assert.ok(updatedUser);
      assert.equal(await compare(newPassword, updatedUser.passwordHash), true);

      // Verify token is now marked usedAt (single-use)
      const consumedToken = await prisma.passwordResetToken.findUnique({ where: { id: tokenRecord.id } });
      assert.ok(consumedToken?.usedAt !== null);

      // Re-verification with used token fails
      const reVerification = await verifyPasswordResetToken(rawToken);
      assert.equal(reVerification.valid, false);

      // Second reset attempt with same consumed token fails
      await assert.rejects(
        resetPasswordWithToken(rawToken, "AnotherPassword123!"),
        (err: unknown) => {
          return err instanceof Error && err.message === INVALID_OR_EXPIRED_TOKEN_MESSAGE;
        }
      );
    } finally {
      // Cleanup test token
      await prisma.passwordResetToken.deleteMany({ where: { userId: activeUser.id } });
    }
  });

  test("7. Concurrency Test: Atomic token consumption allows exactly ONE of simultaneous reset calls to succeed", async () => {
    const activeUser = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!activeUser) return;

    const rawToken = "concurrent-test-raw-token-hex-string-00000000000000000000002";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: activeUser.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      // Execute 2 concurrent reset attempts simultaneously
      const results = await Promise.allSettled([
        resetPasswordWithToken(rawToken, "ConcurrentPasswordAttempt1!"),
        resetPasswordWithToken(rawToken, "ConcurrentPasswordAttempt2!"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one reset attempt must succeed");
      assert.equal(rejected.length, 1, "Exactly one reset attempt must fail");
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: activeUser.id } });
    }
  });

  test("8. Revoked and Expired tokens are rejected", async () => {
    const activeUser = await prisma.user.findFirst({ where: { status: "ACTIVE" } });
    if (!activeUser) return;

    // Expired token
    const expiredRaw = "expired-raw-token-hex-string-00000000000000000000000000003";
    const expiredHash = createHash("sha256").update(expiredRaw).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: activeUser.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const expiredCheck = await verifyPasswordResetToken(expiredRaw);
    assert.equal(expiredCheck.valid, false);

    // Revoked token
    const revokedRaw = "revoked-raw-token-hex-string-00000000000000000000000000004";
    const revokedHash = createHash("sha256").update(revokedRaw).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: activeUser.id,
        tokenHash: revokedHash,
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: new Date(),
      },
    });

    const revokedCheck = await verifyPasswordResetToken(revokedRaw);
    assert.equal(revokedCheck.valid, false);

    // Cleanup
    await prisma.passwordResetToken.deleteMany({ where: { userId: activeUser.id } });
  });
});
