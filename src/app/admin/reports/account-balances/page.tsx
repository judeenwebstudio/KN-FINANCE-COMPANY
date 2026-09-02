import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getAccountBalancesReport } from "@/lib/reports/account-reports";
import { AccountBalancesClient } from "./account-balances-client";

type SearchParams = Promise<{
  branchId?: string;
  accountType?: string;
  currency?: string;
  status?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminAccountBalancesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getAccountBalancesReport({
    branchId: sp.branchId,
    accountType: sp.accountType,
    currency: sp.currency,
    status: sp.status,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <AccountBalancesClient initialData={reportData} selectors={selectors} />;
}
