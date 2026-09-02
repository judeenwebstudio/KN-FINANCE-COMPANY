import { requirePermission } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  await requirePermission("audit.view");

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const safeLogs = logs.map((l) => ({
    id: l.id,
    actor: { id: l.actor.id, name: l.actor.name, email: l.actor.email },
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    branchId: l.branchId,
    metadataJson: l.metadataJson,
    createdAt: l.createdAt.toISOString(),
  }));

  return <AuditLogClient initialLogs={safeLogs} />;
}
