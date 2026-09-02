"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getMemberTransactionReport } from "@/lib/reports/transaction-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getMemberTransactionReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function TransactionsReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [type, setType] = useState(data.filters.type || "ALL");
  const [direction, setDirection] = useState(data.filters.direction || "ALL");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (type && type !== "ALL") params.set("type", type);
    if (direction && direction !== "ALL") params.set("direction", direction);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/transactions?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Transaction Number",
      "Date",
      "Member Number",
      "Member Name",
      "Account Number",
      "Branch",
      "Type",
      "Category",
      "Currency",
      "Direction",
      "Debit",
      "Credit",
      "Balance Before",
      "Balance After",
      "Status",
      "Recorded By",
    ];

    const rows = data.rows.map((r) => [
      r.transactionNumber,
      new Date(r.date).toLocaleDateString(),
      r.memberNumber,
      r.memberName,
      r.accountNumber,
      r.branchName,
      r.type,
      r.categoryName || "",
      r.currency,
      r.direction,
      r.debit || "",
      r.credit || "",
      r.balanceBefore || "",
      r.balanceAfter || "",
      r.status,
      r.createdByName || "",
    ]);

    const res = generateCSVResponse(headers, rows, "Member_Transactions_Report");
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
              <ArrowLeftRight className="size-6 text-indigo-600" /> Member Transaction Report
            </h1>
            <p className="text-sm text-slate-500">
              Authoritative unified member transaction ledger statement with explicit direction mapping.
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="TRANSFER_IN">TRANSFER_IN</option>
              <option value="TRANSFER_OUT">TRANSFER_OUT</option>
              <option value="LOAN_DISBURSEMENT">LOAN_DISBURSEMENT</option>
              <option value="LOAN_REPAYMENT">LOAN_REPAYMENT</option>
              <option value="FEE">FEE</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="OPENING_BALANCE">OPENING_BALANCE</option>
              <option value="DEPOSIT_REVERSAL">DEPOSIT_REVERSAL</option>
              <option value="WITHDRAWAL_REVERSAL">WITHDRAWAL_REVERSAL</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "ALL" | "CREDIT" | "DEBIT")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Directions</option>
              <option value="CREDIT">CREDIT (+)</option>
              <option value="DEBIT">DEBIT (-)</option>
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
              placeholder="Tx #, ref..."
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
              <th className="px-5 py-3.5">Tx Number</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5 text-right">Debit</th>
              <th className="px-5 py-3.5 text-right">Credit</th>
              <th className="px-5 py-3.5 text-right">Bal Before</th>
              <th className="px-5 py-3.5 text-right">Bal After</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                  No member transactions matching criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.transactionNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{r.memberName}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.memberNumber}</div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-xs text-slate-800">{r.type}</td>
                  <td className="px-5 py-4 text-right font-bold text-rose-700 whitespace-nowrap">
                    {r.debit ? formatMoney(r.debit, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                    {r.credit ? formatMoney(r.credit, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                    {r.balanceBefore ? formatMoney(r.balanceBefore, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                    {r.balanceAfter ? formatMoney(r.balanceAfter, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.status === "COMPLETED" ? "success" : "neutral"}>
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
