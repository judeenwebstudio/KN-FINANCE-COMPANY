import { NextResponse } from "next/server";
import { executeManualMatch } from "@/lib/reconciliation/service";
import { requirePermission } from "@/lib/auth/authorize";

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("banking.reconcile");
    const body = await req.json();
    const { statementLineId, bankTransactionId } = body;

    if (!statementLineId || !bankTransactionId) {
      return NextResponse.json({ error: "Missing statementLineId or bankTransactionId" }, { status: 400 });
    }

    const matchRecord = await executeManualMatch({ statementLineId, bankTransactionId, actorId: actor.id });
    return NextResponse.json({ success: true, matchRecord });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Manual match failed";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
