"use client";

import { useState } from "react";
import { ArrowUpFromLine, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { recordManualWithdrawalAction, approveWithdrawalRequestAction, rejectWithdrawalRequestAction } from "@/lib/accounts/cash-operations";
import type { AccountDTO, WithdrawalRequestDTO, TransactionCategoryDTO } from "@/lib/serializers";

type WithdrawalsClientProps = {
  activeAccounts: AccountDTO[];
  withdrawalRequests: WithdrawalRequestDTO[];
  categories: TransactionCategoryDTO[];
  initialTab?: string;
};

export function AdminWithdrawalsClient({
  activeAccounts,
  withdrawalRequests: initialRequests,
  categories,
  initialTab = "posting",
}: WithdrawalsClientProps) {
  const [activeTab, setActiveTab] = useState<"posting" | "requests">(
    initialTab === "requests" ? "requests" : "posting"
  );
  const [requests, setRequests] = useState<WithdrawalRequestDTO[]>(initialRequests);

  // Manual Withdrawal Form State
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccounts[0]?.id || "");
  const [amountInput, setAmountInput] = useState<number | "">("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId);
  const availableBalance = selectedAccount
    ? Math.max(0, Number(selectedAccount.balance) - Number(selectedAccount.loanGuarantee))
    : 0;

  async function handleManualWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId || !amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await recordManualWithdrawalAction({
      accountId: selectedAccountId,
      amount: Number(amountInput),
      categoryId: selectedCategoryId || null,
      paymentMethod,
      reference,
      notes,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setSuccessMsg(`Successfully debited ${formatMoney(dataAmount(amountInput), selectedAccount?.currency || "USD")} from account ${selectedAccount?.accountNumber}`);
      setAmountInput("");
      setReference("");
      setNotes("");
    }
  }

  function dataAmount(val: number | ""): number {
    return typeof val === "number" ? val : 0;
  }

  async function handleApprove(requestId: string) {
    setLoading(true);
    setError(null);

    const res = await approveWithdrawalRequestAction(requestId);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "APPROVED", approvedByName: "You" } : r))
      );
    }
  }

  async function handleReject() {
    if (!rejectModalId || !rejectionReason.trim()) return;
    setLoading(true);
    setError(null);

    const res = await rejectWithdrawalRequestAction(rejectModalId, rejectionReason);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === rejectModalId ? { ...r, status: "REJECTED", rejectionReason } : r))
      );
      setRejectModalId(null);
      setRejectionReason("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowUpFromLine className="size-6 text-amber-600" /> Cash Withdrawals & Requests
          </h1>
          <p className="text-sm text-slate-500">
            Post direct over-the-counter member withdrawals or approve pending member withdrawal requests.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("posting")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "posting"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Direct Withdrawal Posting
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "requests"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Withdrawal Requests ({requests.filter((r) => r.status === "PENDING").length})
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {successMsg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMsg}</div>}

      {activeTab === "posting" ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Record Direct Withdrawal</h2>

          <form onSubmit={handleManualWithdrawal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Member Account *</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} — {acc.memberName} ({acc.accountTypeName} - Balance: {formatMoney(acc.balance, acc.currency)})
                  </option>
                ))}
              </select>
              {selectedAccount && (
                <span className="block text-[11px] font-semibold text-emerald-700 mt-1">
                  Unencumbered Available Balance: {formatMoney(availableBalance, selectedAccount.currency)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Withdrawal Amount ({selectedAccount?.currency || "USD"}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableBalance}
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                >
                  <option value="">Default Cash Withdrawal</option>
                  {categories
                    .filter((c) => c.direction === "DEBIT" || c.direction === "BOTH")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">External Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Voucher #2081"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional withdrawal notes..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="submit" disabled={loading || !amountInput} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                Confirm & Post Withdrawal
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Request #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Account #</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No withdrawal requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.requestNumber}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{r.memberName}</div>
                      <div className="text-xs text-slate-400">{r.memberNumber}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-800">{r.accountNumber}</td>
                    <td className="px-5 py-4 text-right font-extrabold text-amber-800 whitespace-nowrap">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        tone={
                          r.status === "APPROVED"
                            ? "success"
                            : r.status === "PENDING"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                      {r.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(r.id)}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check className="mr-1 size-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectModalId(r.id)}
                            disabled={loading}
                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                          >
                            <X className="mr-1 size-3.5" /> Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reject Withdrawal Request</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectModalId(null)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReject} disabled={loading || !rejectionReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
