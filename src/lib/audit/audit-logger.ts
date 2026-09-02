import { prisma } from "../prisma";

export type AuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  branchId?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY_PARTS = ["password", "secret", "token", "jwt", "credential"];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function sanitizeMetadata(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMetadata);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Creates an administrative AuditLog record.
 * Must be executed within a transaction client `tx` when called inside atomic mutations.
 */
export async function logAuditEvent(
  input: AuditLogInput,
  client: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma
) {
  const sanitizedMeta = input.metadata ? sanitizeMetadata(input.metadata) : null;
  const metadataJson = sanitizedMeta ? JSON.stringify(sanitizedMeta) : null;

  return await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      branchId: input.branchId || null,
      metadataJson,
    },
  });
}
