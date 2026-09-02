"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, ArrowLeft, Play, CheckCircle2, AlertTriangle, Eye, EyeOff, XCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { MoneyDisplay } from "@/components/money-display";
import type { BankStatementImportDTO, BankStatementLineDTO, BankReconciliationMatchDTO } from "@/lib/serializers";

type CandidateTx = {
  id: string;
  bankTransactionNumber: string;
  transactionDate: string;
  amount: string;
  direction: string;
  currency: string;
  reference: string | null;
  description: string | null;
  reconciliationStatus: string;
};

type ImportDetailsClientProps = {
  statementImport: BankStatementImportDTO;
  statementLines: BankStatementLineDTO[];
  matches: BankReconciliationMatchDTO[];
  candidateTransactions: CandidateTx[];
  errors: Array<{ id: string; lineNumber: number; field: string | null; reason: string; rawValue: string | null }>;
};

export function ImportDetailsClient({
  statementImport,
  statementLines,
  matches,
  candidateTransactions,
  errors,
}: ImportDetailsClientProps) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<"ALL" | "UNMATCHED" | "MATCHED" | "IGNORED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLine, setSelectedLine] = useState<BankStatementLineDTO | null>(null);
  const [selectedCandidateTxId, setSelectedCandidateTxId] = useState<string>("");
  const [unmatchReason, setUnmatchReason] = useState("");
  const [ignoreReason, setIgnoreReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeMatchesMap = new Map(
    matches.filter((m) => m.status === "ACTIVE").map((m) => [m.statementLineId, m])
  );

  const candidateTxMap = new Map(candidateTransactions.map((tx) => [tx.id, tx]));

  const filteredLines = statementLines.filter((l) => {
    if (filterStatus !== "ALL" && l.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = l.description.toLowerCase().includes(q);
      const matchRef = l.reference?.toLowerCase().includes(q);
      const matchAmt = l.amount.includes(q);
      return matchDesc || matchRef || matchAmt;
    }
    return true;
  });

  async function handleAutoMatch() {
    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reconciliation/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: statementImport.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auto-match failed.");

      setMsg({ type: "success", text: `Auto-match completed! Created ${data.matchesCreated} new matches.` });
      router.refresh();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Auto-match failed.";
      setMsg({ type: "error", text });
    } finally {
      setProcessing(false);
    }
  }

  async function handleManualMatchSubmit(lineId: string) {
    if (!selectedCandidateTxId) {
      setMsg({ type: "error", text: "Please select an internal bank transaction to match." });
      return;
    }

    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reconciliation/manual-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementLineId: lineId, bankTransactionId: selectedCandidateTxId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Manual match failed.");

      setMsg({ type: "success", text: "Statement line matched successfully!" });
      setSelectedLine(null);
      setSelectedCandidateTxId("");
      router.refresh();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Manual match failed.";
      setMsg({ type: "error", text });
    } finally {
      setProcessing(false);
    }
  }

  async function handleUnmatchSubmit(matchId: string) {
    if (!unmatchReason.trim()) {
      setMsg({ type: "error", text: "An explicit unmatch reason is required." });
      return;
    }

    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reconciliation/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, unmatchReason: unmatchReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unmatch failed.");

      setMsg({ type: "success", text: "Match active record unmatched and restored to unreconciled." });
      setUnmatchReason("");
      setSelectedLine(null);
      router.refresh();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Unmatch failed.";
      setMsg({ type: "error", text });
    } finally {
      setProcessing(false);
    }
  }

  async function handleIgnoreSubmit(lineId: string, action: "IGNORE" | "UNIGNORE") {
    if (action === "IGNORE" && !ignoreReason.trim()) {
      setMsg({ type: "error", text: "A reason is required to ignore a statement line." });
      return;
    }

    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reconciliation/ignore-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementLineId: lineId, action, ignoreReason: ignoreReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ignore action failed.");

      setMsg({ type: "success", text: `Statement line ${action === "IGNORE" ? "marked IGNORED" : "restored to UNMATCHED"}.` });
      setIgnoreReason("");
      setSelectedLine(null);
      router.refresh();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Ignore action failed.";
      setMsg({ type: "error", text });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/reconciliation" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
          <ArrowLeft className="size-3" /> Back to Reconciliation Overview
        </Link>
      </div>

      <PageHeader
        title={`Statement Import ${statementImport.importNumber}`}
        description={`Bank: ${statementImport.bankAccountName || "N/A"} (${statementImport.currency}) — ${statementImport.fileName}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Lines" value={statementImport.rowCount.toString()} hint={`Valid: ${statementImport.validRowCount} | Invalid: ${statementImport.invalidRowCount}`} icon={Landmark} tone="indigo" />
        <StatCard label="Matched Lines" value={statementLines.filter((l) => l.status === "MATCHED").length.toString()} hint="Reconciled to internal ledger" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Unmatched Lines" value={statementLines.filter((l) => l.status === "UNMATCHED").length.toString()} hint="Pending reconciliation" icon={AlertTriangle} tone="amber" />
        <StatCard label="Import Status" value={statementImport.status} hint={statementImport.createdAt.slice(0, 10)} icon={Eye} tone="violet" />
      </div>

      {msg && (
        <div className={`mt-4 rounded-xl border p-4 text-xs font-semibold ${msg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {msg.text}
        </div>
      )}

      {/* Auto-match Trigger Card */}
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Conservative Auto-Match Engine</h2>
          <p className="text-xs text-slate-500">Automatically matches EXACT or unambiguous STRONG candidate pairs within ±2 calendar days</p>
        </div>
        <Button
          onClick={handleAutoMatch}
          disabled={processing || statementLines.filter((l) => l.status === "UNMATCHED").length === 0}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
        >
          <Play className="mr-1.5 size-4" />
          {processing ? "Executing Auto-Match..." : "Run Auto-Match Engine"}
        </Button>
      </Card>

      {/* Diagnostic Errors Section (if any invalid CSV rows exist) */}
      {errors.length > 0 && (
        <Card className="mt-6 border-rose-200 bg-rose-50/40 p-5">
          <div className="flex items-center gap-2 border-b border-rose-200 pb-2 text-rose-800">
            <AlertTriangle className="size-5 text-rose-600" />
            <h2 className="text-base font-bold">Invalid CSV Row Diagnostic Logs ({errors.length})</h2>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rose-200 font-semibold text-rose-700">
                  <th className="py-1.5">Line #</th>
                  <th className="py-1.5">Field</th>
                  <th className="py-1.5">Error Reason</th>
                  <th className="py-1.5">Raw Value</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => (
                  <tr key={err.id} className="border-b border-rose-100 text-rose-900">
                    <td className="py-1.5 font-bold">{err.lineNumber}</td>
                    <td className="py-1.5 font-semibold">{err.field || "N/A"}</td>
                    <td className="py-1.5">{err.reason}</td>
                    <td className="py-1.5 font-mono text-[11px] text-slate-700">{err.rawValue || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Statement Lines Table */}
      <div className="mt-6">
        <Card className="overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filter Status:</span>
              {(["ALL", "UNMATCHED", "MATCHED", "IGNORED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${filterStatus === st ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                aria-label="Search statement lines"
                type="text"
                placeholder="Search description, reference, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-medium focus:border-indigo-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Line #</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2">Direction</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length ? (
                  filteredLines.map((line) => {
                    const activeMatch = activeMatchesMap.get(line.id);
                    const matchedTx = activeMatch ? candidateTxMap.get(activeMatch.bankTransactionId) : null;
                    const isSelected = selectedLine?.id === line.id;

                    return (
                      <tr key={line.id} className={`border-b border-slate-100 transition-colors ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}>
                        <td className="py-3 font-bold text-slate-700">#{line.lineNumber}</td>
                        <td className="py-3 text-xs text-slate-600">{line.transactionDate.slice(0, 10)}</td>
                        <td className="py-3 max-w-xs font-medium text-slate-800 truncate" title={line.description}>
                          {line.description}
                        </td>
                        <td className="py-3 text-xs font-mono text-slate-500">{line.reference || "—"}</td>
                        <td className="py-3">
                          <StatusBadge tone={line.direction === "CREDIT" ? "success" : "neutral"}>{line.direction}</StatusBadge>
                        </td>
                        <td className="py-3 text-right font-extrabold text-slate-900">
                          <MoneyDisplay value={Number(line.amount)} currency={line.currency} />
                        </td>
                        <td className="py-3">
                          <StatusBadge tone={line.status === "MATCHED" ? "success" : line.status === "IGNORED" ? "neutral" : "warning"}>
                            {line.status}
                          </StatusBadge>
                          {matchedTx && (
                            <span className="block text-[11px] font-mono text-indigo-600">
                              Matched to {matchedTx.bankTransactionNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLine(isSelected ? null : line);
                              setSelectedCandidateTxId("");
                            }}
                            className="rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                          >
                            {isSelected ? "Close" : "Manage Match"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-500">No statement lines match the selected criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Selected Line Matching / Unmatching Panel */}
      {selectedLine && (
        <Card className="mt-6 border-indigo-200 bg-indigo-50/30 p-5">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-indigo-950">
                Manage Reconciliation for Line #{selectedLine.lineNumber} ({selectedLine.currency})
              </h2>
              <p className="text-xs text-indigo-700">
                Amount: <MoneyDisplay value={Number(selectedLine.amount)} currency={selectedLine.currency} /> | Direction: {selectedLine.direction} | Date: {selectedLine.transactionDate.slice(0, 10)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLine(null)}>
              <XCircle className="size-4" />
            </Button>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {/* Status UNMATCHED: Manual Match Options */}
            {selectedLine.status === "UNMATCHED" && (
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Unreconciled Candidate Bank Transaction to Match
                </h3>

                {candidateTransactions.filter((tx) => tx.direction === selectedLine.direction && Number(tx.amount) === Number(selectedLine.amount)).length > 0 ? (
                  <div className="space-y-2">
                    {candidateTransactions
                      .filter((tx) => tx.direction === selectedLine.direction && Number(tx.amount) === Number(selectedLine.amount))
                      .map((tx) => (
                        <label
                          key={tx.id}
                          className={`flex items-center justify-between rounded-xl border p-3 transition-colors cursor-pointer ${selectedCandidateTxId === tx.id ? "border-indigo-600 bg-indigo-100/70" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="candidateTx"
                              value={tx.id}
                              checked={selectedCandidateTxId === tx.id}
                              onChange={() => setSelectedCandidateTxId(tx.id)}
                              className="size-4 text-indigo-600"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-900">{tx.bankTransactionNumber} — {tx.reference || "No Ref"}</p>
                              <p className="text-[11px] text-slate-500">{tx.transactionDate.slice(0, 10)} | {tx.description || "No description"}</p>
                            </div>
                          </div>
                          <span className="font-extrabold text-slate-900">
                            <MoneyDisplay value={Number(tx.amount)} currency={tx.currency} />
                          </span>
                        </label>
                      ))}

                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={() => handleManualMatchSubmit(selectedLine.id)}
                        disabled={processing || !selectedCandidateTxId}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs"
                      >
                        Confirm Manual Match
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No unreconciled candidate BankTransactions with matching amount and direction found.</p>
                )}

                <div className="mt-6 border-t border-indigo-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-700">Ignore Line Option</h4>
                  <div className="mt-2 flex gap-2">
                    <input
                      aria-label="Ignore reason"
                      type="text"
                      placeholder="Reason for ignoring (e.g. non-operational fee)"
                      value={ignoreReason}
                      onChange={(e) => setIgnoreReason(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium"
                    />
                    <Button
                      onClick={() => handleIgnoreSubmit(selectedLine.id, "IGNORE")}
                      disabled={processing || !ignoreReason.trim()}
                      variant="outline"
                      className="rounded-xl text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <EyeOff className="mr-1 size-3" /> Ignore Line
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status MATCHED: Auditable Unmatch Option */}
            {selectedLine.status === "MATCHED" && (
              <div className="space-y-4 md:col-span-2">
                {activeMatchesMap.get(selectedLine.id) && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                    <p className="font-semibold">
                      Active Match: {activeMatchesMap.get(selectedLine.id)?.matchType} Match | Matched at {activeMatchesMap.get(selectedLine.id)?.matchedAt.slice(0, 10)}
                    </p>
                  </div>
                )}

                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Unmatch Statement Line (Preserves Audit History)
                </h3>
                <p className="text-xs text-slate-600">
                  Unmatching restores the internal BankTransaction to UNRECONCILED and statement line to UNMATCHED. Financial balances are 100% untouched.
                </p>

                <div className="flex gap-2">
                  <input
                    aria-label="Unmatch reason"
                    type="text"
                    placeholder="Explicit unmatch reason (Required)"
                    value={unmatchReason}
                    onChange={(e) => setUnmatchReason(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium"
                  />
                  <Button
                    onClick={() => {
                      const m = activeMatchesMap.get(selectedLine.id);
                      if (m) handleUnmatchSubmit(m.id);
                    }}
                    disabled={processing || !unmatchReason.trim()}
                    className="rounded-xl bg-rose-600 text-xs hover:bg-rose-700"
                  >
                    Confirm Unmatch
                  </Button>
                </div>
              </div>
            )}

            {/* Status IGNORED: Restore Option */}
            {selectedLine.status === "IGNORED" && (
              <div className="space-y-4 md:col-span-2">
                <p className="text-xs text-slate-600">
                  Line is currently IGNORED. Reason: <span className="font-semibold text-slate-800">{selectedLine.ignoreReason || "None provided"}</span>
                </p>
                <Button
                  onClick={() => handleIgnoreSubmit(selectedLine.id, "UNIGNORE")}
                  disabled={processing}
                  className="rounded-xl bg-indigo-600 text-xs hover:bg-indigo-700"
                >
                  <Eye className="mr-1 size-3" /> Restore Line to UNMATCHED
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
