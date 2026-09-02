"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { generateCSVResponse } from "@/lib/reports/export";
import type { getAccountStatementReport } from "@/lib/reports/account-reports";
import type { getBranchScopedSelectors } from "@/lib/reports/filters";

type ReportData = Awaited<ReturnType<typeof getAccountStatementReport>>;
type SelectorsData = Awaited<ReturnType<typeof getBranchScopedSelectors>>;

type Props = {
  initialData: ReportData;
  selectors: SelectorsData;
};

export function AccountStatementClient({ initialData, selectors }: Props) {
  const router = useRouter();
  const [data] = useState<ReportData>(initialData);

  const [branchId, setBranchId] = useState(data.filters.branchId || "ALL");
  const [accountId, setAccountId] = useState(data.filters.accountId || selectors.accounts[0]?.id || "");
  const [startDate, setStartDate] = useState(data.filters.startDate || "");
  const [endDate, setEndDate] = useState(data.filters.endDate || "");

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (branchId && branchId !== "ALL") params.set("branchId", branchId);
    if (accountId) params.set("accountId", accountId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    router.push(`/admin/reports/account-statement?${params.toString()}`);
  }

  function exportCSV() {
    const headers = [
      "Date",
      "Tx Reference",
      "Type",
      "Category",
      "Direction",
      "Debit",
      "Credit",
      "Balance Before",
      "Balance After",
      "Recorded By",
    ];

    const rows = data.rows.map((r) => [
      new Date(r.transactionDate).toLocaleDateString(),
      r.transactionNumber,
      r.type,
      r.categoryName || "",
      r.direction,
      r.debit || "",
      r.credit || "",
      r.balanceBefore || "",
      r.balanceAfter || "",
      r.createdByName || "",
    ]);

    const res = generateCSVResponse(headers, rows, `Account_Statement_${data.account?.accountNumber || "export"}`);
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
              <FileText className="size-6 text-indigo-600" /> Account Statement
            </h1>
            <p className="text-sm text-slate-500">
              Detailed member account transaction statement with verified opening & period closing balances.
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
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              <option value="ALL">All Accessible Branches</option>
              {selectors.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Member Account *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
            >
              {selectors.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} ({a.accountType} — {a.currency})
                </option>
              ))}
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
            Generate Statement
          </Button>
        </div>
      </form>

      {/* Account Info & Summary Banner */}
      {data.account ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="text-xl font-extrabold text-slate-900">{data.account.accountNumber}</div>
              <div className="text-xs text-slate-500">
                Holder: {data.account.memberName} ({data.account.memberNumber}) — Branch: {data.account.branchName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-400 uppercase">Current Account Balance</div>
              <div className="text-2xl font-extrabold text-emerald-800">{formatMoney(data.account.currentBalance, data.currency)}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase">Opening Balance</div>
              <div className="text-lg font-bold text-slate-800">
                {data.openingBalance != null ? formatMoney(data.openingBalance, data.currency) : "Unavailable"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{data.openingBalanceStatus}</div>
            </div>

            <div className="rounded-xl bg-emerald-50/60 p-4">
              <div className="text-xs font-semibold text-emerald-700 uppercase">Period Credits (+)</div>
              <div className="text-lg font-extrabold text-emerald-900">{formatMoney(data.periodTotalCredit, data.currency)}</div>
            </div>

            <div className="rounded-xl bg-rose-50/60 p-4">
              <div className="text-xs font-semibold text-rose-700 uppercase">Period Debits (-)</div>
              <div className="text-lg font-extrabold text-rose-900">{formatMoney(data.periodTotalDebit, data.currency)}</div>
            </div>

            <div className="rounded-xl bg-indigo-50/60 p-4">
              <div className="text-xs font-semibold text-indigo-700 uppercase">Period Closing Balance</div>
              <div className="text-lg font-extrabold text-indigo-900">
                {data.closingBalance != null ? formatMoney(data.closingBalance, data.currency) : "Unavailable"}
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Tx Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Bal. Before</th>
                  <th className="px-4 py-3 text-right">Bal. After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(r.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{r.transactionNumber}</td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-800">{r.type}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700 whitespace-nowrap">
                        {r.debit ? formatMoney(r.debit, data.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {r.credit ? formatMoney(r.credit, data.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                        {r.balanceBefore ? formatMoney(r.balanceBefore, data.currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {r.balanceAfter ? formatMoney(r.balanceAfter, data.currency) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          Please select a valid member account to generate an Account Statement.
        </div>
      )}
    </div>
  );
}
