import { getAccessibleBranchIds } from "@/lib/authz";
import { getBranchScopedSelectors } from "@/lib/reports/filters";
import { getBankTransactionReport } from "@/lib/reports/bank-reports";
import { BankTransactionsReportClient } from "./bank-transactions-report-client";

type SearchParams = Promise<{
  branchId?: string;
  bankAccountId?: string;
  type?: string;
  direction?: "ALL" | "CREDIT" | "DEBIT";
  reconciliationStatus?: "ALL" | "UNRECONCILED" | "RECONCILED";
  currency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
}>;

export default async function AdminBankTransactionsReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const branchIds = await getAccessibleBranchIds();
  const selectors = await getBranchScopedSelectors(branchIds);

  const reportData = await getBankTransactionReport({
    branchId: sp.branchId,
    bankAccountId: sp.bankAccountId,
    type: sp.type,
    direction: sp.direction,
    reconciliationStatus: sp.reconciliationStatus,
    currency: sp.currency,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return <BankTransactionsReportClient initialData={reportData} selectors={selectors} />;
}
