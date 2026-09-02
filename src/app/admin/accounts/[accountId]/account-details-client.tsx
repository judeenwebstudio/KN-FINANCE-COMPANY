"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Lock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { updateAccountStatusAction } from "@/lib/accounts/account-management";
import { recordManualDepositAction, recordManualWithdrawalAction } from "@/lib/accounts/cash-operations";
import type { AccountDTO, TransactionDTO, TransactionCategoryDTO } from "@/lib/serializers";

type DetailsProps = {
  account: AccountDTO;
  transactions: TransactionDTO[];
  categories: TransactionCategoryDTO[];
};

export function AdminAccountDetailsClient({
  account: initialAcc,
  transactions: initialTxList,
  categories,
}: DetailsProps) {
  const [account, setAccount] = useState<AccountDTO>(initialAcc);
  const [transactions, setTransactions] = useState<TransactionDTO[]>(initialTxList);

  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"ACTIVE" | "FROZEN" | "CLOSED">("ACTIVE");

  const [amountInput, setAmountInput] = useState<number | "">("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableBalance = Math.max(0, Number(account.balance) - Number(account.loanGuarantee));

  async function handleStatusChange() {
    setLoading(true);
    setError(null);
    const res = await updateAccountStatusAction(account.id, targetStatus);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const updatedDto: AccountDTO = {
        ...res.data,
        balance: res.data.balance.toString(),
        loanGuarantee: res.data.loanGuarantee.toString(),
        accountTypeId: res.data.accountTypeId ?? null,
        accountTypeName: res.data.accountTypePolicy?.name ?? res.data.accountType,
        hasOpeningBalance: res.data.hasOpeningBalance ?? false,
        createdAt: res.data.createdAt ? res.data.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: res.data.updatedAt ? res.data.updatedAt.toISOString() : new Date().toISOString(),
      };
      setAccount(updatedDto);
      setStatusModalOpen(false);
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;
    setLoading(true);
    setError(null);

    const res = await recordManualDepositAction({
      accountId: account.id,
      amount: Number(amountInput),
      categoryId: selectedCategoryId || null,
      notes,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setAccount((prev) => ({
        ...prev,
        balance: res.data!.account.balance.toString(),
      }));
      const txDto: TransactionDTO = {
        ...res.data.transaction,
        amount: res.data.transaction.amount.toString(),
        balanceBefore: res.data.transaction.balanceBefore ? res.data.transaction.balanceBefore.toString() : null,
        balanceAfter: res.data.transaction.balanceAfter ? res.data.transaction.balanceAfter.toString() : null,
        reversedAt: res.data.transaction.reversedAt ? res.data.transaction.reversedAt.toISOString() : null,
        createdAt: res.data.transaction.createdAt.toISOString(),
      };
      setTransactions((prev) => [txDto, ...prev]);
      setDepositModalOpen(false);
      setAmountInput("");
      setNotes("");
    }
  }

  async function handleWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;
    setLoading(true);
    setError(null);

    const res = await recordManualWithdrawalAction({
      accountId: account.id,
      amount: Number(amountInput),
      categoryId: selectedCategoryId || null,
      notes,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setAccount((prev) => ({
        ...prev,
        balance: res.data!.account.balance.toString(),
      }));
      const txDto: TransactionDTO = {
        ...res.data.transaction,
        amount: res.data.transaction.amount.toString(),
        balanceBefore: res.data.transaction.balanceBefore ? res.data.transaction.balanceBefore.toString() : null,
        balanceAfter: res.data.transaction.balanceAfter ? res.data.transaction.balanceAfter.toString() : null,
        reversedAt: res.data.transaction.reversedAt ? res.data.transaction.reversedAt.toISOString() : null,
        createdAt: res.data.transaction.createdAt.toISOString(),
      };
      setTransactions((prev) => [txDto, ...prev]);
      setWithdrawalModalOpen(false);
      setAmountInput("");
      setNotes("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/accounts">
            <ArrowLeft className="mr-2 size-4" /> Back to Accounts List
          </Link>
        </Button>
        <StatusBadge
          tone={
            account.status === "ACTIVE"
              ? "success"
              : account.status === "FROZEN"
              ? "warning"
              : "danger"
          }
        >
          {account.status}
        </StatusBadge>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Main Account Details Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {account.accountNumber}
              </h1>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-mono font-bold text-indigo-700">
                {account.accountTypeName}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Member: <span className="font-semibold text-slate-800">{account.memberName}</span> ({account.memberNumber}) • Branch: {account.branchName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {account.status === "ACTIVE" && (
              <>
                <Button onClick={() => setDepositModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                  <ArrowDownToLine className="mr-2 size-4" /> Deposit Funds
                </Button>
                <Button onClick={() => setWithdrawalModalOpen(true)} variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50">
                  <ArrowUpFromLine className="mr-2 size-4" /> Withdraw Funds
                </Button>
              </>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setTargetStatus(account.status === "ACTIVE" ? "FROZEN" : "ACTIVE");
                setStatusModalOpen(true);
              }}
            >
              Update Status
            </Button>
          </div>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
            <span className="block text-xs font-semibold text-indigo-700">Current Total Balance</span>
            <span className="text-2xl font-extrabold text-indigo-950 mt-1 block">
              {formatMoney(account.balance, account.currency)}
            </span>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-5">
            <span className="block text-xs font-semibold text-amber-800 flex items-center gap-1">
              <Lock className="size-3.5" /> Loan Guarantee Encumbrance
            </span>
            <span className="text-2xl font-bold text-amber-950 mt-1 block">
              {formatMoney(account.loanGuarantee, account.currency)}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
            <span className="block text-xs font-semibold text-emerald-800">Unencumbered Available Balance</span>
            <span className="text-2xl font-extrabold text-emerald-950 mt-1 block">
              {formatMoney(availableBalance, account.currency)}
            </span>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="pt-6 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <History className="size-5 text-indigo-600" /> Recent Account Transactions
          </h2>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No transaction history found for this account.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isCredit = ["DEPOSIT", "LOAN_DISBURSEMENT", "OPENING_BALANCE", "WITHDRAWAL_REVERSAL"].includes(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{tx.reference}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold">{tx.type}</td>
                        <td className="px-4 py-3 text-slate-500">{tx.categoryName || "—"}</td>
                        <td className={`px-4 py-3 text-right font-bold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCredit ? "+" : "-"}{formatMoney(tx.amount, tx.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 font-semibold">
                          {tx.balanceAfter ? formatMoney(tx.balanceAfter, tx.currency) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={tx.status === "COMPLETED" ? "success" : "warning"}>
                            {tx.status}
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
      </div>

      {/* DEPOSIT MODAL */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownToLine className="size-5 text-emerald-600" /> Post Deposit
            </h3>
            <p className="text-xs text-slate-500">Account: <strong>{account.accountNumber}</strong> ({account.currency})</p>

            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Amount ({account.currency}) *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Optional)</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                >
                  <option value="">Select Category</option>
                  {categories
                    .filter((c) => c.direction === "CREDIT" || c.direction === "BOTH")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDepositModalOpen(false)} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading || !amountInput} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirm Deposit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {withdrawalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpFromLine className="size-5 text-amber-600" /> Post Withdrawal
            </h3>
            <p className="text-xs text-slate-500">
              Available Unencumbered Balance: <strong>{formatMoney(availableBalance, account.currency)}</strong>
            </p>

            <form onSubmit={handleWithdrawal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Withdrawal Amount ({account.currency}) *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Optional)</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                >
                  <option value="">Select Category</option>
                  {categories
                    .filter((c) => c.direction === "DEBIT" || c.direction === "BOTH")
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setWithdrawalModalOpen(false)} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading || !amountInput} className="bg-amber-600 hover:bg-amber-700 text-white">
                  Confirm Withdrawal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS MODAL */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Update Account Status</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as "ACTIVE" | "FROZEN" | "CLOSED")}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
              >
                <option value="ACTIVE">ACTIVE (Normal operations)</option>
                <option value="FROZEN">FROZEN (Manual deposits/withdrawals blocked)</option>
                <option value="CLOSED">CLOSED (Permanent closure - balance must be 0)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleStatusChange} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                Update Status
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
