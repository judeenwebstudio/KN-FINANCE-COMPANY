import { NextResponse } from "next/server";
import { executeUnmatch } from "@/lib/reconciliation/service";
import { requirePermission } from "@/lib/auth/authorize";

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("banking.reconcile");
    const body = await req.json();
    const { matchId, unmatchReason } = body;

    if (!matchId || !unmatchReason) {
      return NextResponse.json({ error: "Missing matchId or unmatchReason" }, { status: 400 });
    }

    const result = await executeUnmatch({ matchId, unmatchReason, actorId: actor.id });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unmatch failed";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
