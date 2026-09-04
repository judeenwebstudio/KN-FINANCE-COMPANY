"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Wallet, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { createMemberAccountAction } from "@/lib/accounts/account-management";
import type { AccountDTO, AccountTypePolicyDTO } from "@/lib/serializers";

type MemberOption = {
  id: string;
  memberNumber: string;
  name: string;
  branchId: string;
  branchName: string;
};

type AccountsClientProps = {
  accounts: AccountDTO[];
  accountTypePolicies: AccountTypePolicyDTO[];
  membersList: MemberOption[];
};

export function AdminAccountsClient({
  accounts: initialList,
  accountTypePolicies,
  membersList,
}: AccountsClientProps) {
  const [accounts, setAccounts] = useState<AccountDTO[]>(initialList);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(membersList[0]?.id || "");
  const [selectedPolicyId, setSelectedPolicyId] = useState(accountTypePolicies[0]?.id || "");
  const [currencyInput, setCurrencyInput] = useState("INR");
  const [openingBalance, setOpeningBalance] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = accounts.filter((acc) => {
    const matchesStatus = statusFilter === "ALL" || acc.status === statusFilter;
    const matchesType = typeFilter === "ALL" || acc.accountTypeId === typeFilter || acc.accountType === typeFilter;

    const q = search.toLowerCase();
    const matchesSearch =
      acc.accountNumber.toLowerCase().includes(q) ||
      (acc.memberName && acc.memberName.toLowerCase().includes(q)) ||
      (acc.memberNumber && acc.memberNumber.toLowerCase().includes(q)) ||
      (acc.branchName && acc.branchName.toLowerCase().includes(q));

    return matchesStatus && matchesType && matchesSearch;
  });

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createMemberAccountAction({
      memberId: selectedMemberId,
      accountTypeId: selectedPolicyId,
      currency: currencyInput,
      openingBalance,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const createdDto: AccountDTO = {
        ...res.data,
        balance: res.data.balance.toString(),
        loanGuarantee: res.data.loanGuarantee.toString(),
        accountTypeId: res.data.accountTypeId ?? null,
        accountTypeName: res.data.accountTypePolicy?.name ?? res.data.accountType,
        hasOpeningBalance: res.data.hasOpeningBalance ?? false,
        createdAt: res.data.createdAt ? res.data.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: res.data.updatedAt ? res.data.updatedAt.toISOString() : new Date().toISOString(),
      };
      setAccounts((prev) => [createdDto, ...prev]);
      setIsCreateModalOpen(false);
      setOpeningBalance(0);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wallet className="size-6 text-indigo-600" /> Member Accounts Management
          </h1>
          <p className="text-sm text-slate-500">
            View authoritative member balances, account statuses, and create new operational accounts.
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Open New Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account #, member name, or branch..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="FROZEN">FROZEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Account Types</option>
            {accountTypePolicies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Account #</th>
              <th className="px-5 py-3.5">Member</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Currency</th>
              <th className="px-5 py-3.5 text-right">Current Balance</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No member accounts found.
                </td>
              </tr>
            ) : (
              filtered.map((acc) => (
                <tr key={acc.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">
                    <Link href={`/admin/accounts/${acc.id}`} className="hover:underline">
                      {acc.accountNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{acc.memberName}</div>
                    <div className="text-xs text-slate-400">{acc.memberNumber}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{acc.branchName}</td>
                  <td className="px-5 py-4 font-medium text-slate-800">{acc.accountTypeName}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">{acc.currency}</td>
                  <td className="px-5 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatMoney(acc.balance, acc.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      tone={
                        acc.status === "ACTIVE"
                          ? "success"
                          : acc.status === "FROZEN"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {acc.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/accounts/${acc.id}`}>
                        <Eye className="mr-1 size-3.5" /> View Account
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* OPEN NEW ACCOUNT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Open New Member Account</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                >
                  {membersList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberNumber}) — {m.branchName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type Policy *</label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => {
                    setSelectedPolicyId(e.target.value);
                    const p = accountTypePolicies.find((x) => x.id === e.target.value);
                    if (p?.currency) setCurrencyInput(p.currency);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                >
                  {accountTypePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) {p.currency ? `[${p.currency}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Currency *</label>
                  <input
                    type="text"
                    required
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono uppercase focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  Confirm & Open Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
