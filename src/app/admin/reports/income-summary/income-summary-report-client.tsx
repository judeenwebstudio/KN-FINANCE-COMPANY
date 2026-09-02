"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, Download, Printer, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getIncomeSummaryReport } from "@/lib/reports/income-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getIncomeSummaryReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function IncomeSummaryReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [currency, setCurrency] = useState(data.filters.currency || "ALL");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    router.push(`/admin/reports/income-summary?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Currency",
      "Interest Collections",
      "Interest Reversals",
      "Net Interest Income",
      "Fee Collections",
      "Fee Reversals",
      "Net Fee Income",
      "Penalty Collections",
      "Penalty Reversals",
      "Net Penalty Income",
      "Total Operating Income",
      "Operating Expense Debits",
      "Operating Expense Reversals",
      "Net Operating Expenses",
      "Net Operational Income",
    ];

    const rows = data.summaries.map((s) => [
      s.currency,
      s.interestCollections,
      s.interestReversals,
      s.netInterest,
      s.feeCollections,
      s.feeReversals,
      s.netFees,
      s.penaltyCollections,
      s.penaltyReversals,
      s.netPenalties,
      s.totalOperatingIncome,
      s.expenseDebits,
      s.expenseReversals,
      s.netOperatingExpenses,
      s.netOperationalIncome,
    ]);

    const res = generateCSVResponse(headers, rows, "Revenue_Income_Summary_Report");
    if (res.error) {
      alert(res.error);
      return;
    }

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + res.csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", res.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reports">
              <ArrowLeft className="mr-1 size-4" /> Back to Reports
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingUp className="size-6 text-emerald-600" /> Revenue & Income Summary
            </h1>
            <p className="text-sm text-slate-500">
              Operational Income & Expense Summary derived from collected repayment allocations less ledger operating expenses.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" className="shadow-xs">
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="shadow-xs">
            <Printer className="mr-2 size-4" /> Print
          </Button>
        </div>
      </div>

      {/* Non-Statutory Disclaimer Alert */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
        <AlertCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Operational Income Statement Notice</div>
          <div className="mt-0.5 leading-relaxed text-blue-800">
            This report represents actual operational cash collections (Paid Interest + Fees + Penalties) less subledger operating expenses.
            Principal repayments/disbursements, member deposits/withdrawals, and internal transfers are strictly excluded.
          </div>
        </div>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleFilter} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Branches</option>
              {selectors.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Currencies</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="INR">INR</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 font-semibold">
            Apply Filters
          </Button>
        </div>
      </form>

      {/* Income Cards per Currency */}
      <div className="space-y-6">
        {data.summaries.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            No income or expense records found for the selected parameters.
          </div>
        ) : (
          data.summaries.map((s) => (
            <div key={s.currency} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Financial Performance — <span className="text-indigo-600 font-mono">{s.currency}</span>
                </h2>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-400 uppercase mr-2">Net Operational Income:</span>
                  <span className={`text-xl font-extrabold ${Number(s.netOperationalIncome) >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
                    {formatMoney(s.netOperationalIncome, s.currency)}
                  </span>
                </div>
              </div>

              {/* Collections & Income Grid */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Interest Income</div>
                  <div className="text-lg font-bold text-slate-900">{formatMoney(s.netInterest, s.currency)}</div>
                  <div className="text-[11px] text-slate-400">
                    Collected: {formatMoney(s.interestCollections, s.currency)} | Rev: {formatMoney(s.interestReversals, s.currency)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Fee Income</div>
                  <div className="text-lg font-bold text-slate-900">{formatMoney(s.netFees, s.currency)}</div>
                  <div className="text-[11px] text-slate-400">
                    Collected: {formatMoney(s.feeCollections, s.currency)} | Rev: {formatMoney(s.feeReversals, s.currency)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Penalty Income</div>
                  <div className="text-lg font-bold text-slate-900">{formatMoney(s.netPenalties, s.currency)}</div>
                  <div className="text-[11px] text-slate-400">
                    Collected: {formatMoney(s.penaltyCollections, s.currency)} | Rev: {formatMoney(s.penaltyReversals, s.currency)}
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50/60 p-4 space-y-1">
                  <div className="text-xs font-semibold text-emerald-800 uppercase">Total Operating Income</div>
                  <div className="text-xl font-extrabold text-emerald-900">{formatMoney(s.totalOperatingIncome, s.currency)}</div>
                  <div className="text-[11px] text-emerald-700">Gross Collected Revenue</div>
                </div>
              </div>

              {/* Operating Expenses Breakdown */}
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-800 uppercase">Operating Expenses</div>
                  <div className="text-[11px] text-rose-600 mt-0.5">
                    Subledger Debits: {formatMoney(s.expenseDebits, s.currency)} | Subledger Reversal Credits: {formatMoney(s.expenseReversals, s.currency)}
                  </div>
                </div>
                <div className="text-lg font-extrabold text-rose-900">
                  - {formatMoney(s.netOperatingExpenses, s.currency)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
