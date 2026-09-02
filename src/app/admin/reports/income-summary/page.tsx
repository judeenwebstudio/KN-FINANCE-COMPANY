import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getIncomeSummaryReport } from "@/lib/reports/income-reports";
import { IncomeSummaryReportClient } from "./income-summary-report-client";

type SearchParams = Promise<{
  branchId?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
}>;

export default async function AdminIncomeSummaryReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getIncomeSummaryReport({
    branchId: sp.branchId,
    currency: sp.currency,
    startDate: sp.startDate,
    endDate: sp.endDate,
  });

  return <IncomeSummaryReportClient initialData={reportData} selectors={selectors} />;
}
