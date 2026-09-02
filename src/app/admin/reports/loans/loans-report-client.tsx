"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getLoanReport } from "@/lib/reports/loan-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getLoanReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function LoansReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [productId] = useState(data.filters.productId || "ALL");
  const [status, setStatus] = useState(data.filters.status || "ALL");
  const [currency] = useState(data.filters.currency || "ALL");
  const [dateField, setDateField] = useState(data.filters.dateField || "APPLICATION_DATE");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (productId && productId !== "ALL") params.set("productId", productId);
    if (status && status !== "ALL") params.set("status", status);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (dateField) params.set("dateField", dateField);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/loans?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Loan Number",
      "Member Number",
      "Member Name",
      "Branch",
      "Product",
      "Currency",
      "Applied Amount",
      "Approved Amount",
      "Disbursement Date",
      "Maturity Date",
      "Status",
      "Total Paid",
      "Outstanding Balance",
      "Days Past Due",
    ];

    const rows = data.rows.map((r) => [
      r.loanNumber,
      r.memberNumber,
      r.memberName,
      r.branchName,
      r.productName,
      r.currency,
      r.appliedAmount,
      r.approvedAmount,
      r.disbursementDate ? new Date(r.disbursementDate).toLocaleDateString() : "",
      r.maturityDate ? new Date(r.maturityDate).toLocaleDateString() : "",
      r.status,
      r.totalPaid,
      r.outstandingBalance,
      r.daysPastDue,
    ]);

    const res = generateCSVResponse(headers, rows, "Loan_Portfolio_Report");
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
              <Coins className="size-6 text-indigo-600" /> Loan Portfolio Report
            </h1>
            <p className="text-sm text-slate-500">
              Loan application, disbursement, maturity, and outstanding balances with explicit date field filtering.
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
          <div key={s.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {s.currency} Portfolio Totals
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Disbursed Principal:</span>
              <span className="font-bold text-slate-900">{formatMoney(s.totalDisbursed, s.currency)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
              <span className="text-slate-500">Current Outstanding:</span>
              <span className="font-extrabold text-indigo-700">{formatMoney(s.totalOutstanding, s.currency)}</span>
            </div>
          </div>
        ))}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date Filter Field</label>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as "APPLICATION_DATE" | "DISBURSEMENT_DATE" | "MATURITY_DATE")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold"
            >
              <option value="APPLICATION_DATE">Application Date (createdAt)</option>
              <option value="DISBURSEMENT_DATE">Disbursement Date (disbursementDate)</option>
              <option value="MATURITY_DATE">Maturity Date (maturityDate)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Loan #, member..."
                className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-8 text-xs focus:outline-none"
              />
              <Search className="absolute right-2.5 top-3 size-4 text-slate-400" />
            </div>
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Loan Number</th>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5">Product</th>
              <th className="px-5 py-3.5 text-right">Approved Amt</th>
              <th className="px-5 py-3.5 text-right">Total Paid</th>
              <th className="px-5 py-3.5 text-right">Outstanding</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No loans matching report criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.loanNumber}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{r.memberName}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.memberNumber}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-700">{r.productName}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatMoney(r.approvedAmount, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-emerald-700 whitespace-nowrap">
                    {formatMoney(r.totalPaid, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-indigo-700 whitespace-nowrap">
                    {formatMoney(r.outstandingBalance, r.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.status === "ACTIVE" ? "success" : r.status === "PENDING" ? "warning" : "neutral"}>
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
