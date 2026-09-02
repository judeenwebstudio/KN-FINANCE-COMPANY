import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getMemberTransactionReport } from "@/lib/reports/transaction-reports";
import { TransactionsReportClient } from "./transactions-report-client";

type SearchParams = Promise<{
  branchId?: string;
  memberId?: string;
  accountId?: string;
  type?: string;
  categoryId?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminTransactionsReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getMemberTransactionReport({
    branchId: sp.branchId,
    memberId: sp.memberId,
    accountId: sp.accountId,
    type: sp.type,
    categoryId: sp.categoryId,
    direction: sp.direction,
    currency: sp.currency,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <TransactionsReportClient initialData={reportData} selectors={selectors} />;
}
