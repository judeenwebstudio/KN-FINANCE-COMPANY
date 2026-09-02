import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getExpenseReport } from "@/lib/reports/expense-reports";
import { ExpensesReportClient } from "./expenses-report-client";

type SearchParams = Promise<{
  branchId?: string;
  categoryId?: string;
  sourceType?: "ALL" | "CASH" | "BANK";
  sourceAccountId?: string;
  currency?: string;
  status?: "ALL" | "POSTED" | "REVERSED";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminExpensesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getExpenseReport({
    branchId: sp.branchId,
    categoryId: sp.categoryId,
    sourceType: sp.sourceType,
    sourceAccountId: sp.sourceAccountId,
    currency: sp.currency,
    status: sp.status,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <ExpensesReportClient initialData={reportData} selectors={selectors} />;
}
