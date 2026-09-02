"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getLoanRepaymentReport } from "@/lib/reports/transaction-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getLoanRepaymentReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function LoanRepaymentsReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [status, setStatus] = useState(data.filters.status || "ALL");
  const [currency, setCurrency] = useState(data.filters.currency || "ALL");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (status && status !== "ALL") params.set("status", status);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/loan-repayments?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Repayment Number",
      "Date",
      "Loan Number",
      "Member Number",
      "Member Name",
      "Branch",
      "Account Number",
      "Currency",
      "Total Amount",
      "Penalty Paid",
      "Fee Paid",
      "Interest Paid",
      "Principal Paid",
      "Status",
      "Recorded By",
    ];

    const rows = data.rows.map((r) => [
      r.repaymentNumber,
      new Date(r.paymentDate).toLocaleDateString(),
      r.loanNumber,
      r.memberNumber,
      r.memberName,
      r.branchName,
      r.accountNumber,
      r.currency,
      r.totalAmount,
      r.penalty,
      r.fee,
      r.interest,
      r.principal,
      r.status,
      r.createdByName || "",
    ]);

    const res = generateCSVResponse(headers, rows, "Loan_Repayments_Report");
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
              <Receipt className="size-6 text-indigo-600" /> Loan Repayments Report
            </h1>
            <p className="text-sm text-slate-500">
              Repayment collection breakdown (Principal, Interest, Fee, Penalty) from LoanRepaymentAllocation subledger.
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

      {/* Summaries by Currency */}
      <div className="grid gap-4 sm:grid-cols-3">
        {data.summaries.map((s) => (
          <div key={s.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {s.currency} Repayments Collected
            </div>
            <div className="text-2xl font-extrabold text-emerald-800 mt-1">
              {formatMoney(s.totalAmount, s.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{s.count} repayment records</div>
          </div>
        ))}
      </div>

      {/* Filter Form */}
      <form onSubmit={handleFilter} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-5">
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
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

        <div className="flex justify-end gap-2 pt-1">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Repayment #, loan..."
              className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-8 text-xs focus:outline-none"
            />
            <Search className="absolute right-2.5 top-3 size-4 text-slate-400" />
          </div>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 font-semibold">
            Apply Filters
          </Button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Repayment #</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Loan Number</th>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5 text-right">Penalty</th>
              <th className="px-5 py-3.5 text-right">Fee</th>
              <th className="px-5 py-3.5 text-right">Interest</th>
              <th className="px-5 py-3.5 text-right">Principal</th>
              <th className="px-5 py-3.5 text-right">Total</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                  No loan repayments matching criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.repaymentNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{r.loanNumber}</td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-800">{r.memberName}</td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-700 whitespace-nowrap">
                    {formatMoney(r.penalty, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                    {formatMoney(r.fee, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-indigo-700 whitespace-nowrap">
                    {formatMoney(r.interest, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {formatMoney(r.principal, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-emerald-800 whitespace-nowrap">
                    {formatMoney(r.totalAmount, r.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.status === "POSTED" ? "success" : "danger"}>
                      {r.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
