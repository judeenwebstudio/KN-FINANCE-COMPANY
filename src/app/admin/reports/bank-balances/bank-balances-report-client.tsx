"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getBankBalancesReport } from "@/lib/reports/bank-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getBankBalancesReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function BankBalancesReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [status, setStatus] = useState(data.filters.status || "ALL");
  const [currency, setCurrency] = useState(data.filters.currency || "ALL");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (status && status !== "ALL") params.set("status", status);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/bank-balances?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Account Display Name",
      "Bank Name",
      "Account Holder",
      "Masked Account Number",
      "Branch",
      "Currency",
      "Status",
      "Current Balance",
      "Reconciliation Status",
    ];

    const rows = data.rows.map((r) => [
      r.name,
      r.bankName,
      r.accountName,
      r.maskedAccountNumber,
      r.branchName,
      r.currency,
      r.status,
      r.currentBalance,
      r.reconciliationStatus,
    ]);

    const res = generateCSVResponse(headers, rows, "Bank_Balances_Report");
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
              <Building2 className="size-6 text-indigo-600" /> Bank Balances Report
            </h1>
            <p className="text-sm text-slate-500">
              Authoritative company bank accounts with masked numbers and current liquidity balances.
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
              {s.currency} Total Bank Liquidity
            </div>
            <div className="text-2xl font-extrabold text-blue-900 mt-1">
              {formatMoney(s.totalBalance, s.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{s.count} bank accounts</div>
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
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="CLOSED">CLOSED</option>
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
                placeholder="Account name, bank..."
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
              <th className="px-5 py-3.5">Account Name</th>
              <th className="px-5 py-3.5">Bank Name</th>
              <th className="px-5 py-3.5">Account Number</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Current Balance</th>
              <th className="px-5 py-3.5">Subledger Check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No bank accounts matching criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-bold text-slate-900">{r.name}</td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-700">{r.bankName}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-800">{r.maskedAccountNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-600">{r.branchName}</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.status === "ACTIVE" ? "success" : "warning"}>
                      {r.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-blue-900 whitespace-nowrap">
                    {formatMoney(r.currentBalance, r.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.reconciliationStatus === "RECONCILED" ? "success" : "danger"}>
                      {r.reconciliationStatus}
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
