"use client";

import { useState } from "react";
import { Plus, Search, Repeat, RotateCcw, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { createTransferAction, reverseTransferAction } from "@/lib/banking/transfers";
import type {
  TransferDTO,
  TreasuryAccountDTO,
  BankAccountDTO,
} from "@/lib/serializers";

type BranchOption = { id: string; name: string; code: string; currency: string };

type Props = {
  initialTransfers: TransferDTO[];
  treasuryAccounts: TreasuryAccountDTO[];
  bankAccounts: BankAccountDTO[];
  branches: BranchOption[];
};

export function TransfersClient({
  initialTransfers,
  treasuryAccounts,
  bankAccounts,
  branches,
}: Props) {
  const [transfers, setTransfers] = useState<TransferDTO[]>(initialTransfers);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [transferType, setTransferType] = useState<"CASH_TO_BANK" | "BANK_TO_CASH" | "BANK_TO_BANK">("CASH_TO_BANK");

  const [srcTreasuryId, setSrcTreasuryId] = useState(treasuryAccounts[0]?.id || "");
  const [srcBankId, setSrcBankId] = useState(bankAccounts[0]?.id || "");
  const [destTreasuryId, setDestTreasuryId] = useState(treasuryAccounts[0]?.id || "");
  const [destBankId, setDestBankId] = useState(bankAccounts[0]?.id || "");

  const [amountInput, setAmountInput] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [reversalModalId, setReversalModalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = branches.find((b) => b.id === branchId);
  const branchTreasuries = treasuryAccounts.filter((t) => t.branchId === branchId);
  const branchBanks = bankAccounts.filter((b) => b.branchId === branchId);

  const filtered = transfers.filter((t) => {
    const matchesType = typeFilter === "ALL" || t.transferType === typeFilter;
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;

    const q = search.toLowerCase();
    const matchesSearch =
      t.transferNumber.toLowerCase().includes(q) ||
      (t.reference && t.reference.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      t.transferType.toLowerCase().includes(q);

    return matchesType && matchesStatus && matchesSearch;
  });

  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!amountInput || Number(amountInput) <= 0) return;

    setLoading(true);
    setError(null);

    const currency = activeBranch?.currency || "INR";

    const res = await createTransferAction({
      transferType,
      sourceTreasuryAccountId: transferType === "CASH_TO_BANK" ? srcTreasuryId : null,
      sourceBankAccountId: transferType !== "CASH_TO_BANK" ? srcBankId : null,
      destinationTreasuryAccountId: transferType === "BANK_TO_CASH" ? destTreasuryId : null,
      destinationBankAccountId: transferType !== "BANK_TO_CASH" ? destBankId : null,
      amount: Number(amountInput),
      currency,
      reference,
      notes,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const dto: TransferDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        transferDate: res.data.transferDate.toISOString(),
        sourceTreasuryAccountName: treasuryAccounts.find((t) => t.id === srcTreasuryId)?.name ?? null,
        sourceBankAccountName: bankAccounts.find((b) => b.id === srcBankId)?.name ?? null,
        destinationTreasuryAccountName: treasuryAccounts.find((t) => t.id === destTreasuryId)?.name ?? null,
        destinationBankAccountName: bankAccounts.find((b) => b.id === destBankId)?.name ?? null,
        reversedAt: null,
        reversedById: null,
        reversalReason: null,
        reversalOfId: null,
        createdAt: res.data.createdAt.toISOString(),
        updatedAt: res.data.updatedAt.toISOString(),
      };

      setTransfers((prev) => [dto, ...prev]);
      setIsModalOpen(false);
      setAmountInput("");
      setReference("");
      setNotes("");
    }
  }

  async function handleReverseTransfer() {
    if (!reversalModalId || !reversalReason.trim()) return;
    setLoading(true);
    setError(null);

    const res = await reverseTransferAction(reversalModalId, reversalReason);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      const revDto: TransferDTO = {
        ...res.data,
        amount: res.data.amount.toString(),
        transferDate: res.data.transferDate.toISOString(),
        reversedAt: null,
        reversedById: null,
        reversalReason: null,
        createdAt: res.data.createdAt.toISOString(),
        updatedAt: res.data.updatedAt.toISOString(),
      };

      setTransfers((prev) => [
        revDto,
        ...prev.map((item) =>
          item.id === reversalModalId
            ? {
                ...item,
                status: "REVERSED",
                reversedAt: new Date().toISOString(),
                reversalReason,
              }
            : item
        ),
      ]);
      setReversalModalId(null);
      setReversalReason("");
    }
  }

  function exportCSV() {
    const headers = [
      "Transfer Number",
      "Date",
      "Type",
      "Source",
      "Destination",
      "Amount",
      "Currency",
      "Status",
      "Reference",
      "Recorded By",
    ];

    const rows = filtered.map((t) => [
      t.transferNumber,
      new Date(t.transferDate).toLocaleDateString(),
      t.transferType,
      `"${t.sourceTreasuryAccountName || t.sourceBankAccountName || ""}"`,
      `"${t.destinationTreasuryAccountName || t.destinationBankAccountName || ""}"`,
      t.amount,
      t.currency,
      t.status,
      `"${t.reference || ""}"`,
      `"${t.createdByName || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KNFinance_Transfers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Repeat className="size-6 text-indigo-600" /> Company Fund Transfers
          </h1>
          <p className="text-sm text-slate-500">
            Execute internal liquidity transfers between Treasury Cash and Company Bank Accounts (Cash ↔ Bank, Bank ↔ Bank).
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" className="shadow-xs">
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <Plus className="mr-2 size-4" /> Execute Transfer
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
            placeholder="Search transfer #, reference, notes..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Transfer Types</option>
            <option value="CASH_TO_BANK">CASH → BANK</option>
            <option value="BANK_TO_CASH">BANK → CASH</option>
            <option value="BANK_TO_BANK">BANK → BANK</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="REVERSED">REVERSED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Transfer #</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Source Account</th>
              <th className="px-5 py-3.5">Destination Account</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No company transfer records found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-indigo-700">{t.transferNumber}</td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.transferDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 font-semibold text-xs whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800">
                      {t.transferType}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-800">
                    {t.sourceTreasuryAccountName ? `CASH: ${t.sourceTreasuryAccountName}` : `BANK: ${t.sourceBankAccountName}`}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-800">
                    {t.destinationTreasuryAccountName ? `CASH: ${t.destinationTreasuryAccountName}` : `BANK: ${t.destinationBankAccountName}`}
                  </td>
                  <td className="px-5 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatMoney(t.amount, t.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={t.status === "COMPLETED" ? "success" : "danger"}>
                      {t.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {t.status === "COMPLETED" && !t.reversalOfId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReversalModalId(t.id)}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      >
                        <RotateCcw className="mr-1 size-3.5" /> Reverse
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {t.reversalOfId ? "Reversal Leg" : "Reversed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* EXECUTE TRANSFER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Execute Company Fund Transfer</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <form onSubmit={handleCreateTransfer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Branch Scope *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Type *</label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value as "CASH_TO_BANK" | "BANK_TO_CASH" | "BANK_TO_BANK")}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold"
                >
                  <option value="CASH_TO_BANK">CASH → BANK (Treasury Cash to Bank Account)</option>
                  <option value="BANK_TO_CASH">BANK → CASH (Bank Account to Treasury Cash)</option>
                  <option value="BANK_TO_BANK">BANK → BANK (Bank Account to Bank Account)</option>
                </select>
              </div>

              {/* Source Account Selection */}
              {transferType === "CASH_TO_BANK" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Source Treasury Cash Account *</label>
                  <select
                    value={srcTreasuryId}
                    onChange={(e) => setSrcTreasuryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {branchTreasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Available: {formatMoney(t.balance, t.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Source Bank Account *</label>
                  <select
                    value={srcBankId}
                    onChange={(e) => setSrcBankId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {branchBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.bankName} (Available: {formatMoney(b.currentBalance, b.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Account Selection */}
              {transferType === "BANK_TO_CASH" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Treasury Cash Account *</label>
                  <select
                    value={destTreasuryId}
                    onChange={(e) => setDestTreasuryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {branchTreasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Current: {formatMoney(t.balance, t.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Bank Account *</label>
                  <select
                    value={destBankId}
                    onChange={(e) => setDestBankId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                  >
                    {branchBanks
                      .filter((b) => transferType !== "BANK_TO_BANK" || b.id !== srcBankId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} — {b.bankName} (Current: {formatMoney(b.currentBalance, b.currency)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer Amount ({activeBranch?.currency || "INR"}) *
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Advice #</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Bank Wire #1092"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
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
                <Button type="submit" disabled={loading || !amountInput} className="bg-indigo-600 hover:bg-indigo-700 font-semibold">
                  Execute Transfer
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
              <RotateCcw className="size-5 text-rose-600" /> Reverse Company Transfer
            </h3>
            <p className="text-xs text-slate-500">
              Atomically reverses both transfer legs. Verifies destination account has sufficient available funds for reversing debit.
            </p>

            <textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Enter mandatory reason for transfer reversal..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReversalModalId(null)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReverseTransfer} disabled={loading || !reversalReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                Confirm Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
