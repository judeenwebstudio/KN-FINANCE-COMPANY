"use client";

import { useState } from "react";
import { ArrowLeftRight, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import type { BankTransactionDTO } from "@/lib/serializers";

type BankAccountOption = { id: string; name: string; bankName: string };

type Props = {
  transactions: BankTransactionDTO[];
  bankAccounts: BankAccountOption[];
};

export function BankTransactionsClient({ transactions, bankAccounts }: Props) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filtered = transactions.filter((tx) => {
    const matchesAccount = accountFilter === "ALL" || tx.bankAccountId === accountFilter;
    const matchesType = typeFilter === "ALL" || tx.type === typeFilter;

    const q = search.toLowerCase();
    const matchesSearch =
      tx.bankTransactionNumber.toLowerCase().includes(q) ||
      (tx.bankAccountName && tx.bankAccountName.toLowerCase().includes(q)) ||
      (tx.reference && tx.reference.toLowerCase().includes(q)) ||
      (tx.description && tx.description.toLowerCase().includes(q)) ||
      tx.type.toLowerCase().includes(q);

    return matchesAccount && matchesType && matchesSearch;
  });

  function exportCSV() {
    const headers = [
      "Tx Number",
      "Date",
      "Bank Account",
      "Type",
      "Direction",
      "Amount",
      "Currency",
      "Balance Before",
      "Balance After",
      "Reconciliation Status",
      "Reference",
      "Description",
      "Recorded By",
    ];

    const csvRows = filtered.map((tx) => [
      tx.bankTransactionNumber,
      new Date(tx.transactionDate).toLocaleDateString(),
      `"${tx.bankAccountName || ""}"`,
      tx.type,
      tx.direction,
      tx.amount,
      tx.currency,
      tx.balanceBefore,
      tx.balanceAfter,
      tx.reconciliationStatus,
      `"${tx.reference || ""}"`,
      `"${tx.description || ""}"`,
      `"${tx.createdByName || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KNFinance_Bank_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-indigo-600" /> Bank Transactions Subledger
          </h1>
          <p className="text-sm text-slate-500">
            Authoritative operational bank subledger with reconciliation metadata indicators.
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="shadow-xs">
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tx number, bank name, reference..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Bank Accounts</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.bankName})
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="WITHDRAWAL">WITHDRAWAL</option>
            <option value="TRANSFER_IN">TRANSFER_IN</option>
            <option value="TRANSFER_OUT">TRANSFER_OUT</option>
            <option value="EXPENSE">EXPENSE</option>
            <option value="OPENING_BALANCE">OPENING_BALANCE</option>
            <option value="REVERSAL">REVERSAL</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                  No bank transaction records found.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const isCredit = tx.direction === "CREDIT";
                return (
                  <tr key={tx.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-700">{tx.bankTransactionNumber}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{tx.bankAccountName}</td>
                    <td className="px-5 py-4 font-semibold text-xs whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md ${isCredit ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-rose-700 whitespace-nowrap">
                      {!isCredit ? formatMoney(tx.amount, tx.currency) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {isCredit ? formatMoney(tx.amount, tx.currency) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                      {formatMoney(tx.balanceBefore, tx.currency)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                      {formatMoney(tx.balanceAfter, tx.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={tx.reconciliationStatus === "RECONCILED" ? "success" : "neutral"}>
                        {tx.reconciliationStatus}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
