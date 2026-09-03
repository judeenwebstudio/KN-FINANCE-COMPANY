import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { z } from "zod";

export const emailConfigurationSchema = z.object({
  enabled: z.boolean(),
  senderName: z.string().trim().min(1, "Sender Display Name is required").max(100),
  senderEmail: z.string().trim().email("Invalid sender email address").nullable().or(z.literal("")),
  replyToEmail: z.string().trim().email("Invalid reply-to email address").nullable().or(z.literal("")),
});

export type EmailConfigurationInput = z.infer<typeof emailConfigurationSchema>;

export const DEFAULT_EMAIL_CONFIG = {
  id: "email-config-main",
  enabled: false,
  provider: "NONE",
  senderName: "KN Finance Company",
  senderEmail: null,
  replyToEmail: null,
};

/**
 * Returns server provider readiness status.
 * Strictly reflects actual code capability. Currently no delivery provider SDK is installed.
 */
export function getEmailProviderStatus() {
  return {
    configured: false,
    providerType: "NONE" as const,
    statusMessage: "No email delivery provider is installed or configured.",
  };
}

/**
 * Retrieves non-secret Email Configuration.
 * STRICTLY READ-ONLY GET: Executes ZERO database writes or inserts.
 */
export async function getEmailConfiguration() {
  try {
    const config = await prisma.emailConfiguration.findUnique({
      where: { id: "email-config-main" },
    });

    if (config) return config;

    // TABLE EXISTS + ROW MISSING: return safe in-memory fallback without insert
    return {
      ...DEFAULT_EMAIL_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedById: null,
    };
  } catch (error: unknown) {
    const msg = String(error);
    if (msg.includes("does not exist") || msg.includes("P2021")) {
      throw new Error("Email configuration schema is missing or uninitialized.");
    }
    throw error;
  }
}

/**
 * Updates non-secret Email Configuration settings.
 * Client CANNOT submit arbitrary provider strings; provider is locked to "NONE".
 */
export async function updateEmailConfiguration(actorUserId: string, input: EmailConfigurationInput) {
  const validated = emailConfigurationSchema.parse(input);

  const cleanData = {
    enabled: validated.enabled,
    senderName: validated.senderName,
    senderEmail: validated.senderEmail || null,
    replyToEmail: validated.replyToEmail || null,
    provider: "NONE",
    updatedById: actorUserId,
  };

  const updatedConfig = await prisma.emailConfiguration.upsert({
    where: { id: "email-config-main" },
    update: cleanData,
    create: {
      id: "email-config-main",
      ...cleanData,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "email_settings.update",
    entityType: "EmailConfiguration",
    entityId: updatedConfig.id,
    metadata: {
      enabled: updatedConfig.enabled,
      senderName: updatedConfig.senderName,
      hasSenderEmail: Boolean(updatedConfig.senderEmail),
      hasReplyToEmail: Boolean(updatedConfig.replyToEmail),
      provider: updatedConfig.provider,
    },
  });

  return updatedConfig;
}

/**
 * Attempts diagnostic test email dispatch.
 * Fails gracefully when provider is unconfigured.
 * NEVER simulates fake successful delivery.
 * Audit metadata is strictly privacy-minimized.
 */
export async function sendTestEmail(actorUserId: string, recipientEmail: string) {
  const emailSchema = z.string().trim().email("Invalid recipient email address");
  emailSchema.parse(recipientEmail);

  const providerStatus = getEmailProviderStatus();

  if (!providerStatus.configured) {
    await logAuditEvent({
      actorUserId,
      action: "email.test",
      entityType: "EmailConfiguration",
      entityId: "email-config-main",
      metadata: {
        providerType: "NONE",
        status: "NOT_CONFIGURED",
        delivered: false,
      },
    });

    return {
      success: false,
      delivered: false,
      message: "Email provider is not configured. Delivery skipped.",
    };
  }

  return {
    success: false,
    delivered: false,
    message: "Email provider is not configured. Delivery skipped.",
  };
}
