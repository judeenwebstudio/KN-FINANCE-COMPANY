"use client";

import { useState } from "react";
import { ArrowDownToLine, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { submitDepositRequestAction, cancelPendingRequestAction } from "@/lib/accounts/cash-operations";
import type { AccountDTO, DepositRequestDTO } from "@/lib/serializers";

type Props = {
  accounts: AccountDTO[];
  requests: DepositRequestDTO[];
};

export function MemberDepositsClient({ accounts, requests: initialList }: Props) {
  const [requests, setRequests] = useState<DepositRequestDTO[]>(initialList);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [amountInput, setAmountInput] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId || !amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);

    const res = await submitDepositRequestAction({
      accountId: selectedAccountId,
      amount: Number(amountInput),
      paymentMethod,
      reference,
      notes,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const createdDto: DepositRequestDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        approvedAt: res.data.approvedAt ? res.data.approvedAt.toISOString() : null,
        createdAt: res.data.createdAt.toISOString(),
        updatedAt: res.data.updatedAt.toISOString(),
      };
      setRequests((prev) => [createdDto, ...prev]);
      setIsModalOpen(false);
      setAmountInput("");
      setReference("");
      setNotes("");
    }
  }

  async function handleCancel(requestId: string) {
    setLoading(true);
    const res = await cancelPendingRequestAction(requestId, "DEPOSIT");
    setLoading(false);
    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "CANCELLED" } : r))
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowDownToLine className="size-6 text-emerald-600" /> Deposit Requests
          </h1>
          <p className="text-sm text-slate-500">
            Submit a deposit request to credit your account upon administrative review.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Submit Deposit Request
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Request #</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Account #</th>
              <th className="px-5 py-3.5">Method</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No deposit requests submitted yet.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{r.requestNumber}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-800">{r.accountNumber}</td>
                  <td className="px-5 py-4 font-semibold text-xs">{r.paymentMethod || "TRANSFER"}</td>
                  <td className="px-5 py-4 text-right font-extrabold text-emerald-700 whitespace-nowrap">
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
                  <td className="px-5 py-4 text-right">
                    {r.status === "PENDING" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(r.id)}
                        disabled={loading}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SUBMIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Submit Deposit Request</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Account *</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} ({acc.accountTypeName} - {acc.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deposit Amount ({selectedAccount?.currency || "USD"}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                >
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CASH">CASH AT BRANCH</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference / Proof</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Bank Reference #89012"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !amountInput} className="bg-indigo-600 hover:bg-indigo-700">
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
