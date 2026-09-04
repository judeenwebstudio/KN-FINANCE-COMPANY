"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Download, AlertTriangle, PhoneCall, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { CollectionNoteModal } from "../collections/collection-note-modal";
import { RecordRepaymentModal } from "../loan-repayments/record-repayment-modal";
import type { LoanDTO, AccountDTO } from "@/lib/serializers";

export type OverdueRowData = {
  loanId: string;
  loanNumber: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  branchId: string;
  branchName: string;
  currency: string;
  totalOverdueAmount: string;
  overduePrincipal: string;
  overdueInterest: string;
  overdueFees: string;
  overduePenalties: string;
  oldestDueDate: string | null;
  daysPastDue: number;
  overdueInstallmentsCount: number;
  totalOutstandingBalance: string;
  agingBucket: "CURRENT" | "1-30" | "31-60" | "61-90" | "90+";
  lastCollectionAction?: string | null;
  lastCollectionDate?: string | null;
  followUpDate?: string | null;
  promiseToPayAmount?: string | null;
  promiseToPayDate?: string | null;
};

type OverdueClientProps = {
  rows: OverdueRowData[];
  summary: {
    totalOverdueLoans: number;
    totalOverdueAmount: string;
    totalOverduePrincipal: string;
    totalPenaltiesOutstanding: string;
  };
  activeLoans: LoanDTO[];
  memberAccounts: Record<string, AccountDTO[]>;
};

export function AdminOverdueClient({
  rows,
  summary,
  activeLoans,
  memberAccounts,
}: OverdueClientProps) {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<string>("ALL");

  const [collectionModalData, setCollectionModalData] = useState<{
    loanId: string;
    loanNumber: string;
    memberName: string;
  } | null>(null);

  const [repaymentLoan, setRepaymentLoan] = useState<LoanDTO | null>(null);

  const filtered = rows.filter((r) => {
    const matchesBucket = bucketFilter === "ALL" || r.agingBucket === bucketFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      r.loanNumber.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.memberNumber.toLowerCase().includes(q) ||
      r.branchName.toLowerCase().includes(q);
    return matchesBucket && matchesSearch;
  });

  function exportCSV() {
    const headers = [
      "Loan Number",
      "Member Name",
      "Member Number",
      "Branch",
      "Aging Bucket",
      "Days Past Due",
      "Overdue Installments",
      "Principal Overdue",
      "Interest Overdue",
      "Fees Overdue",
      "Penalties Overdue",
      "Total Overdue",
      "Total Outstanding",
      "Follow-up Date",
      "Promise Date",
      "Promise Amount",
    ];

    const csvRows = filtered.map((r) => [
      r.loanNumber,
      `"${r.memberName}"`,
      r.memberNumber,
      `"${r.branchName}"`,
      r.agingBucket,
      r.daysPastDue,
      r.overdueInstallmentsCount,
      r.overduePrincipal,
      r.overdueInterest,
      r.overdueFees,
      r.overduePenalties,
      r.totalOverdueAmount,
      r.totalOutstandingBalance,
      r.followUpDate ? new Date(r.followUpDate).toLocaleDateString() : "",
      r.promiseToPayDate ? new Date(r.promiseToPayDate).toLocaleDateString() : "",
      r.promiseToPayAmount ?? "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KNFinance_Overdue_Aging_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <AlertTriangle className="size-6 text-rose-600" /> Overdue Management & Collections
          </h1>
          <p className="text-sm text-slate-500">
            Monitor delinquent loan accounts, penalties, portfolio aging buckets, and collection actions.
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="shadow-xs">
          <Download className="mr-2 size-4" /> Export Aging Report (CSV)
        </Button>
      </div>

      {/* Delinquency Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
          <span className="text-xs font-semibold text-rose-700 block">Total Overdue Loans</span>
          <span className="text-2xl font-extrabold text-rose-900 mt-1 block">{summary.totalOverdueLoans}</span>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
          <span className="text-xs font-semibold text-rose-700 block">Total Overdue Amount</span>
          <span className="text-2xl font-extrabold text-rose-900 mt-1 block">
            {formatMoney(summary.totalOverdueAmount, "INR")}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Overdue Principal</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {formatMoney(summary.totalOverduePrincipal, "INR")}
          </span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <span className="text-xs font-semibold text-amber-800 block">Penalties Outstanding</span>
          <span className="text-xl font-bold text-amber-950 mt-1 block">
            {formatMoney(summary.totalPenaltiesOutstanding, "INR")}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by loan #, member name, or branch..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            <option value="ALL">All Aging Buckets</option>
            <option value="1-30">1–30 Days Past Due</option>
            <option value="31-60">31–60 Days Past Due</option>
            <option value="61-90">61–90 Days Past Due</option>
            <option value="90+">90+ Days Past Due</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Loan #</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Branch</th>
                <th className="px-5 py-3.5">Aging Bucket</th>
                <th className="px-5 py-3.5">Overdue Amount</th>
                <th className="px-5 py-3.5">Penalty</th>
                <th className="px-5 py-3.5">Collection Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No delinquent loan accounts found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.loanId} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-semibold text-indigo-700">
                      <Link href={`/admin/loans/${r.loanId}`} className="hover:underline">
                        {r.loanNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{r.memberName}</div>
                      <div className="text-xs text-slate-400">{r.memberNumber}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{r.branchName}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge
                        tone={
                          r.agingBucket === "90+"
                            ? "danger"
                            : r.agingBucket === "61-90"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {r.agingBucket} ({r.daysPastDue}d)
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 font-bold text-rose-700 whitespace-nowrap">
                      {formatMoney(r.totalOverdueAmount, r.currency)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-amber-800 whitespace-nowrap">
                      {formatMoney(r.overduePenalties, r.currency)}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {r.promiseToPayAmount ? (
                        <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-900 border border-indigo-100">
                          <span className="font-bold">PTP:</span> {formatMoney(r.promiseToPayAmount, r.currency)} on{" "}
                          {r.promiseToPayDate ? new Date(r.promiseToPayDate).toLocaleDateString() : "N/A"}
                        </div>
                      ) : r.followUpDate ? (
                        <div className="text-slate-600">
                          Follow-up: <span className="font-medium">{new Date(r.followUpDate).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">No action logged</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCollectionModalData({
                            loanId: r.loanId,
                            loanNumber: r.loanNumber,
                            memberName: r.memberName,
                          })
                        }
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        <PhoneCall className="mr-1 size-3.5" /> Log Action
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const targetLoan = activeLoans.find((l) => l.id === r.loanId);
                          if (targetLoan) setRepaymentLoan(targetLoan);
                        }}
                      >
                        <DollarSign className="mr-1 size-3.5" /> Repay
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {collectionModalData && (
        <CollectionNoteModal
          isOpen={true}
          onClose={() => setCollectionModalData(null)}
          loanId={collectionModalData.loanId}
          loanNumber={collectionModalData.loanNumber}
          memberName={collectionModalData.memberName}
        />
      )}

      {repaymentLoan && (
        <RecordRepaymentModal
          isOpen={true}
          onClose={() => setRepaymentLoan(null)}
          initialLoan={repaymentLoan}
          activeLoans={activeLoans}
          memberAccounts={memberAccounts}
        />
      )}
    </div>
  );
}
