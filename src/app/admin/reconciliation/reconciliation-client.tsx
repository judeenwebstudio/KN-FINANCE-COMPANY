"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Eye, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { CurrencyBadge } from "@/components/money-display";
import type { ReconciliationDashboardSummary } from "@/lib/reconciliation/selectors";
import type { BankStatementImportDTO } from "@/lib/serializers";

type ReconciliationClientProps = {
  summary: ReconciliationDashboardSummary;
  recentImports: BankStatementImportDTO[];
  bankAccounts: Array<{ id: string; name: string; accountNumber: string; currency: string }>;
};

export function ReconciliationClient({ summary, recentImports, bankAccounts }: ReconciliationClientProps) {
  const router = useRouter();
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a CSV bank statement file to upload.");
      return;
    }
    if (!selectedBankAccountId) {
      setErrorMsg("Please select a target Bank Account.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const fileContent = await file.text();
      const res = await fetch("/api/admin/reconciliation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: selectedBankAccountId,
          fileName: file.name,
          fileContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process bank statement import.");
      }

      setSuccessMsg(`Import #${data.importNumber} processed successfully! Valid lines: ${data.validRowCount}, Errors: ${data.invalidRowCount}`);
      setFile(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during import.";
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bank Reconciliation"
        description="Authoritative bank reconciliation dashboard. Match external CSV bank statement activity against internal bank transactions without altering balances."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Imports" value={summary.totalImports.toString()} hint="Processed CSV statements" icon={FileSpreadsheet} tone="indigo" />
        <StatCard label="Statement Lines" value={summary.totalStatementLines.toLocaleString()} hint={`${summary.matchedLinesCount} matched / ${summary.unmatchedLinesCount} unmatched`} icon={Landmark} tone="emerald" />
        <StatCard label="Reconciliation Rate" value={summary.reconciliationRateCount !== null ? `${summary.reconciliationRateCount}%` : "N/A"} hint="Eligible line count basis" icon={CheckCircle2} tone="violet" />
        <StatCard label="Unreconciled Bank Txs" value={summary.unreconciledInternalTxCount.toString()} hint="Internal transactions to match" icon={AlertCircle} tone="amber" />
        <StatCard label="Ignored Lines" value={summary.ignoredLinesCount.toString()} hint="Audited ignored items" icon={Eye} tone="indigo" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* CSV Statement Import Form */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Upload className="size-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Bank Statement</h2>
              <p className="text-xs text-slate-500">Upload a CSV statement file for reconciliation</p>
            </div>
          </div>

          <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
                <AlertCircle className="mr-1 inline size-4 text-rose-600" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Bank Account</label>
              <select
                aria-label="Target Bank Account"
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:bg-white"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.accountNumber}) — {acc.currency}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Statement CSV File</label>
              <input
                aria-label="Statement CSV File"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
              />
              <p className="mt-1 text-[11px] text-slate-500">Supported columns: Date, Description, Reference, Amount (or Debit/Credit), Balance</p>
            </div>

            <Button type="submit" disabled={uploading || !file} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {uploading ? "Processing Import..." : "Import Statement"}
            </Button>
          </form>
        </Card>

        {/* Bank Account Reconciliation Overview */}
        <Card className="overflow-hidden p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Bank Accounts Position</h2>
              <p className="text-xs text-slate-500">Reconciliation rate and unreconciled transaction count by account</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Bank Account</th>
                  <th className="py-2">Currency</th>
                  <th className="py-2 text-right">Matched / Total</th>
                  <th className="py-2 text-right">Unreconciled Txs</th>
                  <th className="py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.byBankAccount.length ? (
                  summary.byBankAccount.map((acc) => (
                    <tr key={acc.bankAccountId} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="py-3 font-semibold text-slate-800">
                        <Link href={`/admin/bank-accounts/${acc.bankAccountId}`} className="hover:text-indigo-600 hover:underline">
                          {acc.bankAccountName}
                        </Link>
                        <span className="block text-xs font-normal text-slate-400">{acc.accountNumber}</span>
                      </td>
                      <td className="py-3"><CurrencyBadge currency={acc.currency} /></td>
                      <td className="py-3 text-right font-medium text-slate-700">
                        {acc.matchedLinesCount} / {acc.matchedLinesCount + acc.unmatchedLinesCount}
                      </td>
                      <td className="py-3 text-right font-bold text-amber-700">{acc.unreconciledTxCount}</td>
                      <td className="py-3 text-right font-extrabold text-emerald-700">
                        {acc.reconciliationRatePercent !== null ? `${acc.reconciliationRatePercent}%` : "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-500">No active bank accounts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Imports Table */}
      <div className="mt-6">
        <Card className="overflow-hidden p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Statement Imports</h2>
              <p className="text-xs text-slate-500">Audit trail of processed CSV imports and match execution status</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Import #</th>
                  <th className="py-2">Bank Account</th>
                  <th className="py-2">File Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Valid / Invalid</th>
                  <th className="py-2 text-right">Date Range</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.length ? (
                  recentImports.map((imp) => (
                    <tr key={imp.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="py-3 font-semibold text-indigo-700">{imp.importNumber}</td>
                      <td className="py-3 font-medium text-slate-800">{imp.bankAccountName || "N/A"}</td>
                      <td className="py-3 text-xs text-slate-600">{imp.fileName}</td>
                      <td className="py-3">
                        <StatusBadge tone={imp.status === "COMPLETED" || imp.status === "READY" ? "success" : imp.status === "FAILED" ? "danger" : "warning"}>
                          {imp.status}
                        </StatusBadge>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-700">
                        <span className="text-emerald-700">{imp.validRowCount}</span> / <span className="text-rose-600">{imp.invalidRowCount}</span>
                      </td>
                      <td className="py-3 text-right text-xs text-slate-500">
                        {imp.statementStartDate && imp.statementEndDate
                          ? `${imp.statementStartDate.slice(0, 10)} to ${imp.statementEndDate.slice(0, 10)}`
                          : "N/A"}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/admin/reconciliation/imports/${imp.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Review <ArrowUpRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">No statement imports recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
