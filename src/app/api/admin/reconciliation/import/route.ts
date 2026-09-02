import { NextResponse } from "next/server";
import { processBankStatementImport } from "@/lib/reconciliation/service";
import { requirePermission } from "@/lib/auth/authorize";

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("banking.reconcile");
    const body = await req.json();
    const { bankAccountId, fileName, fileContent } = body;

    if (!bankAccountId || !fileName || !fileContent) {
      return NextResponse.json({ error: "Missing required fields: bankAccountId, fileName, fileContent." }, { status: 400 });
    }

    const statementImport = await processBankStatementImport({
      bankAccountId,
      fileName,
      fileContent,
      createdById: actor.id,
    });

    return NextResponse.json({
      success: true,
      importId: statementImport.id,
      importNumber: statementImport.importNumber,
      validRowCount: statementImport.validRowCount,
      invalidRowCount: statementImport.invalidRowCount,
      status: statementImport.status,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to process statement import";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
