"use client";

import { useState } from "react";
import { Download, AlertCircle, CheckCircle2, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bulkImportMembersAction } from "./actions";

type BranchDTO = { id: string; name: string; code: string };

type CSVRow = {
  name: string;
  email: string;
  phone: string;
  address: string;
  identityNumber?: string;
};

export function BulkImportModal({
  branches,
  onClose,
  onSuccess,
}: {
  branches: BranchDTO[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || "");
  const [rawCsvText, setRawCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    successfulCount: number;
    failedCount: number;
    errors: Array<{ row: number; email: string; error: string }>;
  } | null>(null);

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,name,email,phone,address,identityNumber\nJohn Doe,john.doe@example.com,+1-555-0199,123 Main St,ID-990182\nJane Smith,jane.smith@example.com,+1-555-0200,456 Market St,ID-990183";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kn_finance_member_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsv = (text: string) => {
    setParseError(null);
    setResultSummary(null);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      setParseError("CSV must contain a header row and at least one data row.");
      setParsedRows([]);
      return;
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const nameIdx = header.indexOf("name");
    const emailIdx = header.indexOf("email");
    const phoneIdx = header.indexOf("phone");
    const addressIdx = header.indexOf("address");
    const identityIdx = header.indexOf("identitynumber");

    if (nameIdx === -1 || emailIdx === -1 || phoneIdx === -1 || addressIdx === -1) {
      setParseError("CSV header must include: name, email, phone, address (identityNumber is optional).");
      setParsedRows([]);
      return;
    }

    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length === 0 || cols.every((c) => !c)) continue;
      rows.push({
        name: cols[nameIdx] || "",
        email: cols[emailIdx] || "",
        phone: cols[phoneIdx] || "",
        address: cols[addressIdx] || "",
        identityNumber: identityIdx !== -1 ? cols[identityIdx] : undefined,
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!selectedBranchId) {
      setParseError("Please select a target branch for member import.");
      return;
    }
    if (parsedRows.length === 0) {
      setParseError("No valid rows to import.");
      return;
    }

    setImporting(true);
    setParseError(null);

    const res = await bulkImportMembersAction(selectedBranchId, parsedRows);
    setImporting(false);

    if (!res.success || !res.data) {
      setParseError(res.error || "Bulk import failed.");
      return;
    }

    setResultSummary({
      successfulCount: res.data.successfulCount,
      failedCount: res.data.failedCount,
      errors: res.data.errors,
    });

    if (res.data.successfulCount > 0) {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <Card className="w-full max-w-3xl border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Bulk Import Members</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Branch & Template */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Branch *</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full h-9 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" /> Download CSV Template
            </Button>
          </div>
        </div>

        {/* Step 2: Upload or Paste */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Upload CSV File or Paste Content</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <textarea
            rows={4}
            value={rawCsvText}
            placeholder="Or paste CSV content here..."
            onChange={(e) => {
              setRawCsvText(e.target.value);
              parseCsv(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {parseError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Step 3: Parsed Preview */}
        {parsedRows.length > 0 && !resultSummary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-900">Parsed Preview ({parsedRows.length} rows)</span>
              <span className="text-[11px] text-emerald-600 font-medium">Ready for validation & import</span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 text-slate-700 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Identity Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parsedRows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-900">{r.name}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{r.email}</td>
                      <td className="px-3 py-1.5 text-slate-600">{r.phone}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-500">{r.identityNumber || "—"}</td>
                    </tr>
                  ))}
                  {parsedRows.length > 10 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-center text-slate-500 italic">
                        ...and {parsedRows.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Import Result Summary */}
        {resultSummary && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">Import Summary</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {resultSummary.successfulCount} Imported
                </span>
                {resultSummary.failedCount > 0 && (
                  <span className="text-rose-700 font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {resultSummary.failedCount} Failed
                  </span>
                )}
              </div>
            </div>

            {resultSummary.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-md border border-rose-200 bg-white p-2.5 text-xs text-rose-800 space-y-1">
                {resultSummary.errors.map((e, idx) => (
                  <div key={idx} className="flex justify-between font-mono text-[11px]">
                    <span>Row {e.row} ({e.email || "N/A"}):</span>
                    <span className="text-rose-600 font-sans">{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          {!resultSummary ? (
            <Button
              size="sm"
              onClick={handleImportSubmit}
              disabled={importing || parsedRows.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs"
            >
              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {importing ? "Importing..." : `Import ${parsedRows.length} Members`}
            </Button>
          ) : (
            <Button size="sm" onClick={onClose} className="bg-slate-900 text-xs">
              Done
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
