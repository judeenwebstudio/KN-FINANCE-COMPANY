"use client";

import { useState } from "react";
import { Plus, Search, DollarSign, RotateCcw, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { createExpenseAction, reverseExpenseAction } from "@/lib/banking/expenses";
import type {
  ExpenseDTO,
  ExpenseCategoryDTO,
  TreasuryAccountDTO,
  BankAccountDTO,
} from "@/lib/serializers";

type BranchOption = { id: string; name: string; code: string; currency: string };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

type Props = {
  initialExpenses: ExpenseDTO[];
  categories: ExpenseCategoryDTO[];
  treasuryAccounts: TreasuryAccountDTO[];
  bankAccounts: BankAccountDTO[];
  branches: BranchOption[];
};

export function ExpensesClient({
  initialExpenses,
  categories,
  treasuryAccounts,
  bankAccounts,
  branches,
}: Props) {
  const [expenses, setExpenses] = useState<ExpenseDTO[]>(initialExpenses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [amountInput, setAmountInput] = useState<number | "">("");
  const [paymentSourceType, setPaymentSourceType] = useState<"CASH" | "BANK">("CASH");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState(treasuryAccounts[0]?.id || "");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");

  const [reversalModalId, setReversalModalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = branches.find((b) => b.id === branchId);
  const availableTreasuries = treasuryAccounts.filter((t) => t.branchId === branchId);
  const availableBanks = bankAccounts.filter((b) => b.branchId === branchId);

  const filtered = expenses.filter((e) => {
    const matchesCategory = categoryFilter === "ALL" || e.categoryId === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
    const matchesSource = sourceFilter === "ALL" || e.paymentSourceType === sourceFilter;

    const q = search.toLowerCase();
    const matchesSearch =
      e.expenseNumber.toLowerCase().includes(q) ||
      (e.categoryName && e.categoryName.toLowerCase().includes(q)) ||
      (e.reference && e.reference.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.branchName && e.branchName.toLowerCase().includes(q));

    return matchesCategory && matchesStatus && matchesSource && matchesSearch;
  });

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);

    const currency = activeBranch?.currency || "INR";

    const res = await createExpenseAction({
      branchId,
      categoryId,
      amount: Number(amountInput),
      currency,
      paymentSourceType,
      treasuryAccountId: paymentSourceType === "CASH" ? selectedTreasuryId : null,
      bankAccountId: paymentSourceType === "BANK" ? selectedBankAccountId : null,
      reference,
      description,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const dto: ExpenseDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        expenseDate: res.data.expenseDate.toISOString(),
        branchName: activeBranch?.name ?? null,
        categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
        categoryCode: categories.find((c) => c.id === categoryId)?.code ?? null,
        treasuryAccountName: treasuryAccounts.find((t) => t.id === selectedTreasuryId)?.name ?? null,
        bankAccountName: bankAccounts.find((b) => b.id === selectedBankAccountId)?.name ?? null,
        reversedAt: null,
        reversedById: null,
        reversalReason: null,
        createdAt: res.data.createdAt.toISOString(),
        updatedAt: res.data.updatedAt.toISOString(),
      };
      setExpenses((prev) => [dto, ...prev]);
      setIsModalOpen(false);
      setAmountInput("");
      setReference("");
      setDescription("");
    }
  }

  async function handleReverseExpense() {
    if (!reversalModalId || !reversalReason.trim()) return;
    setLoading(true);
    setError(null);

    const res = await reverseExpenseAction(reversalModalId, reversalReason);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === reversalModalId
            ? {
                ...item,
                status: "REVERSED",
                reversedAt: res.data.reversedAt ? res.data.reversedAt.toISOString() : new Date().toISOString(),
                reversalReason,
              }
            : item
        )
      );
      setReversalModalId(null);
      setReversalReason("");
    }
  }

  function exportCSV() {
    const headers = [
      "Expense Number",
      "Date",
      "Branch",
      "Category",
      "Payment Source",
      "Amount",
      "Currency",
      "Status",
      "Reference",
      "Description",
      "Recorded By",
    ];

    const rows = filtered.map((e) => [
      e.expenseNumber,
      dateFormatter.format(new Date(e.expenseDate)),
      `"${e.branchName || ""}"`,
      `"${e.categoryName || ""}"`,
      e.paymentSourceType,
      e.amount,
      e.currency,
      e.status,
      `"${e.reference || ""}"`,
      `"${e.description || ""}"`,
      `"${e.createdByName || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KNFinance_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="size-6 text-rose-600" /> Operational Expenses Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Record outgoing company costs funded from Treasury Cash or Bank Accounts with atomic subledger posting.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" className="shadow-xs">
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <Plus className="mr-2 size-4" /> Post New Expense
          </Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expense #, category, ref, description..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Payment Sources</option>
            <option value="CASH">CASH (Treasury)</option>
            <option value="BANK">BANK ACCOUNT</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">POSTED</option>
            <option value="REVERSED">REVERSED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Expense #</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Source</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No expense records found.
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{exp.expenseNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {dateFormatter.format(new Date(exp.expenseDate))}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-700 font-medium">{exp.branchName}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{exp.categoryName}</div>
                    <div className="text-xs font-mono text-slate-400">{exp.categoryCode}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold">
                    <span className={`px-2 py-0.5 rounded-md ${exp.paymentSourceType === "CASH" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
                      {exp.paymentSourceType === "CASH" ? `CASH: ${exp.treasuryAccountName || "Treasury"}` : `BANK: ${exp.bankAccountName || "Bank Account"}`}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-rose-700 whitespace-nowrap">
                    {formatMoney(exp.amount, exp.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={exp.status === "POSTED" ? "success" : "danger"}>
                      {exp.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {exp.status === "POSTED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReversalModalId(exp.id)}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      >
                        <RotateCcw className="mr-1 size-3.5" /> Reverse
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Reversed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* POST NEW EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Post Operational Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Source Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentSourceType("CASH")}
                    className={`h-10 rounded-xl border font-semibold text-xs transition ${
                      paymentSourceType === "CASH"
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    CASH (Treasury)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSourceType("BANK")}
                    className={`h-10 rounded-xl border font-semibold text-xs transition ${
                      paymentSourceType === "BANK"
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    BANK ACCOUNT
                  </button>
                </div>
              </div>

              {paymentSourceType === "CASH" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Treasury Cash Account *</label>
                  <select
                    value={selectedTreasuryId}
                    onChange={(e) => setSelectedTreasuryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {availableTreasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Balance: {formatMoney(t.balance, t.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Bank Account *</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {availableBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.bankName} (Balance: {formatMoney(b.currentBalance, b.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Amount ({activeBranch?.currency || "INR"}) *
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Voucher #</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Receipt #4092"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe the operational expense..."
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !amountInput} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                  Confirm & Post Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {reversalModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="size-5 text-rose-600" /> Reverse Operational Expense
            </h3>
            <p className="text-xs text-slate-500">
              Restores exact source balance (Treasury/Bank) and posts an offsetting CREDIT subledger entry.
            </p>

            <textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Enter mandatory reason for expense reversal..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReversalModalId(null)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReverseExpense} disabled={loading || !reversalReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                Confirm Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
