import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { z } from "zod";

export type NotificationEventDefinition = {
  code: string;
  name: string;
  description: string;
  channel: "EMAIL";
  defaultSubject: string;
  defaultBody: string;
  allowedPlaceholders: string[];
  sampleData: Record<string, string>;
};

export const NOTIFICATION_CATALOG: NotificationEventDefinition[] = [
  {
    code: "MEMBER_WELCOME",
    name: "Member Welcome",
    description: "Sent when a new member profile registration is completed.",
    channel: "EMAIL",
    defaultSubject: "Welcome to KN Finance Company, {{memberName}}!",
    defaultBody: "Dear {{memberName}},\n\nWelcome to {{companyName}}! Your official member registration is complete.\n\nMember Number: {{memberNumber}}\n\nThank you for choosing KN Finance Company.",
    allowedPlaceholders: ["memberName", "memberNumber", "companyName"],
    sampleData: {
      memberName: "Alex Mercer",
      memberNumber: "MEM-2026-0042",
      companyName: "KN Finance Company",
    },
  },
  {
    code: "LOAN_APPROVED",
    name: "Loan Approved",
    description: "Sent when a member loan application is formally approved.",
    channel: "EMAIL",
    defaultSubject: "Your Loan Application {{loanReference}} Has Been Approved",
    defaultBody: "Dear {{memberName}},\n\nGreat news! Your loan application {{loanReference}} for USD {{approvedAmount}} has been approved on {{approvedDate}}.\n\nOur team will notify you when disbursement is processed.",
    allowedPlaceholders: ["memberName", "loanReference", "approvedAmount", "approvedDate"],
    sampleData: {
      memberName: "Alex Mercer",
      loanReference: "LN-2026-8801",
      approvedAmount: "5,000.00",
      approvedDate: "2026-09-03",
    },
  },
  {
    code: "LOAN_DISBURSED",
    name: "Loan Disbursed",
    description: "Sent when approved loan principal funds are disbursed.",
    channel: "EMAIL",
    defaultSubject: "Loan Disbursement Notice - {{loanReference}}",
    defaultBody: "Dear {{memberName}},\n\nYour loan {{loanReference}} has been disbursed in the amount of USD {{disbursedAmount}} on {{disbursedDate}}.\n\nPlease log in to review your official repayment schedule.",
    allowedPlaceholders: ["memberName", "loanReference", "disbursedAmount", "disbursedDate"],
    sampleData: {
      memberName: "Alex Mercer",
      loanReference: "LN-2026-8801",
      disbursedAmount: "5,000.00",
      disbursedDate: "2026-09-03",
    },
  },
  {
    code: "REPAYMENT_RECEIVED",
    name: "Repayment Received",
    description: "Sent when a loan repayment transaction is successfully posted.",
    channel: "EMAIL",
    defaultSubject: "Payment Received Confirmation - {{loanReference}}",
    defaultBody: "Dear {{memberName}},\n\nWe have received your payment of USD {{amountPaid}} on {{paymentDate}} for loan {{loanReference}}.\n\nRemaining Loan Balance: USD {{remainingBalance}}\n\nThank you for your prompt payment.",
    allowedPlaceholders: ["memberName", "loanReference", "amountPaid", "paymentDate", "remainingBalance"],
    sampleData: {
      memberName: "Alex Mercer",
      loanReference: "LN-2026-8801",
      amountPaid: "450.00",
      paymentDate: "2026-09-03",
      remainingBalance: "4,550.00",
    },
  },
  {
    code: "OVERDUE_NOTICE",
    name: "Overdue Payment Notice",
    description: "Sent when a loan installment becomes past due.",
    channel: "EMAIL",
    defaultSubject: "Urgent: Overdue Payment Notice for Loan {{loanReference}}",
    defaultBody: "Dear {{memberName}},\n\nThis is a notice that your payment of USD {{overdueAmount}} for loan {{loanReference}} was due on {{dueDate}} and is currently {{daysOverdue}} days overdue.\n\nPlease arrange payment immediately to prevent penalty charges.",
    allowedPlaceholders: ["memberName", "loanReference", "overdueAmount", "dueDate", "daysOverdue"],
    sampleData: {
      memberName: "Alex Mercer",
      loanReference: "LN-2026-8801",
      overdueAmount: "450.00",
      dueDate: "2026-08-25",
      daysOverdue: "9",
    },
  },
];

export class NotificationTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationTemplateValidationError";
  }
}

/**
 * Validates template placeholder syntax, allowlists, and HTML script safety.
 */
export function validateNotificationTemplateContent(code: string, subject: string, bodyTemplate: string) {
  const catalogItem = NOTIFICATION_CATALOG.find((item) => item.code === code);
  if (!catalogItem) {
    throw new NotificationTemplateValidationError(`Notification event code '${code}' is not a registered system event.`);
  }

  // HTML / Script injection safeguards
  const combined = `${subject} ${bodyTemplate}`;
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(combined) || /on\w+\s*=/gi.test(combined) || /javascript:/gi.test(combined)) {
    throw new NotificationTemplateValidationError("Template content contains prohibited executable HTML tags, event handlers, or javascript: schemes.");
  }

  // Extract all {{placeholder}} occurrences
  const placeholderMatches = Array.from(combined.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g));
  const usedPlaceholders = Array.from(new Set(placeholderMatches.map((m) => m[1])));

  // Validate every placeholder against strict event allowlist
  for (const placeholder of usedPlaceholders) {
    if (!catalogItem.allowedPlaceholders.includes(placeholder)) {
      throw new NotificationTemplateValidationError(
        `Invalid placeholder '{{${placeholder}}}' for event '${code}'. Allowed placeholders: ${catalogItem.allowedPlaceholders.join(", ")}`
      );
    }
  }

  // Check for malformed braces or executable expressions e.g. {{eval(...)}}, {{function}}, {{a + b}}
  if (/\{\{(?!\s*[a-zA-Z0-9_]+\s*\}\})/.test(combined)) {
    throw new NotificationTemplateValidationError("Template contains malformed placeholder syntax or executable expressions.");
  }
}

/**
 * Deterministic string placeholder substitution.
 * Executes NO code, eval, or dynamic function calls.
 */
export function renderNotificationText(templateStr: string, data: Record<string, string>): string {
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Retrieves all notification templates, initializing missing catalog defaults idempotently.
 */
export async function getAllNotificationTemplates() {
  try {
    const existing = await prisma.notificationTemplate.findMany({
      orderBy: { code: "asc" },
    });

    const existingCodes = new Set(existing.map((t) => t.code));

    // Idempotent seeding for missing catalog events
    for (const catItem of NOTIFICATION_CATALOG) {
      if (!existingCodes.has(catItem.code)) {
        await prisma.notificationTemplate.upsert({
          where: { code: catItem.code },
          update: {},
          create: {
            code: catItem.code,
            name: catItem.name,
            description: catItem.description,
            channel: catItem.channel,
            subject: catItem.defaultSubject,
            bodyTemplate: catItem.defaultBody,
            variables: catItem.allowedPlaceholders,
            isEnabled: true,
          },
        });
      }
    }

    return await prisma.notificationTemplate.findMany({
      orderBy: { code: "asc" },
    });
  } catch (error: unknown) {
    const msg = String(error);
    if (msg.includes("does not exist") || msg.includes("P2021")) {
      // Missing DB table fallback
      return NOTIFICATION_CATALOG.map((catItem) => ({
        id: `temp-${catItem.code}`,
        code: catItem.code,
        name: catItem.name,
        description: catItem.description,
        channel: catItem.channel,
        subject: catItem.defaultSubject,
        bodyTemplate: catItem.defaultBody,
        variables: catItem.allowedPlaceholders,
        isEnabled: true,
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
    throw error;
  }
}

export const updateTemplateSchema = z.object({
  subject: z.string().trim().min(2, "Subject line is required").max(200),
  bodyTemplate: z.string().trim().min(5, "Body template is required").max(5000),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/**
 * Updates a notification template's subject and body.
 * Validates strict placeholder allowlist server-side.
 */
export async function updateNotificationTemplate(actorUserId: string, code: string, input: UpdateTemplateInput) {
  const validated = updateTemplateSchema.parse(input);

  // Validate placeholder allowlist and HTML safety
  validateNotificationTemplateContent(code, validated.subject, validated.bodyTemplate);

  const existing = await prisma.notificationTemplate.findUnique({ where: { code } });
  if (!existing) {
    throw new NotificationTemplateValidationError(`Template for code '${code}' does not exist.`);
  }

  const changes: Record<string, { from: string; to: string }> = {};
  if (existing.subject !== validated.subject) changes.subject = { from: existing.subject, to: validated.subject };
  if (existing.bodyTemplate !== validated.bodyTemplate) changes.bodyTemplate = { from: "[Existing Body]", to: "[Updated Body]" };

  const updated = await prisma.notificationTemplate.update({
    where: { code },
    data: {
      subject: validated.subject,
      bodyTemplate: validated.bodyTemplate,
      updatedById: actorUserId,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "notification_template.update",
    entityType: "NotificationTemplate",
    entityId: updated.id,
    metadata: {
      code: updated.code,
      name: updated.name,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    },
  });

  return updated;
}

/**
 * Toggles notification template enabled/disabled status.
 */
export async function toggleNotificationTemplateStatus(actorUserId: string, code: string, isEnabled: boolean) {
  const existing = await prisma.notificationTemplate.findUnique({ where: { code } });
  if (!existing) {
    throw new NotificationTemplateValidationError(`Template for code '${code}' does not exist.`);
  }

  const updated = await prisma.notificationTemplate.update({
    where: { code },
    data: {
      isEnabled,
      updatedById: actorUserId,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: isEnabled ? "notification_template.enable" : "notification_template.disable",
    entityType: "NotificationTemplate",
    entityId: updated.id,
    metadata: {
      code: updated.code,
      name: updated.name,
      isEnabled,
    },
  });

  return updated;
}

/**
 * Renders a safe sample preview using synthetic sample data only.
 * Does NOT query real members or send emails.
 */
export function renderTemplatePreview(code: string, subject: string, bodyTemplate: string) {
  const catalogItem = NOTIFICATION_CATALOG.find((item) => item.code === code);
  const sampleData = catalogItem ? catalogItem.sampleData : { memberName: "Sample Member", companyName: "KN Finance Company" };

  return {
    renderedSubject: renderNotificationText(subject, sampleData),
    renderedBody: renderNotificationText(bodyTemplate, sampleData),
    sampleDataUsed: sampleData,
  };
}
