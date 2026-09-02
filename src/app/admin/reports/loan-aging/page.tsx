import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getLoanAgingReport } from "@/lib/reports/loan-reports";
import { LoanAgingReportClient } from "./loan-aging-report-client";

type SearchParams = Promise<{
  branchId?: string;
  currency?: string;
  agingBucket?: "ALL" | "1-30" | "31-60" | "61-90" | "90+";
  search?: string;
  page?: string;
}>;

export default async function AdminLoanAgingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getLoanAgingReport({
    branchId: sp.branchId,
    currency: sp.currency,
    agingBucket: sp.agingBucket,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <LoanAgingReportClient initialData={reportData} selectors={selectors} />;
}
