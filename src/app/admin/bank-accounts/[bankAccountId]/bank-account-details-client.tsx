"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import {
  recordManualBankDepositAction,
  recordManualBankWithdrawalAction,
  updateBankAccountStatusAction,
} from "@/lib/banking/bank-accounts";
import type { BankAccountDTO, BankTransactionDTO, ExpenseDTO } from "@/lib/serializers";

type Props = {
  bankAccount: BankAccountDTO;
  transactions: BankTransactionDTO[];
  expenses: ExpenseDTO[];
};

export function BankAccountDetailsClient({
  bankAccount: initialAccount,
  transactions: initialTxList,
  expenses: initialExpenseList,
}: Props) {
  const [bankAccount, setBankAccount] = useState<BankAccountDTO>(initialAccount);
  const [txList, setTxList] = useState<BankTransactionDTO[]>(initialTxList);
  const [activeTab, setActiveTab] = useState<"transactions" | "expenses">("transactions");

  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);

  const [amountInput, setAmountInput] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);

    const res = await recordManualBankDepositAction({
      bankAccountId: bankAccount.id,
      amount: Number(amountInput),
      reference,
      description,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const btxDto: BankTransactionDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        balanceBefore: res.data.balanceBefore.toString(),
        balanceAfter: res.data.balanceAfter.toString(),
        transactionDate: res.data.transactionDate.toISOString(),
        reconciledAt: res.data.reconciledAt ? res.data.reconciledAt.toISOString() : null,
        createdAt: res.data.createdAt.toISOString(),
      };

      setTxList((prev) => [btxDto, ...prev]);
      setBankAccount((prev) => ({
        ...prev,
        currentBalance: res.data.balanceAfter.toString(),
      }));
      setDepositModalOpen(false);
      setAmountInput("");
      setReference("");
      setDescription("");
    }
  }

  async function handleWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);

    const res = await recordManualBankWithdrawalAction({
      bankAccountId: bankAccount.id,
      amount: Number(amountInput),
      reference,
      description,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const btxDto: BankTransactionDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        balanceBefore: res.data.balanceBefore.toString(),
        balanceAfter: res.data.balanceAfter.toString(),
        transactionDate: res.data.transactionDate.toISOString(),
        reconciledAt: res.data.reconciledAt ? res.data.reconciledAt.toISOString() : null,
        createdAt: res.data.createdAt.toISOString(),
      };

      setTxList((prev) => [btxDto, ...prev]);
      setBankAccount((prev) => ({
        ...prev,
        currentBalance: res.data.balanceAfter.toString(),
      }));
      setWithdrawalModalOpen(false);
      setAmountInput("");
      setReference("");
      setDescription("");
    }
  }

  async function handleStatusChange(nextStatus: "ACTIVE" | "INACTIVE" | "CLOSED") {
    setLoading(true);
    setError(null);
    const res = await updateBankAccountStatusAction(bankAccount.id, nextStatus);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setBankAccount((prev) => ({ ...prev, status: nextStatus }));
    }
  }

  function maskAccountNumber(num: string) {
    if (num.length <= 4) return num;
    return `•••• ${num.slice(-4)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/bank-accounts">
            <ArrowLeft className="mr-1 size-4" /> Back to Bank Accounts
          </Link>
        </Button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {/* Account Overview Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="size-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">{bankAccount.name}</h1>
              <StatusBadge tone={bankAccount.status === "ACTIVE" ? "success" : bankAccount.status === "INACTIVE" ? "warning" : "danger"}>
                {bankAccount.status}
              </StatusBadge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {bankAccount.bankName} {bankAccount.branchName ? `(${bankAccount.branchName})` : ""} — Branch Scope: {bankAccount.branchTitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setDepositModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <ArrowDownToLine className="mr-1.5 size-4" /> Manual Deposit
            </Button>
            <Button onClick={() => setWithdrawalModalOpen(true)} className="bg-amber-600 hover:bg-amber-700">
              <ArrowUpFromLine className="mr-1.5 size-4" /> Manual Withdrawal
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account Number</div>
            <div className="font-mono text-base font-bold text-slate-900">{maskAccountNumber(bankAccount.accountNumber)}</div>
            <div className="text-xs text-slate-500">Holder: {bankAccount.accountName}</div>
          </div>

          <div className="rounded-xl bg-emerald-50/60 p-4">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Current Liquidity Balance</div>
            <div className="text-2xl font-extrabold text-emerald-900">{formatMoney(bankAccount.currentBalance, bankAccount.currency)}</div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Opening Balance</div>
            <div className="text-lg font-bold text-slate-800">{formatMoney(bankAccount.openingBalance, bankAccount.currency)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition ${
              activeTab === "transactions" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Bank Transactions Subledger ({txList.length})
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition ${
              activeTab === "expenses" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Paid Expenses ({initialExpenseList.length})
          </button>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/reconciliation"
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Reconciliation Center →
          </Link>
          {bankAccount.status === "ACTIVE" ? (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("INACTIVE")} disabled={loading}>
              Deactivate
            </Button>
          ) : bankAccount.status === "INACTIVE" ? (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("ACTIVE")} disabled={loading}>
              Activate
            </Button>
          ) : null}
          {bankAccount.status !== "CLOSED" && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange("CLOSED")} disabled={loading} className="text-rose-600 hover:bg-rose-50">
              Close Account
            </Button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "transactions" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tx Number</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5 text-right">Debit</th>
                <th className="px-5 py-3.5 text-right">Credit</th>
                <th className="px-5 py-3.5 text-right">Bal Before</th>
                <th className="px-5 py-3.5 text-right">Bal After</th>
                <th className="px-5 py-3.5">Reconciliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No bank transactions recorded yet.
                  </td>
                </tr>
              ) : (
                txList.map((tx) => {
                  const isCredit = tx.direction === "CREDIT";
                  return (
                    <tr key={tx.id} className="transition hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-mono font-bold text-indigo-700">{tx.bankTransactionNumber}</td>
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 font-semibold text-xs">
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
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Expense #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialExpenseList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No expenses paid from this bank account yet.
                  </td>
                </tr>
              ) : (
                initialExpenseList.map((exp) => (
                  <tr key={exp.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-700">{exp.expenseNumber}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{exp.categoryName}</td>
                    <td className="px-5 py-4 text-right font-extrabold text-rose-700 whitespace-nowrap">
                      {formatMoney(exp.amount, exp.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={exp.status === "POSTED" ? "success" : "danger"}>
                        {exp.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{exp.reference || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Record Manual External Bank Deposit</h3>
            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deposit Amount ({bankAccount.currency}) *
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">External Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Bank Advice #9012"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setDepositModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
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
            <h3 className="text-lg font-bold text-slate-900">Record Manual External Bank Withdrawal</h3>
            <form onSubmit={handleWithdrawal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Withdrawal Amount ({bankAccount.currency}) *
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">External Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Cheque #5012"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setWithdrawalModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !amountInput} className="bg-amber-600 hover:bg-amber-700">
                  Confirm Withdrawal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
