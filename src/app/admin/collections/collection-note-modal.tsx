"use client";

import { useState } from "react";
import { X, LoaderCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CollectionActionType } from "@/generated/prisma/client";
import { createCollectionNoteAction } from "./actions";

type CollectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  loanNumber: string;
  memberName: string;
  onSuccess?: () => void;
};

export function CollectionNoteModal({
  isOpen,
  onClose,
  loanId,
  loanNumber,
  memberName,
  onSuccess,
}: CollectionModalProps) {
  const [actionType, setActionType] = useState<string>("PHONE_CALL");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState<number | "">("");
  const [promiseDate, setPromiseDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createCollectionNoteAction(
      loanId,
      actionType as CollectionActionType,
      notes,
      followUpDate || null,
      promiseAmount ? Number(promiseAmount) : null,
      promiseDate || null
    );

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      if (onSuccess) onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="size-5 text-indigo-600" /> Log Collection Action
            </h2>
            <p className="text-xs text-slate-500">
              Loan <strong>{loanNumber}</strong> • Member: <strong>{memberName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Collection Action Type *
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="PHONE_CALL">Phone Call</option>
              <option value="SMS">SMS Reminder</option>
              <option value="EMAIL">Email Follow-up</option>
              <option value="VISIT">Field Visit</option>
              <option value="PROMISE_TO_PAY">Promise to Pay</option>
              <option value="OTHER">Other Action</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Action Notes *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Spoke with member. Confirmed salary delay, agreed on payment plan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {actionType === "PROMISE_TO_PAY" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  Promise Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 500"
                  className="h-9 w-full rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  Promise Date *
                </label>
                <input
                  type="date"
                  required
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Follow-up Date (Optional)
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !notes.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />} Save Collection Note
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
