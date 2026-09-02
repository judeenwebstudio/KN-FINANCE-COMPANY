"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import type { LoanDTO } from "@/lib/serializers";

const statusTones: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "info",
  ACTIVE: "success",
  COMPLETED: "success",
  REJECTED: "danger",
  DEFAULTED: "danger",
  CANCELLED: "neutral",
};

const tabs = ["ALL", "PENDING", "APPROVED", "ACTIVE", "COMPLETED", "REJECTED"] as const;

export function AdminLoansClient({ loans }: { loans: LoanDTO[] }) {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = loans.filter((l) => {
    const matchesTab = activeTab === "ALL" || l.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      l.loanNumber.toLowerCase().includes(q) ||
      (l.memberName && l.memberName.toLowerCase().includes(q)) ||
      (l.memberNumber && l.memberNumber.toLowerCase().includes(q)) ||
      (l.productName && l.productName.toLowerCase().includes(q)) ||
      (l.branchName && l.branchName.toLowerCase().includes(q));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loans Management</h1>
        <p className="text-sm text-slate-500">
          Review loan applications, issue approvals, reject applications, and execute atomic disbursements.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => {
          const count =
            tab === "ALL"
              ? loans.length
              : loans.filter((l) => l.status === tab).length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  isActive ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by loan #, member name, or member #..."
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Loan Number</th>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Branch</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Principal</th>
                <th className="px-5 py-3.5">Term</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Applied Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    No loans found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-900">
                      {l.loanNumber}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{l.memberName ?? "Member"}</div>
                      <div className="text-xs text-slate-400">{l.memberNumber}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{l.branchName}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {l.productName ?? "Standard Product"}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatMoney(l.principalAmount, l.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {l.termMonths} mo ({l.repaymentFrequency.toLowerCase()})
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge tone={statusTones[l.status] ?? "neutral"}>
                        {l.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(l.applicationDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/loans/${l.id}`}>
                          <Eye className="mr-1 size-3.5" /> Details
                        </Link>
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
