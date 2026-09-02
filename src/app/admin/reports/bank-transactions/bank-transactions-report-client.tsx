"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Download, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getBankTransactionReport } from "@/lib/reports/bank-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getBankTransactionReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function BankTransactionsReportClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [bankAccountId, setBankAccountId] = useState(data.filters.bankAccountId || "ALL");
  const [type, setType] = useState(data.filters.type || "ALL");
  const [direction] = useState(data.filters.direction || "ALL");
  const [reconciliationStatus, setReconciliationStatus] = useState(data.filters.reconciliationStatus || "ALL");
  const [currency] = useState(data.filters.currency || "ALL");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");
  const [search, setSearch] = useState(data.filters.search || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (bankAccountId && bankAccountId !== "ALL") params.set("bankAccountId", bankAccountId);
    if (type && type !== "ALL") params.set("type", type);
    if (direction && direction !== "ALL") params.set("direction", direction);
    if (reconciliationStatus && reconciliationStatus !== "ALL") params.set("reconciliationStatus", reconciliationStatus);
    if (currency && currency !== "ALL") params.set("currency", currency);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search.trim()) params.set("search", search.trim());
    router.push(`/admin/reports/bank-transactions?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Tx Number",
      "Date",
      "Bank Account Display Name",
      "Bank Name",
      "Masked Account Number",
      "Branch",
      "Currency",
      "Type",
      "Direction",
      "Debit",
      "Credit",
      "Balance Before",
      "Balance After",
      "Reconciliation Status",
      "Reference",
      "Recorded By",
    ];

    const rows = data.rows.map((r) => [
      r.transactionNumber,
      new Date(r.date).toLocaleDateString(),
      r.accountName,
      r.bankName,
      r.maskedAccountNumber,
      r.branchName,
      r.currency,
      r.type,
      r.direction,
      r.debit || "",
      r.credit || "",
      r.balanceBefore,
      r.balanceAfter,
      r.reconciliationStatus,
      r.reference || "",
      r.createdByName || "",
    ]);

    const res = generateCSVResponse(headers, rows, "Bank_Transactions_Report");
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
              <ArrowLeftRight className="size-6 text-indigo-600" /> Bank Transactions Report
            </h1>
            <p className="text-sm text-slate-500">
              Company operational bank subledger transaction statement with reconciliation metadata indicators.
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Bank Accounts</option>
              {selectors.bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.bankName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tx Type</label>
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
              <option value="EXPENSE">EXPENSE</option>
              <option value="OPENING_BALANCE">OPENING_BALANCE</option>
              <option value="REVERSAL">REVERSAL</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reconciliation</label>
            <select
              value={reconciliationStatus}
              onChange={(e) => setReconciliationStatus(e.target.value as "ALL" | "UNRECONCILED" | "RECONCILED")}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNRECONCILED">UNRECONCILED</option>
              <option value="RECONCILED">RECONCILED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tx #, reference..."
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
              <th className="px-5 py-3.5">Tx Number</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Bank Account</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5 text-right">Debit</th>
              <th className="px-5 py-3.5 text-right">Credit</th>
              <th className="px-5 py-3.5 text-right">Bal. Before</th>
              <th className="px-5 py-3.5 text-right">Bal. After</th>
              <th className="px-5 py-3.5">Reconciliation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                  No bank transactions matching criteria.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.transactionNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{r.accountName}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-800">{r.type}</td>
                  <td className="px-5 py-4 text-right font-bold text-rose-700 whitespace-nowrap">
                    {r.debit ? formatMoney(r.debit, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                    {r.credit ? formatMoney(r.credit, r.currency) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                    {formatMoney(r.balanceBefore, r.currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                    {formatMoney(r.balanceAfter, r.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={r.reconciliationStatus === "RECONCILED" ? "success" : "neutral"}>
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
