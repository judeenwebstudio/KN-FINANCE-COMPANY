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
    defaultSubject: "Overdue Payment Notice - {{loanReference}}",
    defaultBody: "Dear {{memberName}},\n\nThis is a notice that your payment of USD {{overdueAmount}} for loan {{loanReference}} was due on {{dueDate}} and is currently {{daysOverdue}} days overdue.\n\nPlease arrange payment at your earliest convenience.",
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
 * Enforces strict grammar for template placeholders and HTML script safety.
 * Allowed placeholder syntax: STRICTLY {{identifier}} where identifier matches ^[A-Za-z][A-Za-z0-9_]*$
 * and belongs to the event's allowedPlaceholders catalog list.
 * Rejects all expressions, dot access, function calls, pipes, or operators.
 */
export function validateNotificationTemplateContent(code: string, subject: string, bodyTemplate: string) {
  const catalogItem = NOTIFICATION_CATALOG.find((item) => item.code === code);
  if (!catalogItem) {
    throw new NotificationTemplateValidationError(`Notification event code '${code}' is not a registered system event.`);
  }

  const combined = `${subject} ${bodyTemplate}`;

  // HTML & Script injection safeguards
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(combined) || /on\w+\s*=/gi.test(combined) || /javascript:/gi.test(combined)) {
    throw new NotificationTemplateValidationError("Template content contains prohibited executable HTML tags, event handlers, or javascript: schemes.");
  }

  // Find all {{...}} blocks in content
  const braceMatches = Array.from(combined.matchAll(/\{\{([^}]+)\}\}/g));

  for (const match of braceMatches) {
    const rawContent = match[1];
    const trimmed = rawContent.trim();

    // Strict identifier grammar check: must be a simple alphanumeric/underscore identifier starting with a letter
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
      throw new NotificationTemplateValidationError(
        `Invalid placeholder expression '{{${rawContent}}}'. Only simple identifiers e.g. {{memberName}} are permitted. No expressions, functions, or property paths allowed.`
      );
    }

    // Must be in server event catalog allowlist
    if (!catalogItem.allowedPlaceholders.includes(trimmed)) {
      throw new NotificationTemplateValidationError(
        `Invalid placeholder '{{${trimmed}}}' for event '${code}'. Allowed placeholders: ${catalogItem.allowedPlaceholders.join(", ")}`
      );
    }
  }

  // Ensure no unclosed braces like {{ or }} exist without matching
  const openCount = (combined.match(/\{\{/g) || []).length;
  const closeCount = (combined.match(/\}\}/g) || []).length;
  if (openCount !== closeCount || openCount !== braceMatches.length) {
    throw new NotificationTemplateValidationError("Template contains malformed or unclosed placeholder braces.");
  }
}

/**
 * Deterministic string placeholder substitution.
 * Executes NO code, eval, or dynamic function calls.
 */
export function renderNotificationText(templateStr: string, data: Record<string, string>): string {
  return templateStr.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Retrieves all notification templates.
 * STRICTLY READ-ONLY GET: Performs database read ONLY. Executes ZERO database writes or upserts on GET.
 * If database rows are missing, returns in-memory catalog defaults for display.
 */
export async function getAllNotificationTemplates() {
  try {
    const dbTemplates = await prisma.notificationTemplate.findMany({
      orderBy: { code: "asc" },
    });

    if (dbTemplates.length > 0) {
      const dbMap = new Map(dbTemplates.map((t) => [t.code, t]));

      // Merge DB rows with catalog items, falling back to catalog defaults for unpersisted items
      return NOTIFICATION_CATALOG.map((catItem) => {
        const existing = dbMap.get(catItem.code);
        if (existing) {
          return {
            id: existing.id,
            code: existing.code,
            name: existing.name,
            description: existing.description,
            channel: "EMAIL",
            subject: existing.subject,
            bodyTemplate: existing.bodyTemplate,
            variables: catItem.allowedPlaceholders,
            isEnabled: existing.isEnabled,
            updatedById: existing.updatedById,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
          };
        }
        return {
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
        };
      });
    }

    // In-memory catalog representation when DB table is empty
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
  } catch (error: unknown) {
    const msg = String(error);
    if (msg.includes("does not exist") || msg.includes("P2021")) {
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

/**
 * EXPLICIT INITIALIZATION PATH.
 * Idempotently seeds default notification templates into the database.
 * NEVER called from GET or page render paths.
 */
export async function initializeNotificationTemplates() {
  const created: string[] = [];

  for (const catItem of NOTIFICATION_CATALOG) {
    const existing = await prisma.notificationTemplate.findUnique({
      where: { code: catItem.code },
    });

    if (!existing) {
      await prisma.notificationTemplate.create({
        data: {
          code: catItem.code,
          name: catItem.name,
          description: catItem.description,
          channel: "EMAIL",
          subject: catItem.defaultSubject,
          bodyTemplate: catItem.defaultBody,
          variables: catItem.allowedPlaceholders,
          isEnabled: true,
        },
      });
      created.push(catItem.code);
    }
  }

  return { success: true, seededCodes: created };
}

export const updateTemplateSchema = z.object({
  subject: z.string().trim().min(2, "Subject line is required").max(200),
  bodyTemplate: z.string().trim().min(5, "Body template is required").max(5000),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/**
 * Updates a notification template's subject and body.
 * Code and channel are IMMUTABLE.
 * Variables JSON is snapshot metadata derived from server event catalog.
 */
export async function updateNotificationTemplate(actorUserId: string, code: string, input: UpdateTemplateInput) {
  const catalogItem = NOTIFICATION_CATALOG.find((item) => item.code === code);
  if (!catalogItem) {
    throw new NotificationTemplateValidationError(`Notification event code '${code}' is not a registered system event.`);
  }

  const validated = updateTemplateSchema.parse(input);

  // Validate placeholder allowlist and HTML safety
  validateNotificationTemplateContent(code, validated.subject, validated.bodyTemplate);

  const existing = await prisma.notificationTemplate.findUnique({ where: { code } });

  const subjectChanged = !existing || existing.subject !== validated.subject;
  const bodyChanged = !existing || existing.bodyTemplate !== validated.bodyTemplate;

  const updated = await prisma.notificationTemplate.upsert({
    where: { code },
    update: {
      subject: validated.subject,
      bodyTemplate: validated.bodyTemplate,
      variables: catalogItem.allowedPlaceholders,
      channel: "EMAIL",
      updatedById: actorUserId,
    },
    create: {
      code: catalogItem.code,
      name: catalogItem.name,
      description: catalogItem.description,
      channel: "EMAIL",
      subject: validated.subject,
      bodyTemplate: validated.bodyTemplate,
      variables: catalogItem.allowedPlaceholders,
      isEnabled: true,
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
      subjectChanged,
      bodyChanged,
    },
  });

  return updated;
}

/**
 * Toggles notification template enabled/disabled status.
 */
export async function toggleNotificationTemplateStatus(actorUserId: string, code: string, isEnabled: boolean) {
  const catalogItem = NOTIFICATION_CATALOG.find((item) => item.code === code);
  if (!catalogItem) {
    throw new NotificationTemplateValidationError(`Notification event code '${code}' is not a registered system event.`);
  }

  const updated = await prisma.notificationTemplate.upsert({
    where: { code },
    update: {
      isEnabled,
      updatedById: actorUserId,
    },
    create: {
      code: catalogItem.code,
      name: catalogItem.name,
      description: catalogItem.description,
      channel: "EMAIL",
      subject: catalogItem.defaultSubject,
      bodyTemplate: catalogItem.defaultBody,
      variables: catalogItem.allowedPlaceholders,
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
