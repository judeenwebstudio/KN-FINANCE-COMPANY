import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getAccountStatementReport } from "@/lib/reports/account-reports";
import { AccountStatementClient } from "./account-statement-client";

type SearchParams = Promise<{
  branchId?: string;
  memberId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
}>;

export default async function AdminAccountStatementReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getAccountStatementReport({
    branchId: sp.branchId,
    memberId: sp.memberId,
    accountId: sp.accountId || selectors.accounts[0]?.id,
    startDate: sp.startDate,
    endDate: sp.endDate,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <AccountStatementClient initialData={reportData} selectors={selectors} />;
}
