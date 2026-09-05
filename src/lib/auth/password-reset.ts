import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { getEmailProviderStatus, sendPasswordResetEmail } from "../settings/email-service";
import { BCRYPT_COST, MINIMUM_PASSWORD_LENGTH } from "../settings/password-security";

export const GENERIC_FORGOT_PASSWORD_RESPONSE =
  "If an account exists for this email, password reset instructions have been sent.";

export const INVALID_OR_EXPIRED_TOKEN_MESSAGE =
  "Password reset link is invalid or expired.";

export class PasswordResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordResetError";
  }
}

/**
 * Handles Forgot Password request for all user account types (Super Admin, Admin/Staff, Members).
 * Enforces account enumeration protection by returning a generic response for any email input.
 * When email provider is unconfigured (provider = NONE), NO token is created and NO reset link is generated.
 */
export async function requestPasswordReset(emailInput: string, actorUserId?: string) {
  const email = emailInput.trim().toLowerCase();
  const genericSuccess = { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };

  if (!email || !email.includes("@")) {
    return genericSuccess;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  const providerStatus = getEmailProviderStatus();

  // If user is missing or not ACTIVE, return generic success without issuing token or attempting email
  if (!user || user.status !== "ACTIVE") {
    return genericSuccess;
  }

  // TRUTHFUL SMTP CHECK: If email provider is unconfigured, DO NOT issue useless tokens or fake delivery
  if (!providerStatus.configured) {
    await logAuditEvent({
      actorUserId: actorUserId || user.id,
      action: "auth.password_reset_requested_unconfigured",
      entityType: "User",
      entityId: user.id,
      metadata: {
        emailProviderConfigured: false,
        delivered: false,
        reason: "NOT_CONFIGURED",
      },
    });

    return genericSuccess;
  }

  // If email provider IS configured:
  // 1. Revoke prior active reset tokens for this user
  const now = new Date();
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });

  // 2. Generate 32-byte cryptographically random raw token and SHA-256 stored hash
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

  // 3. Store hashed token in DB
  const tokenRecord = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // 4. Attempt remote email delivery (outside database transaction)
  const appUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

  try {
    const dispatchResult = await sendPasswordResetEmail(user.email, resetLink);
    if (!dispatchResult.delivered) {
      // Immediate cleanup if delivery fails
      await prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
  }

  return genericSuccess;
}

/**
 * Validates a raw password reset token.
 * Returns validation status and user metadata without exposing password hash or token internals.
 */
export async function verifyPasswordResetToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return { valid: false as const, user: null };
  }

  const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");
  const now = new Date();

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, name: true, email: true, status: true },
      },
    },
  });

  if (
    !token ||
    token.usedAt !== null ||
    token.revokedAt !== null ||
    token.expiresAt <= now ||
    !token.user ||
    token.user.status !== "ACTIVE"
  ) {
    return { valid: false as const, user: null };
  }

  return { valid: true as const, user: token.user };
}

/**
 * Executes atomic, single-use password reset.
 * Uses conditional updateMany (count === 1) to guarantee atomic consumption under concurrent requests.
 * Hashes new password with bcrypt cost 12, revokes prior tokens, and records audit event in single transaction.
 */
export async function resetPasswordWithToken(rawToken: string, newPassword: string) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    throw new PasswordResetError(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
  }

  if (!newPassword || newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    throw new PasswordResetError(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }

  const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");
  const newPasswordHash = await hash(newPassword, BCRYPT_COST);

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. ATOMIC CONDITIONAL CONSUMPTION: Only 1 request can transition usedAt from null -> now
    const consumeResult = await tx.passwordResetToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (consumeResult.count !== 1) {
      throw new PasswordResetError(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
    }

    // 2. Fetch token details & verify user eligibility
    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, status: true } },
      },
    });

    if (!token || !token.user || token.user.status !== "ACTIVE") {
      throw new PasswordResetError(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
    }

    // 3. Update user password
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash: newPasswordHash },
    });

    // 4. Invalidate all other active reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: {
        userId: token.userId,
        id: { not: token.id },
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    // 5. Transaction-safe audit log
    await logAuditEvent(
      {
        actorUserId: token.userId,
        action: "auth.password_reset_completed",
        entityType: "User",
        entityId: token.userId,
        metadata: { selfService: true },
      },
      tx
    );

    return { success: true as const };
  });
}
