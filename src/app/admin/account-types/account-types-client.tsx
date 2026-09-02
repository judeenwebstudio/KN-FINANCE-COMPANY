"use client";

import { useState } from "react";
import { Plus, Check, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { createAccountTypeAction, updateAccountTypeAction, toggleAccountTypeStatusAction } from "@/lib/accounts/account-types";
import type { AccountTypePolicyDTO } from "@/lib/serializers";

type AccountTypesClientProps = {
  accountTypes: AccountTypePolicyDTO[];
};

export function AccountTypesClient({ accountTypes: initialList }: AccountTypesClientProps) {
  const [types, setTypes] = useState<AccountTypePolicyDTO[]>(initialList);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AccountTypePolicyDTO | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("");
  const [minimumOpeningBalance, setMinimumOpeningBalance] = useState(0);
  const [minimumBalance, setMinimumBalance] = useState(0);
  const [allowDeposits, setAllowDeposits] = useState(true);
  const [allowWithdrawals, setAllowWithdrawals] = useState(true);
  const [status, setStatus] = useState("ACTIVE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreateModal() {
    setEditingType(null);
    setName("");
    setCode("");
    setDescription("");
    setCurrency("");
    setMinimumOpeningBalance(0);
    setMinimumBalance(0);
    setAllowDeposits(true);
    setAllowWithdrawals(true);
    setStatus("ACTIVE");
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(t: AccountTypePolicyDTO) {
    setEditingType(t);
    setName(t.name);
    setCode(t.code);
    setDescription(t.description || "");
    setCurrency(t.currency || "");
    setMinimumOpeningBalance(Number(t.minimumOpeningBalance));
    setMinimumBalance(Number(t.minimumBalance));
    setAllowDeposits(t.allowDeposits);
    setAllowWithdrawals(t.allowWithdrawals);
    setStatus(t.status);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (editingType) {
      const res = await updateAccountTypeAction(editingType.id, {
        name,
        description,
        minimumOpeningBalance,
        minimumBalance,
        allowDeposits,
        allowWithdrawals,
        status,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const updatedDto: AccountTypePolicyDTO = {
          ...res.data,
          minimumOpeningBalance: res.data.minimumOpeningBalance.toString(),
          minimumBalance: res.data.minimumBalance.toString(),
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setTypes((prev) => prev.map((item) => (item.id === editingType.id ? updatedDto : item)));
        setIsModalOpen(false);
      }
    } else {
      const res = await createAccountTypeAction({
        name,
        code,
        description,
        currency: currency || null,
        minimumOpeningBalance,
        minimumBalance,
        allowDeposits,
        allowWithdrawals,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const createdDto: AccountTypePolicyDTO = {
          ...res.data,
          minimumOpeningBalance: res.data.minimumOpeningBalance.toString(),
          minimumBalance: res.data.minimumBalance.toString(),
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setTypes((prev) => [...prev, createdDto]);
        setIsModalOpen(false);
      }
    }
  }

  async function handleToggle(t: AccountTypePolicyDTO) {
    const nextStatus = t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await toggleAccountTypeStatusAction(t.id, nextStatus);
    if (res.data) {
      setTypes((prev) => prev.map((item) => (item.id === t.id ? { ...item, status: nextStatus } : item)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="size-6 text-indigo-600" /> Account Types & Policies
          </h1>
          <p className="text-sm text-slate-500">
            Define authoritatively configured account rules, currency constraints, and transaction permissions.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Create Account Type
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Name / Code</th>
              <th className="px-5 py-3.5">Currency Policy</th>
              <th className="px-5 py-3.5">Min Opening</th>
              <th className="px-5 py-3.5">Min Balance</th>
              <th className="px-5 py-3.5">Deposits</th>
              <th className="px-5 py-3.5">Withdrawals</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No account types defined yet.
                </td>
              </tr>
            ) : (
              types.map((t) => (
                <tr key={t.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="text-xs font-mono text-indigo-600 font-semibold">{t.code}</div>
                  </td>
                  <td className="px-5 py-4 font-mono font-medium text-slate-700">
                    {t.currency ? t.currency : <span className="text-slate-400">ANY</span>}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-800">${t.minimumOpeningBalance}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">${t.minimumBalance}</td>
                  <td className="px-5 py-4">
                    {t.allowDeposits ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <Check className="size-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                        <X className="size-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {t.allowWithdrawals ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <Check className="size-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                        <X className="size-3.5" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={t.status === "ACTIVE" ? "success" : "neutral"}>
                      {t.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(t)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(t)}
                      className={t.status === "ACTIVE" ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}
                    >
                      {t.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingType ? `Edit ${editingType.name}` : "Create Account Type"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Standard Savings"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingType}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. SAVINGS"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency (Optional)</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="e.g. USD or blank"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm uppercase font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Opening ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minimumOpeningBalance}
                    onChange={(e) => setMinimumOpeningBalance(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minimumBalance}
                    onChange={(e) => setMinimumBalance(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDeposits}
                    onChange={(e) => setAllowDeposits(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-indigo-600"
                  />
                  Allow Deposits
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowWithdrawals}
                    onChange={(e) => setAllowWithdrawals(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-indigo-600"
                  />
                  Allow Withdrawals
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  {editingType ? "Save Changes" : "Create Account Type"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
