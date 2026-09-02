"use client";

import { useState } from "react";
import { Plus, Search, Edit3, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { LoanProductModal } from "./loan-product-modal";
import { toggleLoanProductStatusAction } from "./actions";
import { formatMoney } from "@/lib/money";
import type { LoanProductDTO } from "@/lib/serializers";
import type { BranchDTO } from "@/types/portal";

type ClientProps = {
  products: LoanProductDTO[];
  branches: BranchDTO[];
};

export function LoanProductClient({ products, branches }: ClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProductDTO | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.currency.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleToggle(id: string) {
    setTogglingId(id);
    await toggleLoanProductStatusAction(id);
    setTogglingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loan Products</h1>
          <p className="text-sm text-slate-500">
            Define interest rates, fees, repayment frequencies, and limits for loan products.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200"
        >
          <Plus className="mr-2 size-4" /> Create Product
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or code..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Amount Range</th>
                <th className="px-5 py-3.5">Term</th>
                <th className="px-5 py-3.5">Rate & Type</th>
                <th className="px-5 py-3.5">Processing Fee</th>
                <th className="px-5 py-3.5">Scope</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No loan products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600">
                          {p.code}
                        </span>
                      </div>
                      {p.description && (
                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{p.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {formatMoney(p.minimumAmount, p.currency)} –{" "}
                      {formatMoney(p.maximumAmount, p.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {p.minimumTermMonths}–{p.maximumTermMonths} mo ({p.repaymentFrequency.toLowerCase()})
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{p.interestRate}% APR</span>
                      <span className="block text-xs text-slate-400">
                        {p.interestType === "FLAT" ? "Flat Interest" : "Declining Balance"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {p.processingFeeType === "FIXED"
                        ? formatMoney(p.processingFeeValue, p.currency)
                        : `${p.processingFeeValue}%`}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {p.branchName ? (
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
                          {p.branchName}
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                          Global
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge tone={p.status === "ACTIVE" ? "success" : "neutral"}>
                        {p.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProduct(p);
                            setModalOpen(true);
                          }}
                          className="size-8 text-slate-500 hover:text-indigo-600"
                          title="Edit Product"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={togglingId === p.id}
                          onClick={() => handleToggle(p.id)}
                          className="size-8 text-slate-500 hover:text-amber-600"
                          title={p.status === "ACTIVE" ? "Deactivate Product" : "Activate Product"}
                        >
                          <Power className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LoanProductModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        branches={branches}
      />
    </div>
  );
}
