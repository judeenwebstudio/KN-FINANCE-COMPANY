import { NextResponse } from "next/server";
import { executeAutoMatch } from "@/lib/reconciliation/service";
import { requirePermission } from "@/lib/auth/authorize";

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("banking.reconcile");
    const body = await req.json();
    const { importId } = body;

    if (!importId) {
      return NextResponse.json({ error: "Missing importId" }, { status: 400 });
    }

    const result = await executeAutoMatch(importId, actor.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Auto-match execution failed";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
