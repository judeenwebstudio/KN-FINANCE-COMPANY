"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Building2, CreditCard,
  HandCoins, Mail, Phone, ShieldCheck,
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  ChevronLeft, ChevronRight, Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { MemberDocumentsSection } from "@/components/member-documents-section";
import { EditMemberModal } from "../edit-member-modal";
import type { Member360ProfileDTO } from "@/lib/members/member-service";

type TabKey = "overview" | "accounts" | "loans" | "repayments" | "schedules" | "transactions" | "requests" | "collections" | "documents";

export function Member360Client({
  profile,
  canEdit,
}: {
  profile: Member360ProfileDTO;
  canEdit: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { header, summary, accounts, loans, repayments, schedules, transactions, depositRequests, withdrawalRequests, collectionNotes } = profile;

  const handleTxPageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("txPage", newPage.toString());
    router.push(`/admin/members/${header.id}?${params.toString()}`);
  };

  const formatCurrency = (val: number | string, currency: string = header.currency) => {
    const num = typeof val === "number" ? val : parseFloat(val || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "—";
    return new Date(isoStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb & Back Action ── */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/members"
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Member Directory
        </Link>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            className="gap-1.5 text-xs text-slate-700 hover:text-slate-900"
          >
            <Edit className="h-3.5 w-3.5" /> Edit Member Status & Profile
          </Button>
        )}
      </div>

      {/* ── Member 360 Header ── */}
      <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-[#071426] text-white shadow-md rounded-2xl border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xl font-bold font-serif">
              {header.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">{header.name}</h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-700/80 text-amber-300 border border-amber-400/20 font-semibold">
                  {header.memberNumber}
                </span>
                <StatusBadge
                  tone={
                    header.status === "ACTIVE"
                      ? "success"
                      : header.status === "SUSPENDED"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {header.status}
                </StatusBadge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {header.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {header.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" /> {header.branchName} ({header.branchCode})
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> ID: {header.maskedIdentityNumber || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 text-xs text-slate-300 border-t md:border-t-0 md:border-l border-slate-700/60 pt-4 md:pt-0 md:pl-6 shrink-0">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Member Since</span>
              <span className="font-medium text-white">{formatDate(header.createdAt)}</span>
            </div>
            {header.dateOfBirth && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date of Birth</span>
                <span className="font-medium text-white">{header.dateOfBirth}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Summary KPI Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Accounts</div>
          <div className="text-xl font-bold text-slate-900 mt-1 flex items-baseline justify-between">
            <span>{summary.totalAccounts}</span>
            <span className="text-xs font-normal text-slate-400">{summary.activeAccounts} active</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Account Balance</div>
          <div className="text-lg font-bold text-emerald-700 mt-1 truncate">
            {formatCurrency(summary.totalAccountBalance)}
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Loans</div>
          <div className="text-xl font-bold text-slate-900 mt-1 flex items-baseline justify-between">
            <span>{summary.totalLoans}</span>
            <span className="text-xs font-normal text-slate-400">{summary.activeLoans} active</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Loan Outstanding</div>
          <div className="text-lg font-bold text-indigo-700 mt-1 truncate">
            {formatCurrency(summary.totalLoanPrincipalOutstanding)}
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overdue Loans</div>
          <div className="text-xl font-bold mt-1 flex items-center justify-between">
            <span className={summary.overdueLoans > 0 ? "text-rose-600 font-extrabold" : "text-slate-900"}>
              {summary.overdueLoans}
            </span>
            {summary.overdueLoans > 0 && <AlertTriangle className="h-4 w-4 text-rose-500" />}
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Repayments</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{repayments.length}</div>
        </Card>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto text-xs font-medium">
          {[
            { key: "overview", label: "Overview", count: null },
            { key: "accounts", label: "Accounts", count: accounts.length },
            { key: "loans", label: "Loans", count: loans.length },
            { key: "repayments", label: "Repayments", count: repayments.length },
            { key: "schedules", label: "Schedules", count: schedules.length },
            { key: "transactions", label: "Transactions", count: transactions.pagination.total },
            { key: "requests", label: "Requests", count: depositRequests.length + withdrawalRequests.length },
            { key: "collections", label: "Collections", count: collectionNotes.length },
            { key: "documents", label: "Documents & KYC", count: null },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as TabKey)}
              className={`py-3 px-1 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? "border-[#275d4f] text-[#275d4f] font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {t.label}
              {t.count !== null && (
                <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] ${
                  activeTab === t.key ? "bg-[#275d4f]/10 text-[#275d4f]" : "bg-slate-100 text-slate-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Contents ── */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Accounts Summary */}
            <Card className="p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#275d4f]" /> Linked Deposit Accounts
                </h3>
                <button onClick={() => setActiveTab("accounts")} className="text-xs font-semibold text-[#275d4f] hover:underline">
                  View All ({accounts.length})
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No linked accounts found.</div>
              ) : (
                <div className="space-y-3">
                  {accounts.slice(0, 3).map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <div className="font-bold text-xs text-slate-900 font-mono">{acc.accountNumber}</div>
                        <div className="text-[11px] text-slate-500">{acc.accountTypeName || acc.accountType}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xs text-slate-900">{formatCurrency(acc.balance, acc.currency)}</div>
                        <div className="mt-1">
                          <StatusBadge tone={acc.status === "ACTIVE" ? "success" : "neutral"}>
                            {acc.status}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Loans Summary */}
            <Card className="p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-indigo-600" /> Active & Recent Loans
                </h3>
                <button onClick={() => setActiveTab("loans")} className="text-xs font-semibold text-[#275d4f] hover:underline">
                  View All ({loans.length})
                </button>
              </div>

              {loans.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No linked loans found.</div>
              ) : (
                <div className="space-y-3">
                  {loans.slice(0, 3).map((l) => (
                    <div key={l.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-900 font-mono">{l.loanNumber}</span>
                          <span className="text-[11px] text-slate-500 ml-2">{l.productName}</span>
                        </div>
                        <StatusBadge tone={l.status === "ACTIVE" ? "success" : l.status === "DEFAULTED" ? "danger" : "neutral"}>
                          {l.status}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                        <span>Principal: <strong>{formatCurrency(l.principalAmount, l.currency)}</strong></span>
                        <span>Outstanding: <strong className="text-indigo-700">{formatCurrency(l.outstandingAmount, l.currency)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar Details */}
          <div className="space-y-6">
            <Card className="p-5 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Member Metadata</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Residential Address</span>
                  <span className="text-slate-800 font-medium">{header.address}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Branch Code</span>
                  <span className="text-slate-800 font-mono">{header.branchCode} ({header.branchName})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Record Updated</span>
                  <span className="text-slate-600">{formatDate(header.updatedAt)}</span>
                </div>
              </div>
            </Card>

            {collectionNotes.length > 0 && (
              <Card className="p-5 border border-amber-200 bg-amber-50/50 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Recent Collection Activity
                </h3>
                <div className="text-xs text-amber-900 space-y-2">
                  <p className="line-clamp-2 italic">&quot;{collectionNotes[0].notes}&quot;</p>
                  <div className="text-[10px] text-amber-700 flex justify-between">
                    <span>{collectionNotes[0].actionType}</span>
                    <span>{formatDate(collectionNotes[0].actionDate)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 2. ACCOUNTS TAB */}
      {activeTab === "accounts" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Member Accounts ({accounts.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Account Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Guarantee Locked</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Opened Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No deposit accounts found.</td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{acc.accountNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{acc.accountTypeName || acc.accountType}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{acc.currency}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(acc.balance, acc.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(acc.loanGuarantee, acc.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={acc.status === "ACTIVE" ? "success" : "neutral"}>
                          {acc.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(acc.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. LOANS TAB */}
      {activeTab === "loans" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Member Loans ({loans.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Overdue Info</th>
                  <th className="px-4 py-3">Applied Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No loan records found.</td>
                  </tr>
                ) : (
                  loans.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{l.loanNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{l.productName || "Standard Loan"}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {formatCurrency(l.principalAmount, l.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        {formatCurrency(l.paidAmount, l.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-700">
                        {formatCurrency(l.outstandingAmount, l.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={l.status === "ACTIVE" ? "success" : l.status === "DEFAULTED" ? "danger" : "neutral"}>
                          {l.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.overdueDays > 0 ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {l.overdueDays}d overdue ({formatCurrency(l.overdueAmount, l.currency)})
                          </span>
                        ) : (
                          <span className="text-slate-400">On Track</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(l.applicationDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. REPAYMENTS TAB */}
      {activeTab === "repayments" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Repayment History ({repayments.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Repayment #</th>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Account #</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Interest</th>
                  <th className="px-4 py-3 text-right">Penalty</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {repayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">No repayment history recorded.</td>
                  </tr>
                ) : (
                  repayments.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.repaymentNumber}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{r.loanNumber}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{r.accountNumber}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(r.principalAmount)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(r.interestAmount)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(r.penaltyAmount)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(r.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={r.status === "POSTED" ? "success" : "danger"}>
                          {r.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 5. SCHEDULES TAB */}
      {activeTab === "schedules" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Repayment Schedules ({schedules.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Inst #</th>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Total Due</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3">Overdue Days</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No repayment schedules available.</td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">#{s.installmentNumber}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{s.loanNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(s.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(s.totalDue)}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(s.totalPaid)}</td>
                      <td className="px-4 py-3">
                        {s.overdueDays > 0 ? (
                          <span className="text-rose-600 font-bold">{s.overdueDays} days</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.status === "PAID" ? "success" : s.status === "OVERDUE" ? "danger" : "neutral"}>
                          {s.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. TRANSACTIONS TAB */}
      {activeTab === "transactions" && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Member Transactions Ledger</h3>
            <span className="text-xs text-slate-500 font-medium">Total: {transactions.pagination.total}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Account #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No transaction records found.</td>
                  </tr>
                ) : (
                  transactions.items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{tx.reference}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{tx.accountNumber || "—"}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{tx.type}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(tx.amount, tx.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={tx.status === "COMPLETED" ? "success" : tx.status === "FAILED" ? "danger" : "neutral"}>
                          {tx.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Transactions Bounded Pagination */}
          {transactions.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div>
                Page <strong>{transactions.pagination.page}</strong> of <strong>{transactions.pagination.totalPages}</strong> ({transactions.pagination.total} transactions)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactions.pagination.page <= 1}
                  onClick={() => handleTxPageChange(transactions.pagination.page - 1)}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactions.pagination.page >= transactions.pagination.totalPages}
                  onClick={() => handleTxPageChange(transactions.pagination.page + 1)}
                  className="h-7 px-2 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 7. REQUESTS TAB */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          <Card className="overflow-hidden border border-slate-200 shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-[#275d4f]" />
              <h3 className="text-xs font-bold text-slate-800">Deposit Requests ({depositRequests.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Request #</th>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {depositRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No deposit requests recorded.</td>
                    </tr>
                  ) : (
                    depositRequests.map((dr) => (
                      <tr key={dr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{dr.requestNumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{dr.accountNumber}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(dr.amount, dr.currency)}</td>
                        <td className="px-4 py-3 text-slate-700">{dr.paymentMethod || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={dr.status === "APPROVED" ? "success" : dr.status === "REJECTED" ? "danger" : "neutral"}>
                            {dr.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(dr.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200 shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-800">Withdrawal Requests ({withdrawalRequests.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Request #</th>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {withdrawalRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No withdrawal requests recorded.</td>
                    </tr>
                  ) : (
                    withdrawalRequests.map((wr) => (
                      <tr key={wr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{wr.requestNumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{wr.accountNumber}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">{formatCurrency(wr.amount, wr.currency)}</td>
                        <td className="px-4 py-3 text-slate-700">{wr.paymentMethod || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={wr.status === "APPROVED" ? "success" : wr.status === "REJECTED" ? "danger" : "neutral"}>
                            {wr.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(wr.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 8. COLLECTIONS TAB */}
      {activeTab === "collections" && (
        <Card className="p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800">Collection Notes & Overdue Activity ({collectionNotes.length})</h3>
          </div>

          {collectionNotes.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">No collection notes recorded for this member.</div>
          ) : (
            <div className="space-y-4">
              {collectionNotes.map((note) => (
                <div key={note.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">Loan: {note.loanNumber}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 font-semibold text-[10px] text-slate-700">
                        {note.actionType}
                      </span>
                    </div>
                    <span className="text-slate-500">{formatDate(note.actionDate)}</span>
                  </div>

                  <p className="text-xs text-slate-800 font-medium">{note.notes}</p>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                    <span>Logged by: <strong>{note.createdBy || "System"}</strong></span>
                    {note.followUpDate && <span>Follow Up: <strong>{formatDate(note.followUpDate)}</strong></span>}
                    {note.promiseToPayAmount && (
                      <span className="text-emerald-700 font-bold">
                        PTP Amount: {formatCurrency(note.promiseToPayAmount)} by {formatDate(note.promiseToPayDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 9. DOCUMENTS & KYC TAB */}
      {activeTab === "documents" && (
        <MemberDocumentsSection memberId={header.id} canManage={canEdit} />
      )}

      {/* Modals */}
      {editModalOpen && (
        <EditMemberModal
          memberId={header.id}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            setEditModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
