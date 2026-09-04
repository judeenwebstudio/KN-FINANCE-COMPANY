"use client";

import { useState } from "react";
import { X, LoaderCircle, Calculator, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { recordLoanRepaymentAction, previewRepaymentAllocationAction } from "./actions";
import type { LoanDTO, AccountDTO } from "@/lib/serializers";

type RecordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialLoan?: LoanDTO | null;
  activeLoans: LoanDTO[];
  memberAccounts: Record<string, AccountDTO[]>; // memberId -> AccountDTO[]
};

type PreviewAllocationItem = {
  installmentNumber: number;
  principalAllocated: string;
  interestAllocated: string;
  feeAllocated: string;
  totalAllocated: string;
  newStatus: string;
};

type PreviewAllocationData = {
  totalAmount: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  totalOutstandingBefore: string;
  totalOutstandingAfter: string;
  isFullPayoff: boolean;
  allocations: PreviewAllocationItem[];
};

export function RecordRepaymentModal({
  isOpen,
  onClose,
  initialLoan = null,
  activeLoans,
  memberAccounts,
}: RecordModalProps) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    initialLoan?.id ?? activeLoans[0]?.id ?? ""
  );

  const selectedLoan = activeLoans.find((l) => l.id === selectedLoanId) ?? initialLoan ?? activeLoans[0];
  const eligibleAccounts = selectedLoan ? (memberAccounts[selectedLoan.memberId] ?? []).filter(
    (a) => a.status === "ACTIVE" && a.currency === selectedLoan.currency
  ) : [];

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const activeAccountId = selectedAccountId || eligibleAccounts[0]?.id || "";

  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<PreviewAllocationData | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedAccount = eligibleAccounts.find((a) => a.id === activeAccountId);

  async function handlePreview() {
    if (!selectedLoan || !amount || amount <= 0) {
      setError("Please select a loan and enter a valid positive payment amount.");
      return;
    }
    setCalculating(true);
    setError(null);
    const res = await previewRepaymentAllocationAction(selectedLoan.id, amount);
    setCalculating(false);

    if (res.error || !res.allocation) {
      setError(res.error ?? "Failed to calculate repayment allocation.");
    } else {
      setPreview(res.allocation);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoan || !activeAccountId || !amount || amount <= 0) {
      setError("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await recordLoanRepaymentAction(
      selectedLoan.id,
      activeAccountId,
      amount,
      notes
    );
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <IndianRupee className="size-5 text-indigo-600" /> Record Loan Repayment
            </h2>
            <p className="text-xs text-slate-500">
              Select loan facility, destination payment account, and preview repayment allocation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Select Loan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Active Loan Facility *
            </label>
            {activeLoans.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No active loans found available for repayment.
              </div>
            ) : (
              <select
                value={selectedLoanId}
                onChange={(e) => {
                  setSelectedLoanId(e.target.value);
                  setSelectedAccountId("");
                  setPreview(null);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {activeLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.loanNumber} — {l.memberName} ({l.memberNumber}) • Payable: {formatMoney(l.totalPayable, l.currency)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Select Account */}
          {selectedLoan && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Member Payment Account ({selectedLoan.currency}) *
                </label>
                {eligibleAccounts.length === 0 ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    No active account found in {selectedLoan.currency} for member {selectedLoan.memberName}.
                  </div>
                ) : (
                  <select
                    value={activeAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    {eligibleAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountNumber} ({acc.accountType}) — Bal: {formatMoney(acc.balance, acc.currency)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Repayment Amount ({selectedLoan.currency}) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount || ""}
                    onChange={(e) => {
                      setAmount(Number(e.target.value));
                      setPreview(null);
                    }}
                    placeholder="Enter amount..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={calculating || !amount || amount <= 0}
                    className="shrink-0"
                  >
                    {calculating ? <LoaderCircle className="size-4 animate-spin" /> : <Calculator className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Account & Loan Balances Bar */}
          {selectedLoan && selectedAccount && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-400 block">Available Account Balance</span>
                <span className="font-bold text-slate-900">
                  {formatMoney(selectedAccount.balance, selectedAccount.currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Facility Total Payable</span>
                <span className="font-bold text-indigo-700">
                  {formatMoney(selectedLoan.totalPayable, selectedLoan.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Allocation Preview Table */}
          {preview && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 border-b border-indigo-100 pb-2">
                <span>Allocation Preview</span>
                <span>
                  Principal: {formatMoney(preview.principalAmount, selectedLoan.currency)} | Interest:{" "}
                  {formatMoney(preview.interestAmount, selectedLoan.currency)} | Fee:{" "}
                  {formatMoney(preview.feeAmount, selectedLoan.currency)}
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-lg border border-indigo-100 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-indigo-50/80 font-semibold text-indigo-800">
                    <tr>
                      <th className="px-3 py-1.5">Inst #</th>
                      <th className="px-3 py-1.5">Fee Paid</th>
                      <th className="px-3 py-1.5">Interest Paid</th>
                      <th className="px-3 py-1.5">Principal Paid</th>
                      <th className="px-3 py-1.5 text-right">Allocated</th>
                      <th className="px-3 py-1.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50 text-slate-700">
                    {preview.allocations.map((a) => (
                      <tr key={a.installmentNumber}>
                        <td className="px-3 py-1.5 font-medium">{a.installmentNumber}</td>
                        <td className="px-3 py-1.5">{formatMoney(a.feeAllocated, selectedLoan.currency)}</td>
                        <td className="px-3 py-1.5">{formatMoney(a.interestAllocated, selectedLoan.currency)}</td>
                        <td className="px-3 py-1.5">{formatMoney(a.principalAllocated, selectedLoan.currency)}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                          {formatMoney(a.totalAllocated, selectedLoan.currency)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-indigo-700">{a.newStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Internal Reference</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Over-the-counter cash repayment by member..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !selectedLoan || !activeAccountId || amount <= 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting && <LoaderCircle className="mr-2 size-4 animate-spin" />} Confirm Repayment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
