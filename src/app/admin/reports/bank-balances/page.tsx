import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getBankBalancesReport } from "@/lib/reports/bank-reports";
import { BankBalancesReportClient } from "./bank-balances-report-client";

type SearchParams = Promise<{
  branchId?: string;
  status?: string;
  currency?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminBankBalancesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getBankBalancesReport({
    branchId: sp.branchId,
    status: sp.status,
    currency: sp.currency,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <BankBalancesReportClient initialData={reportData} selectors={selectors} />;
}
