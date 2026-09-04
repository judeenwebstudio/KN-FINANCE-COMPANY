"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { createBankAccountAction } from "@/lib/banking/bank-accounts";
import type { BankAccountDTO } from "@/lib/serializers";

type BranchOption = { id: string; name: string; code: string; currency: string };

type Props = {
  initialAccounts: BankAccountDTO[];
  accessibleBranches: BranchOption[];
};

export function BankAccountsClient({ initialAccounts, accessibleBranches }: Props) {
  const [accounts, setAccounts] = useState<BankAccountDTO[]>(initialAccounts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchId, setBranchId] = useState(accessibleBranches[0]?.id || "");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = accessibleBranches.find((b) => b.id === branchId);

  const filtered = accounts.filter((a) => {
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      a.name.toLowerCase().includes(q) ||
      a.accountName.toLowerCase().includes(q) ||
      a.bankName.toLowerCase().includes(q) ||
      a.accountNumber.toLowerCase().includes(q) ||
      (a.branchTitle && a.branchTitle.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const currency = activeBranch?.currency || "INR";

    const res = await createBankAccountAction({
      name,
      accountName,
      accountNumber,
      bankName,
      branchName: branchNameInput,
      branchId,
      currency,
      openingBalance,
      notes,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const dto: BankAccountDTO = {
        ...res.data,
        openingBalance: res.data.openingBalance.toString(),
        currentBalance: res.data.currentBalance.toString(),
        branchTitle: activeBranch?.name ?? null,
        createdAt: res.data.createdAt.toISOString(),
        updatedAt: res.data.updatedAt.toISOString(),
      };
      setAccounts((prev) => [dto, ...prev]);
      setIsModalOpen(false);
      setName("");
      setAccountName("");
      setAccountNumber("");
      setBankName("");
      setOpeningBalance(0);
      setNotes("");
    }
  }

  function maskAccountNumber(num: string) {
    if (num.length <= 4) return num;
    return `•••• ${num.slice(-4)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="size-6 text-indigo-600" /> Company Bank Accounts
          </h1>
          <p className="text-sm text-slate-500">
            Authoritative operational bank accounts and liquidity balances for company funds.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Add Bank Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account name, bank name, account #..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            No company bank accounts found.
          </div>
        ) : (
          filtered.map((acc) => (
            <div key={acc.id} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-200 hover:shadow-md space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{acc.name}</h3>
                  <div className="text-xs text-slate-500">{acc.bankName} {acc.branchName ? `(${acc.branchName})` : ""}</div>
                </div>
                <StatusBadge tone={acc.status === "ACTIVE" ? "success" : acc.status === "INACTIVE" ? "warning" : "danger"}>
                  {acc.status}
                </StatusBadge>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Account Number</div>
                <div className="font-mono text-sm font-bold text-slate-800">{maskAccountNumber(acc.accountNumber)}</div>
                <div className="text-xs text-slate-500">Title: {acc.accountName}</div>
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-400">Current Balance</div>
                  <div className="text-lg font-extrabold text-emerald-800">{formatMoney(acc.currentBalance, acc.currency)}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/bank-accounts/${acc.id}`}>
                    <Eye className="mr-1 size-3.5" /> Details
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD BANK ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add Company Bank Account</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Display Label *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Main Operating Account - Chase"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. JPMorgan Chase"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Branch Name</label>
                  <input
                    type="text"
                    value={branchNameInput}
                    onChange={(e) => setBranchNameInput(e.target.value)}
                    placeholder="e.g. Wall Street Branch"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. KN Finance Company Operations"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Branch *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {accessibleBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Balance ({activeBranch?.currency || "INR"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    placeholder="0.00"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none"
                  />
                </div>
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
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 font-semibold">
                  Confirm & Add Bank Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
