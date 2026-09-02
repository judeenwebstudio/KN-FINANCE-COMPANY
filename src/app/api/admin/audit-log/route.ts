import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requirePermission("audit.view");

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") || "";
    const action = searchParams.get("action") || "";
    const entityType = searchParams.get("entityType") || "";

    const logs = await prisma.auditLog.findMany({
      where: {
        AND: [
          actorId ? { actorUserId: actorId } : {},
          action ? { action: { contains: action, mode: "insensitive" } } : {},
          entityType ? { entityType } : {},
        ],
      },
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

    return NextResponse.json({ logs: safeLogs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch audit logs.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
