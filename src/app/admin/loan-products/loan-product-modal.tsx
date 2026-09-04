"use client";

import { useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createLoanProductAction, updateLoanProductAction } from "./actions";
import type { LoanProductDTO } from "@/lib/serializers";
import type { BranchDTO } from "@/types/portal";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product?: LoanProductDTO | null;
  branches: BranchDTO[];
};

export function LoanProductModal({ isOpen, onClose, product, branches }: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = product
      ? await updateLoanProductAction(product.id, {}, formData)
      : await createLoanProductAction({}, formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {product ? "Edit Loan Product" : "Create Loan Product"}
          </h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Product Name *</label>
              <input
                name="name"
                required
                defaultValue={product?.name ?? ""}
                placeholder="e.g. Personal Flex Loan"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Product Code *</label>
              <input
                name="code"
                required
                defaultValue={product?.code ?? ""}
                placeholder="e.g. PFL-INR"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={product?.description ?? ""}
              placeholder="Brief overview of product terms..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Currency (Locked)</label>
              <select name="currency" defaultValue="INR" className={inputClass} disabled>
                <option value="INR">INR (₹)</option>
              </select>
              <input type="hidden" name="currency" value="INR" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Min Amount *</label>
              <input
                name="minimumAmount"
                type="number"
                step="0.01"
                required
                defaultValue={product?.minimumAmount ?? "1000"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Max Amount *</label>
              <input
                name="maximumAmount"
                type="number"
                step="0.01"
                required
                defaultValue={product?.maximumAmount ?? "25000"}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Min Term (Months) *</label>
              <input
                name="minimumTermMonths"
                type="number"
                required
                defaultValue={product?.minimumTermMonths ?? 6}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Max Term (Months) *</label>
              <input
                name="maximumTermMonths"
                type="number"
                required
                defaultValue={product?.maximumTermMonths ?? 36}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Interest Rate (%) *</label>
              <input
                name="interestRate"
                type="number"
                step="0.01"
                required
                defaultValue={product?.interestRate ?? "12.0"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Interest Type *</label>
              <select
                name="interestType"
                defaultValue={product?.interestType ?? "DECLINING_BALANCE"}
                className={inputClass}
              >
                <option value="FLAT">Flat Interest</option>
                <option value="DECLINING_BALANCE">Declining Balance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Repayment Frequency *</label>
              <select
                name="repaymentFrequency"
                defaultValue={product?.repaymentFrequency ?? "MONTHLY"}
                className={inputClass}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="BIWEEKLY">Biweekly</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Processing Fee Type *</label>
              <select
                name="processingFeeType"
                defaultValue={product?.processingFeeType ?? "PERCENTAGE"}
                className={inputClass}
              >
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Fee Value *</label>
              <input
                name="processingFeeValue"
                type="number"
                step="0.01"
                required
                defaultValue={product?.processingFeeValue ?? "1.5"}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Branch Availability</label>
              <select
                name="branchId"
                defaultValue={product?.branchId ?? ""}
                className={inputClass}
              >
                <option value="">Global (All Branches)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                name="status"
                defaultValue={product?.status ?? "ACTIVE"}
                className={inputClass}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              {product ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
