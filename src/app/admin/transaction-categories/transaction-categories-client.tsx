"use client";

import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { createTransactionCategoryAction, updateTransactionCategoryAction, toggleTransactionCategoryStatusAction } from "@/lib/accounts/transaction-categories";
import type { TransactionCategoryDTO } from "@/lib/serializers";

type CategoryClientProps = {
  categories: TransactionCategoryDTO[];
};

export function TransactionCategoriesClient({ categories: initialList }: CategoryClientProps) {
  const [cats, setCats] = useState<TransactionCategoryDTO[]>(initialList);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<TransactionCategoryDTO | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT" | "BOTH">("BOTH");
  const [status, setStatus] = useState("ACTIVE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreateModal() {
    setEditingCat(null);
    setName("");
    setCode("");
    setDescription("");
    setDirection("BOTH");
    setStatus("ACTIVE");
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(c: TransactionCategoryDTO) {
    setEditingCat(c);
    setName(c.name);
    setCode(c.code);
    setDescription(c.description || "");
    setDirection(c.direction as "CREDIT" | "DEBIT" | "BOTH");
    setStatus(c.status);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (editingCat) {
      const res = await updateTransactionCategoryAction(editingCat.id, {
        name,
        description,
        direction,
        status,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const updatedDto: TransactionCategoryDTO = {
          ...res.data,
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setCats((prev) => prev.map((item) => (item.id === editingCat.id ? updatedDto : item)));
        setIsModalOpen(false);
      }
    } else {
      const res = await createTransactionCategoryAction({
        name,
        code,
        description,
        direction,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const createdDto: TransactionCategoryDTO = {
          ...res.data,
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setCats((prev) => [...prev, createdDto]);
        setIsModalOpen(false);
      }
    }
  }

  async function handleToggle(c: TransactionCategoryDTO) {
    const nextStatus = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await toggleTransactionCategoryStatusAction(c.id, nextStatus);
    if (res.data) {
      setCats((prev) => prev.map((item) => (item.id === c.id ? { ...item, status: nextStatus } : item)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Tag className="size-6 text-indigo-600" /> Transaction Categories
          </h1>
          <p className="text-sm text-slate-500">
            Classify cash deposits, withdrawals, transfers, and adjustments for reporting.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
          <Plus className="mr-2 size-4" /> Create Category
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Category Name / Code</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5">Allowed Direction</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cats.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  No transaction categories defined yet.
                </td>
              </tr>
            ) : (
              cats.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs font-mono text-indigo-600 font-semibold">{c.code}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 max-w-xs">{c.description || "—"}</td>
                  <td className="px-5 py-4 font-mono font-bold text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        c.direction === "CREDIT"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.direction === "DEBIT"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      {c.direction}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                      {c.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(c)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(c)}
                      className={c.status === "ACTIVE" ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}
                    >
                      {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCat ? `Edit ${editingCat.name}` : "Create Category"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Over-The-Counter Cash Deposit"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCat}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. CASH_DEPOSIT"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Direction *</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "CREDIT" | "DEBIT" | "BOTH")}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                >
                  <option value="CREDIT">CREDIT (Deposits only)</option>
                  <option value="DEBIT">DEBIT (Withdrawals only)</option>
                  <option value="BOTH">BOTH (Deposits & Withdrawals)</option>
                </select>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  {editingCat ? "Save Changes" : "Create Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
