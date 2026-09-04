"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getLoanAgingReport } from "@/lib/reports/loan-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getLoanAgingReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function LoanAgingReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [currency, setCurrency] = useState(data.filters.currency || "ALL");
  const [agingBucket, setAgingBucket] = useState(data.filters.agingBucket || "ALL");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (agingBucket && agingBucket !== "ALL") params.set("agingBucket", agingBucket);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/loan-aging?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Loan Number",
      "Member Number",
      "Member Name",
      "Branch",
      "Currency",
      "Oldest Due Date",
      "Days Past Due",
      "Aging Bucket",
      "Overdue Principal",
      "Overdue Interest",
      "Overdue Fees",
      "Overdue Penalties",
      "Total Overdue",
      "Outstanding Balance",
    ];

    const rows = data.rows.map((r) => [
      r.loanNumber,
      r.memberNumber,
      r.memberName,
      r.branchName,
      r.currency,
      r.oldestDueDate ? new Date(r.oldestDueDate).toLocaleDateString() : "",
      r.daysPastDue,
      r.agingBucket,
      r.overduePrincipal,
      r.overdueInterest,
      r.overdueFees,
      r.overduePenalties,
      r.totalOverdue,
      r.outstandingBalance,
    ]);

    const res = generateCSVResponse(headers, rows, "Loan_Aging_Report");
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
              <Clock className="size-6 text-rose-600" /> Loan Aging & Delinquency Report
            </h1>
            <p className="text-sm text-slate-500">
              Active loan delinquent facilities classified by aging buckets (1-30, 31-60, 61-90, 90+ days past due).
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

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {data.summaries.map((s) => (
          <div key={s.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              {s.currency} Total Overdue Amount
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">
              {formatMoney(s.totalOverdue, s.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{s.count} delinquent loans</div>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Aging Bucket</label>
            <select
              value={agingBucket}
              onChange={(e) => setAgingBucket(e.target.value as "ALL" | "1-30" | "31-60" | "61-90" | "90+")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold"
            >
              <option value="ALL">All Aging Buckets</option>
              <option value="1-30">1-30 Days Past Due</option>
              <option value="31-60">31-60 Days Past Due</option>
              <option value="61-90">61-90 Days Past Due</option>
              <option value="90+">90+ Days Past Due</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="INR">INR (₹)</option>
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
              <th className="px-5 py-3.5">Days Past Due</th>
              <th className="px-5 py-3.5">Aging Bucket</th>
              <th className="px-5 py-3.5 text-right">Overdue Principal</th>
              <th className="px-5 py-3.5 text-right">Overdue Interest</th>
              <th className="px-5 py-3.5 text-right">Overdue Penalties</th>
              <th className="px-5 py-3.5 text-right">Total Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No delinquent loans matching criteria.
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
                  <td className="px-5 py-4 font-mono font-extrabold text-rose-700">{r.daysPastDue}d</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone="danger">{r.agingBucket} Days</StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {formatMoney(r.overduePrincipal, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {formatMoney(r.overdueInterest, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-700 whitespace-nowrap">
                    {formatMoney(r.overduePenalties, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-rose-800 whitespace-nowrap">
                    {formatMoney(r.totalOverdue, r.currency)}
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
