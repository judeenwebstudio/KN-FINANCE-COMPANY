"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getAccountBalancesReport } from "@/lib/reports/account-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getAccountBalancesReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function AccountBalancesClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [accountType, setAccountType] = useState(data.filters.accountType || "ALL");
  const [currency, setCurrency] = useState(data.filters.currency || "ALL");
  const [status, setStatus] = useState(data.filters.status || "ALL");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (accountType && accountType !== "ALL") params.set("accountType", accountType);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (status && status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/account-balances?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Account Number",
      "Member Number",
      "Member Name",
      "Branch",
      "Account Type",
      "Currency",
      "Status",
      "Current Balance",
    ];

    const rows = data.rows.map((r) => [
      r.accountNumber,
      r.memberNumber,
      r.memberName,
      r.branchName,
      r.accountType,
      r.currency,
      r.status,
      r.currentBalance,
    ]);

    const res = generateCSVResponse(headers, rows, "Member_Account_Balances_Report");
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
              <CreditCard className="size-6 text-indigo-600" /> Account Balances Report
            </h1>
            <p className="text-sm text-slate-500">
              Authoritative member account current balances grouped strictly by ISO currency code.
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

      {/* Summary Cards Grouped by ISO Currency */}
      <div className="grid gap-4 sm:grid-cols-3">
        {data.summaries.map((s) => (
          <div key={s.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {s.currency} Total Member Balance
            </div>
            <div className="text-2xl font-extrabold text-emerald-800 mt-1">
              {formatMoney(s.totalBalance, s.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{s.count} accounts</div>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Types</option>
              <option value="SAVINGS">SAVINGS</option>
              <option value="CHECKING">CHECKING</option>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="FROZEN">FROZEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Account #, member..."
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
              <th className="px-5 py-3.5">Account Number</th>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Current Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No accounts matching report criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.accountNumber}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{r.memberName}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.memberNumber}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-700">{r.branchName}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-800">{r.accountType}</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.status === "ACTIVE" ? "success" : r.status === "FROZEN" ? "warning" : "danger"}>
                      {r.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-emerald-800 whitespace-nowrap">
                    {formatMoney(r.currentBalance, r.currency)}
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
