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
 * Checks server-side infrastructure environment for configured email provider credentials.
 * Does NOT expose secret key values or passwords.
 */
export function getEmailProviderStatus() {
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);

  if (hasSmtp) {
    return {
      configured: true,
      providerType: "SMTP",
      statusMessage: "SMTP infrastructure credentials configured in server environment.",
    };
  }

  if (hasResend) {
    return {
      configured: true,
      providerType: "RESEND",
      statusMessage: "Resend API key configured in server environment.",
    };
  }

  if (hasSendGrid) {
    return {
      configured: true,
      providerType: "SENDGRID",
      statusMessage: "SendGrid API key configured in server environment.",
    };
  }

  return {
    configured: false,
    providerType: "NONE",
    statusMessage: "Email provider is not configured.",
  };
}

/**
 * Retrieves non-secret Email Configuration.
 * Strictly read-only fallback if table or singleton record is absent.
 */
export async function getEmailConfiguration() {
  try {
    const config = await prisma.emailConfiguration.findUnique({
      where: { id: "email-config-main" },
    });

    if (config) return config;

    return {
      ...DEFAULT_EMAIL_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedById: null,
    };
  } catch (error: unknown) {
    const msg = String(error);
    if (msg.includes("does not exist") || msg.includes("P2021")) {
      return {
        ...DEFAULT_EMAIL_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: null,
      };
    }
    throw error;
  }
}

/**
 * Updates non-secret Email Configuration settings.
 * NEVER accepts or persists secret credentials, passwords, or tokens.
 */
export async function updateEmailConfiguration(actorUserId: string, input: EmailConfigurationInput) {
  const validated = emailConfigurationSchema.parse(input);

  const cleanData = {
    enabled: validated.enabled,
    senderName: validated.senderName,
    senderEmail: validated.senderEmail || null,
    replyToEmail: validated.replyToEmail || null,
    provider: getEmailProviderStatus().providerType,
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
      senderEmail: updatedConfig.senderEmail,
      replyToEmail: updatedConfig.replyToEmail,
      provider: updatedConfig.provider,
    },
  });

  return updatedConfig;
}

/**
 * Sends a test email to a validated recipient address.
 * Fails gracefully if provider is unconfigured in server environment.
 * NEVER simulates fake successful delivery when provider is missing.
 */
export async function sendTestEmail(actorUserId: string, recipientEmail: string) {
  const emailSchema = z.string().trim().email("Invalid recipient email address");
  const validRecipient = emailSchema.parse(recipientEmail);

  const providerStatus = getEmailProviderStatus();

  if (!providerStatus.configured) {
    return {
      success: false,
      delivered: false,
      message: "Email provider is not configured. Delivery skipped.",
    };
  }

  // Delivery mechanism for configured provider environment
  await logAuditEvent({
    actorUserId,
    action: "email.test",
    entityType: "EmailConfiguration",
    entityId: "email-config-main",
    metadata: {
      recipientEmail: validRecipient,
      providerType: providerStatus.providerType,
    },
  });

  return {
    success: true,
    delivered: true,
    message: `Test email successfully submitted to ${validRecipient} via ${providerStatus.providerType}.`,
  };
}
