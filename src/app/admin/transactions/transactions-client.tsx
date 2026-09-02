"use client";

import { useState } from "react";
import { ArrowLeftRight, Search, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { reverseFinancialTransactionAction } from "@/lib/accounts/cash-operations";
import type { TransactionDTO } from "@/lib/serializers";

type TransactionsClientProps = {
  transactions: TransactionDTO[];
};

export function AdminTransactionsClient({ transactions: initialList }: TransactionsClientProps) {
  const [txList, setTxList] = useState<TransactionDTO[]>(initialList);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [reversalModalId, setReversalModalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = txList.filter((t) => {
    const matchesType = typeFilter === "ALL" || t.type === typeFilter;

    const q = search.toLowerCase();
    const matchesSearch =
      t.reference.toLowerCase().includes(q) ||
      (t.memberName && t.memberName.toLowerCase().includes(q)) ||
      (t.accountNumber && t.accountNumber.toLowerCase().includes(q)) ||
      (t.branchName && t.branchName.toLowerCase().includes(q)) ||
      t.type.toLowerCase().includes(q);

    return matchesType && matchesSearch;
  });

  async function handleReverseTransaction() {
    if (!reversalModalId || !reversalReason.trim()) return;
    setLoading(true);
    setError(null);

    const res = await reverseFinancialTransactionAction(reversalModalId, reversalReason);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const revTxDto: TransactionDTO = {
        ...res.data.reversalTransaction,
        amount: res.data.reversalTransaction.amount.toString(),
        balanceBefore: res.data.reversalTransaction.balanceBefore ? res.data.reversalTransaction.balanceBefore.toString() : null,
        balanceAfter: res.data.reversalTransaction.balanceAfter ? res.data.reversalTransaction.balanceAfter.toString() : null,
        reversedAt: res.data.reversalTransaction.reversedAt ? res.data.reversalTransaction.reversedAt.toISOString() : null,
        createdAt: res.data.reversalTransaction.createdAt.toISOString(),
      };
      const origTxDto: TransactionDTO = {
        ...res.data.originalTransaction,
        amount: res.data.originalTransaction.amount.toString(),
        balanceBefore: res.data.originalTransaction.balanceBefore ? res.data.originalTransaction.balanceBefore.toString() : null,
        balanceAfter: res.data.originalTransaction.balanceAfter ? res.data.originalTransaction.balanceAfter.toString() : null,
        reversedAt: res.data.originalTransaction.reversedAt ? res.data.originalTransaction.reversedAt.toISOString() : null,
        createdAt: res.data.originalTransaction.createdAt.toISOString(),
      };
      setTxList((prev) => [
        revTxDto,
        ...prev.map((item) => (item.id === reversalModalId ? origTxDto : item)),
      ]);
      setReversalModalId(null);
      setReversalReason("");
    }
  }

  function exportCSV() {
    const headers = [
      "Reference",
      "Date",
      "Member Name",
      "Member Number",
      "Account Number",
      "Branch",
      "Transaction Type",
      "Category",
      "Amount",
      "Currency",
      "Balance Before",
      "Balance After",
      "Status",
      "Recorded By",
    ];

    const csvRows = filtered.map((t) => [
      t.reference,
      new Date(t.createdAt).toLocaleDateString(),
      `"${t.memberName || ""}"`,
      t.memberNumber || "",
      t.accountNumber || "",
      `"${t.branchName || ""}"`,
      t.type,
      `"${t.categoryName || ""}"`,
      t.amount,
      t.currency,
      t.balanceBefore || "",
      t.balanceAfter || "",
      t.status,
      `"${t.createdByName || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KNFinance_Unified_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-indigo-600" /> Unified Transaction Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Authoritative unified financial ledger for deposits, withdrawals, loan disbursements, repayments, and adjustments.
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="shadow-xs">
          <Download className="mr-2 size-4" /> Export Ledger (CSV)
        </Button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, member name, account #, or type..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="WITHDRAWAL">WITHDRAWAL</option>
            <option value="OPENING_BALANCE">OPENING_BALANCE</option>
            <option value="LOAN_DISBURSEMENT">LOAN_DISBURSEMENT</option>
            <option value="LOAN_REPAYMENT">LOAN_REPAYMENT</option>
            <option value="DEPOSIT_REVERSAL">DEPOSIT_REVERSAL</option>
            <option value="WITHDRAWAL_REVERSAL">WITHDRAWAL_REVERSAL</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Account #</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5 text-right">Debit</th>
                <th className="px-5 py-3.5 text-right">Credit</th>
                <th className="px-5 py-3.5 text-right">Bal. Before</th>
                <th className="px-5 py-3.5 text-right">Bal. After</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    No transaction records found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const isCredit = ["DEPOSIT", "LOAN_DISBURSEMENT", "OPENING_BALANCE", "WITHDRAWAL_REVERSAL"].includes(t.type);
                  const isReversible =
                    (t.type === "DEPOSIT" || t.type === "WITHDRAWAL") &&
                    t.status === "COMPLETED" &&
                    !t.reversedAt &&
                    !t.reversalOfId;

                  return (
                    <tr key={t.id} className="transition hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {t.reference}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{t.memberName || "System"}</div>
                        <div className="text-xs text-slate-400">{t.memberNumber || "—"}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-800">{t.accountNumber || "—"}</td>
                      <td className="px-5 py-4 font-semibold text-xs whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md ${isCredit ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                          {t.type}
                        </span>
                        {t.reversedAt && <span className="ml-1 text-[10px] text-rose-600 font-bold">(REVERSED)</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-rose-700 whitespace-nowrap">
                        {!isCredit ? formatMoney(t.amount, t.currency) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {isCredit ? formatMoney(t.amount, t.currency) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                        {t.balanceBefore ? formatMoney(t.balanceBefore, t.currency) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {t.balanceAfter ? formatMoney(t.balanceAfter, t.currency) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {isReversible ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReversalModalId(t.id)}
                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                          >
                            <RotateCcw className="mr-1 size-3.5" /> Reverse
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVERSAL MODAL */}
      {reversalModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="size-5 text-rose-600" /> Reverse Financial Transaction
            </h3>
            <p className="text-xs text-slate-500">
              An offsetting reversal transaction will be posted to restore account balance. Original transaction remains historically intact.
            </p>

            <textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Enter mandatory reason for transaction reversal..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReversalModalId(null)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReverseTransaction} disabled={loading || !reversalReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                Confirm Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
