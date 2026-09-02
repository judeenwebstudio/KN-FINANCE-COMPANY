import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getLoanReport } from "@/lib/reports/loan-reports";
import { LoansReportClient } from "./loans-report-client";

type SearchParams = Promise<{
  branchId?: string;
  productId?: string;
  status?: string;
  currency?: string;
  dateField?: "APPLICATION_DATE" | "DISBURSEMENT_DATE" | "MATURITY_DATE";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminLoansReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getLoanReport({
    branchId: sp.branchId,
    productId: sp.productId,
    status: sp.status,
    currency: sp.currency,
    dateField: sp.dateField,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <LoansReportClient initialData={reportData} selectors={selectors} />;
}
