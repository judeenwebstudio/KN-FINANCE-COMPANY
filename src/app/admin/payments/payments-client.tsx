"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";

export type UpcomingPaymentRow = {
  scheduleId: string;
  loanId: string;
  loanNumber: string;
  memberName: string;
  memberNumber: string;
  branchId: string;
  branchName: string;
  installmentNumber: number;
  dueDate: string;
  currency: string;
  principalDue: string;
  interestDue: string;
  feeDue: string;
  totalDue: string;
  totalPaid: string;
  remainingAmount: string;
  status: string;
};

const statusTones: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "danger",
};

export function UpcomingPaymentsClient({ rows }: { rows: UpcomingPaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = rows.filter((r) => {
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      r.loanNumber.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.memberNumber.toLowerCase().includes(q) ||
      r.branchName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upcoming Payments</h1>
        <p className="text-sm text-slate-500">
          Track upcoming and overdue loan installment payments across accessible branches.
        </p>
      </div>

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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="PARTIAL">Partial Only</option>
            <option value="PENDING">Pending Only</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Loan #</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Branch</th>
                <th className="px-5 py-3.5">Inst #</th>
                <th className="px-5 py-3.5">Total Due</th>
                <th className="px-5 py-3.5">Paid</th>
                <th className="px-5 py-3.5">Remaining</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    No upcoming or overdue payments found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.scheduleId} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-900">
                      {new Date(r.dueDate).toLocaleDateString()}
                    </td>
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
                    <td className="px-5 py-4 font-medium text-slate-800">#{r.installmentNumber}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatMoney(r.totalDue, r.currency)}
                    </td>
                    <td className="px-5 py-4 text-emerald-700">
                      {formatMoney(r.totalPaid, r.currency)}
                    </td>
                    <td className="px-5 py-4 font-bold text-rose-700">
                      {formatMoney(r.remainingAmount, r.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge tone={statusTones[r.status] ?? "neutral"}>
                        {r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/loans/${r.loanId}`}>View Loan</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
