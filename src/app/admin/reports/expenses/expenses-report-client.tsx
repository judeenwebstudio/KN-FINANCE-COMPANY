"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getExpenseReport } from "@/lib/reports/expense-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getExpenseReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function ExpensesReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [categoryId, setCategoryId] = useState(data.filters.categoryId || "ALL");
  const [sourceType, setSourceType] = useState(data.filters.sourceType || "ALL");
  const [currency] = useState(data.filters.currency || "ALL");
  const [status, setStatus] = useState(data.filters.status || "ALL");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (categoryId && categoryId !== "ALL") params.set("categoryId", categoryId);
    if (sourceType && sourceType !== "ALL") params.set("sourceType", sourceType);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (status && status !== "ALL") params.set("status", status);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/expenses?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Expense Number",
      "Date",
      "Branch",
      "Category",
      "Payment Source",
      "Source Account",
      "Currency",
      "Amount",
      "Status",
      "Reference",
      "Description",
      "Recorded By",
    ];

    const rows = data.rows.map((r) => [
      r.expenseNumber,
      new Date(r.expenseDate).toLocaleDateString(),
      r.branchName,
      r.categoryName,
      r.paymentSourceType,
      r.sourceAccountName,
      r.currency,
      r.amount,
      r.status,
      r.reference || "",
      r.description || "",
      r.createdByName || "",
    ]);

    const res = generateCSVResponse(headers, rows, "Operational_Expenses_Report");
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
              <DollarSign className="size-6 text-rose-600" /> Operational Expense Report
            </h1>
            <p className="text-sm text-slate-500">
              Operational expenses funded from Treasury Cash or Bank Accounts with business record and status breakdowns.
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
              {s.currency} Expense Business Totals
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Posted Expenses:</span>
              <span className="font-extrabold text-rose-700">{formatMoney(s.postedTotal, s.currency)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Reversed Expenses:</span>
              <span className="font-semibold text-slate-400">{formatMoney(s.reversedTotal, s.currency)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 font-bold">
              <span className="text-slate-700">Net Business Total:</span>
              <span className="text-rose-900">{formatMoney(s.netTotal, s.currency)}</span>
            </div>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Categories</option>
              {selectors.expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as "ALL" | "CASH" | "BANK")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Payment Sources</option>
              <option value="CASH">CASH (Treasury)</option>
              <option value="BANK">BANK ACCOUNT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ALL" | "POSTED" | "REVERSED")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Expense #, ref..."
                className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-8 text-xs focus:outline-none"
              />
              <Search className="absolute right-2.5 top-3 size-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-xs"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-xs"
          />
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
              <th className="px-5 py-3.5">Expense #</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Source</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No operational expenses matching criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.expenseNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.expenseDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-700">{r.branchName}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{r.categoryName}</td>
                  <td className="px-5 py-4 text-xs">
                    <span className="font-semibold text-slate-800">{r.paymentSourceType}:</span> {r.sourceAccountName}
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-rose-700 whitespace-nowrap">
                    {formatMoney(r.amount, r.currency)}
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
