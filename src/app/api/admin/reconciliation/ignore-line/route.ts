import { NextResponse } from "next/server";
import { executeIgnoreLine, executeUnignoreLine } from "@/lib/reconciliation/service";
import { requirePermission } from "@/lib/auth/authorize";

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("banking.reconcile");
    const body = await req.json();
    const { statementLineId, action, ignoreReason } = body;

    if (!statementLineId || !action) {
      return NextResponse.json({ error: "Missing statementLineId or action" }, { status: 400 });
    }

    if (action === "IGNORE") {
      if (!ignoreReason) {
        return NextResponse.json({ error: "Missing ignoreReason" }, { status: 400 });
      }
      const updated = await executeIgnoreLine({ statementLineId, ignoreReason, actorId: actor.id });
      return NextResponse.json({ success: true, line: updated });
    } else if (action === "UNIGNORE") {
      const updated = await executeUnignoreLine(statementLineId, actor.id);
      return NextResponse.json({ success: true, line: updated });
    } else {
      return NextResponse.json({ error: "Invalid action. Use IGNORE or UNIGNORE." }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Ignore line operation failed";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
