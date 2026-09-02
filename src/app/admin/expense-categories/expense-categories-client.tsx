"use client";

import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import {
  createExpenseCategoryAction,
  updateExpenseCategoryAction,
  toggleExpenseCategoryStatusAction,
} from "@/lib/banking/expense-categories";
import type { ExpenseCategoryDTO } from "@/lib/serializers";

type BranchOption = { id: string; name: string; code: string };

type Props = {
  initialCategories: ExpenseCategoryDTO[];
  accessibleBranches: BranchOption[];
};

export function ExpenseCategoriesClient({ initialCategories, accessibleBranches }: Props) {
  const [categories, setCategories] = useState<ExpenseCategoryDTO[]>(initialCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryDTO | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState<string>("GLOBAL");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreateModal() {
    setEditingCategory(null);
    setName("");
    setCode("");
    setDescription("");
    setBranchId("GLOBAL");
    setStatus("ACTIVE");
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(c: ExpenseCategoryDTO) {
    setEditingCategory(c);
    setName(c.name);
    setCode(c.code);
    setDescription(c.description || "");
    setBranchId(c.branchId || "GLOBAL");
    setStatus(c.status as "ACTIVE" | "INACTIVE");
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (editingCategory) {
      const res = await updateExpenseCategoryAction(editingCategory.id, {
        name,
        description,
        status,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const updatedDto: ExpenseCategoryDTO = {
          ...res.data,
          branchName: res.data.branch?.name ?? null,
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setCategories((prev) => prev.map((item) => (item.id === editingCategory.id ? updatedDto : item)));
        setIsModalOpen(false);
      }
    } else {
      const res = await createExpenseCategoryAction({
        name,
        code,
        description,
        branchId: branchId === "GLOBAL" ? null : branchId,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        const createdDto: ExpenseCategoryDTO = {
          ...res.data,
          branchName: res.data.branch?.name ?? null,
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        };
        setCategories((prev) => [createdDto, ...prev]);
        setIsModalOpen(false);
      }
    }
  }

  async function handleToggle(c: ExpenseCategoryDTO) {
    const nextStatus = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await toggleExpenseCategoryStatusAction(c.id, nextStatus);
    if (res.data) {
      setCategories((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, status: nextStatus } : item))
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Tag className="size-6 text-indigo-600" /> Operational Expense Categories
          </h1>
          <p className="text-sm text-slate-500">
            Define global or branch-scoped operational expense classification codes for budget tracking.
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
              <th className="px-5 py-3.5">Category Name</th>
              <th className="px-5 py-3.5">Code</th>
              <th className="px-5 py-3.5">Scope</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No expense categories defined yet.
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-bold text-slate-900">{c.name}</td>
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-indigo-700">{c.code}</td>
                  <td className="px-5 py-4 text-xs font-medium text-slate-600">
                    {c.branchName ? `Branch: ${c.branchName}` : "Global (All Branches)"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 max-w-xs">{c.description || "—"}</td>
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
                {editingCategory ? `Edit ${editingCategory.name}` : "Create Expense Category"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Office Rent"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCategory}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RENT"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono uppercase focus:outline-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scope / Branch</label>
                <select
                  disabled={!!editingCategory}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none disabled:bg-slate-100"
                >
                  <option value="GLOBAL">Global (All Accessible Branches)</option>
                  {accessibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Branch: {b.name} ({b.code})
                    </option>
                  ))}
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
                  {editingCategory ? "Save Changes" : "Create Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
