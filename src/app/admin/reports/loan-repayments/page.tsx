import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getLoanRepaymentReport } from "@/lib/reports/transaction-reports";
import { LoanRepaymentsReportClient } from "./loan-repayments-report-client";

type SearchParams = Promise<{
  branchId?: string;
  loanId?: string;
  memberId?: string;
  status?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminLoanRepaymentsReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getLoanRepaymentReport({
    branchId: sp.branchId,
    loanId: sp.loanId,
    memberId: sp.memberId,
    status: sp.status,
    currency: sp.currency,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <LoanRepaymentsReportClient initialData={reportData} selectors={selectors} />;
}
