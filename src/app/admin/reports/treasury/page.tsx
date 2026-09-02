import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getTreasuryReport } from "@/lib/reports/treasury-reports";
import { TreasuryReportClient } from "./treasury-report-client";

type SearchParams = Promise<{
  branchId?: string;
  treasuryAccountId?: string;
  type?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminTreasuryReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getTreasuryReport({
    branchId: sp.branchId,
    treasuryAccountId: sp.treasuryAccountId,
    type: sp.type,
    direction: sp.direction,
    currency: sp.currency,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <TreasuryReportClient initialData={reportData} selectors={selectors} />;
}
