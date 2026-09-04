"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, RotateCcw, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { RecordRepaymentModal } from "../loan-repayments/record-repayment-modal";
import { reverseLoanRepaymentAction } from "../loan-repayments/actions";
import type { LoanRepaymentDTO, LoanDTO, AccountDTO } from "@/lib/serializers";

type ClientProps = {
  repayments: LoanRepaymentDTO[];
  activeLoans: LoanDTO[];
  memberAccounts: Record<string, AccountDTO[]>;
};

export function LoanRepaymentsClient({ repayments: initialRepayments, activeLoans, memberAccounts }: ClientProps) {
  const [repayments, setRepayments] = useState<LoanRepaymentDTO[]>(initialRepayments);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [reversalModalId, setReversalModalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = repayments.filter((r) => {
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      r.repaymentNumber.toLowerCase().includes(q) ||
      (r.loanNumber && r.loanNumber.toLowerCase().includes(q)) ||
      (r.memberName && r.memberName.toLowerCase().includes(q)) ||
      (r.memberNumber && r.memberNumber.toLowerCase().includes(q)) ||
      (r.accountNumber && r.accountNumber.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  async function handleReverse() {
    if (!reversalModalId) return;
    if (!reversalReason.trim()) {
      setError("Please provide a reversal reason.");
      return;
    }
    setReversing(true);
    setError(null);

    const res = await reverseLoanRepaymentAction(reversalModalId, reversalReason);
    setReversing(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setRepayments((prev) =>
        prev.map((item) => (item.id === res.data!.id ? res.data! : item))
      );
      setReversalModalId(null);
      setReversalReason("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loan Repayments</h1>
          <p className="text-sm text-slate-500">
            Record loan payments, view allocation history, and execute controlled payment reversals.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Record Repayment
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repayment #, loan #, or member name..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
        >
          <option value="ALL">All Statuses</option>
          <option value="POSTED">Posted Only</option>
          <option value="REVERSED">Reversed Only</option>
        </select>
      </div>

      {/* Repayments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Repayment #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Loan #</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Total Amount</th>
                <th className="px-5 py-3.5">Breakdown (P / I / F)</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No loan repayments recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-900">
                      {r.repaymentNumber}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(r.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-indigo-700">
                      <Link href={`/admin/loans/${r.loanId}`} className="hover:underline">
                        {r.loanNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{r.memberName}</div>
                      <div className="text-xs text-slate-400">{r.memberNumber}</div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatMoney(r.amount, "INR")}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                      P: {formatMoney(r.principalAmount, "INR")} | I: {formatMoney(r.interestAmount, "INR")} | F: {formatMoney(r.feeAmount, "INR")}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge tone={r.status === "POSTED" ? "success" : "danger"}>
                        {r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      {r.status === "POSTED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setReversalModalId(r.id);
                          }}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <RotateCcw className="mr-1 size-3.5" /> Reverse
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium" title={r.reversalReason ?? undefined}>
                          Reversed on {r.reversedAt ? new Date(r.reversedAt).toLocaleDateString() : "N/A"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecordRepaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        activeLoans={activeLoans}
        memberAccounts={memberAccounts}
      />

      {/* REVERSAL CONFIRMATION MODAL */}
      {reversalModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-rose-900 flex items-center gap-2">
              <RotateCcw className="size-5 text-rose-600" /> Confirm Repayment Reversal
            </h2>
            <p className="text-xs text-slate-600">
              Reversing this repayment will restore the member&apos;s account balance, reverse installment schedule allocations, and update loan balance.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reversal Reason *
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
                placeholder="e.g. Bank error or wrong transaction reference entered..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-rose-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setReversalModalId(null)} disabled={reversing}>
                Cancel
              </Button>
              <Button onClick={handleReverse} disabled={reversing} className="bg-rose-600 hover:bg-rose-700">
                {reversing && <LoaderCircle className="mr-2 size-4 animate-spin" />} Confirm Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
