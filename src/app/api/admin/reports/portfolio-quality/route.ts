import { NextResponse } from "next/server";
import { getPortfolioQualityReport } from "@/lib/reports/portfolio-quality-reports";
import { assertBranchAccess, requirePermission } from "@/lib/auth/authorize";

export async function GET(req: Request) {
  try {
    const actor = await requirePermission("reports.portfolio_quality");
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || undefined;
    const productId = searchParams.get("productId") || undefined;
    const currency = searchParams.get("currency") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    if (branchId && branchId !== "ALL") await assertBranchAccess(actor.id, branchId);

    const report = await getPortfolioQualityReport({
      branchId,
      productId,
      currency,
      startDate,
      endDate,
    });

    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to generate Portfolio Quality Report";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
