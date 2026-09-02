"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, DollarSign, Calendar,
  LoaderCircle, PhoneCall, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { approveLoanAction, rejectLoanAction, disburseLoanAction } from "../actions";
import { RecordRepaymentModal } from "../../loan-repayments/record-repayment-modal";
import { CollectionNoteModal } from "../../collections/collection-note-modal";
import type { LoanDTO, AccountDTO } from "@/lib/serializers";

type DetailsClientProps = {
  loan: LoanDTO;
  memberAccounts: AccountDTO[];
  allActiveLoans: LoanDTO[];
  memberAccountsMap: Record<string, AccountDTO[]>;
};

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

export function AdminLoanDetailsClient({
  loan: initialLoan,
  memberAccounts,
  allActiveLoans,
  memberAccountsMap,
}: DetailsClientProps) {
  const [loan, setLoan] = useState<LoanDTO>(initialLoan);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    memberAccounts[0]?.id ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    const res = await approveLoanAction(loan.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setLoan(res.data);
      setApproveModalOpen(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await rejectLoanAction(loan.id, rejectionReason);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setLoan(res.data);
      setRejectModalOpen(false);
    }
  }

  async function handleDisburse() {
    if (!selectedAccountId) {
      setError("Please select a destination account for disbursement.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await disburseLoanAction(loan.id, selectedAccountId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setLoan(res.data);
      setDisburseModalOpen(false);
    }
  }

  // Calculate schedule totals and delinquency
  const schedules = loan.repaymentSchedules ?? [];
  let overduePrincipal = 0;
  let overdueInterest = 0;
  let overdueFees = 0;
  let overduePenalties = 0;
  let maxOverdueDays = 0;

  const now = new Date();
  for (const s of schedules) {
    const dueTime = new Date(s.dueDate).getTime();
    const isPastDue = now.getTime() > dueTime;
    const pRem = Math.max(0, Number(s.principalDue) - Number(s.principalPaid));
    const iRem = Math.max(0, Number(s.interestDue) - Number(s.interestPaid));
    const fRem = Math.max(0, Number(s.feeDue) - Number(s.feePaid));
    const penRem = Math.max(0, Number(s.penaltyDue) - Number(s.penaltyPaid));
    const instRem = pRem + iRem + fRem + penRem;

    if (isPastDue && instRem > 0) {
      overduePrincipal += pRem;
      overdueInterest += iRem;
      overdueFees += fRem;
      overduePenalties += penRem;
      if (s.overdueDays > maxOverdueDays) maxOverdueDays = s.overdueDays;
    }
  }

  const totalOverdueAmount = overduePrincipal + overdueInterest + overdueFees + overduePenalties;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/loans">
            <ArrowLeft className="mr-2 size-4" /> Back to Loans List
          </Link>
        </Button>
        <StatusBadge tone={statusTones[loan.status] ?? "neutral"}>{loan.status}</StatusBadge>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Main Loan Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{loan.loanNumber}</h1>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600">
                {loan.productName ?? "Loan"}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Member: <span className="font-semibold text-slate-800">{loan.memberName}</span> ({loan.memberNumber}) • Branch: {loan.branchName}
            </p>
          </div>

          {/* Action Triggers for Admin */}
          <div className="flex flex-wrap items-center gap-2">
            {loan.status === "PENDING" && (
              <>
                <Button onClick={() => setApproveModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                  <CheckCircle2 className="mr-2 size-4" /> Approve Loan
                </Button>
                <Button onClick={() => setRejectModalOpen(true)} variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50">
                  <XCircle className="mr-2 size-4" /> Reject Loan
                </Button>
              </>
            )}

            {loan.status === "APPROVED" && (
              <Button onClick={() => setDisburseModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                <DollarSign className="mr-2 size-4" /> Disburse Funds
              </Button>
            )}

            {loan.status === "ACTIVE" && (
              <>
                <Button onClick={() => setCollectionModalOpen(true)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <PhoneCall className="mr-2 size-4" /> Log Collection Action
                </Button>

                <Button onClick={() => setRepaymentModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                  <DollarSign className="mr-2 size-4" /> Record Repayment
                </Button>
              </>
            )}
          </div>
        </div>

        {loan.rejectionReason && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="font-bold">Rejection Reason:</span> {loan.rejectionReason}
          </div>
        )}

        {/* Delinquency Alert Banner if Overdue */}
        {totalOverdueAmount > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <AlertTriangle className="size-5 text-rose-600 shrink-0" />
              <span>FACILITY DELINQUENT: {formatMoney(totalOverdueAmount, loan.currency)} OVERDUE ({maxOverdueDays} Days Past Due)</span>
            </div>
            <div>
              Overdue Principal: {formatMoney(overduePrincipal, loan.currency)} | Penalties: {formatMoney(overduePenalties, loan.currency)}
            </div>
          </div>
        )}

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs text-slate-500">Principal Amount</span>
            <span className="text-lg font-bold text-slate-900">
              {formatMoney(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs text-slate-500">Total Paid</span>
            <span className="text-lg font-bold text-emerald-700">
              {formatMoney(loan.paidAmount, loan.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <span className="block text-xs font-semibold text-indigo-700">Outstanding Balance</span>
            <span className="text-lg font-bold text-indigo-900">
              {formatMoney(Number(loan.totalPayable) - Number(loan.paidAmount), loan.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs text-slate-500">Total Payable</span>
            <span className="text-lg font-bold text-slate-900">
              {formatMoney(loan.totalPayable, loan.currency)}
            </span>
          </div>
        </div>

        {/* Repayment Schedule */}
        {schedules.length > 0 && (
          <div className="pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="size-5 text-indigo-600" /> Repayment Schedule
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Principal</th>
                    <th className="px-4 py-3">Interest</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">Penalty</th>
                    <th className="px-4 py-3">Total Due</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {schedules.map((row) => {
                    const dueTime = new Date(row.dueDate).getTime();
                    const isPastDue = now.getTime() > dueTime;
                    const totDue = Number(row.totalDue) + Number(row.penaltyDue);
                    const remaining = Math.max(0, totDue - Number(row.totalPaid));
                    const isRowOverdue = isPastDue && remaining > 0;

                    return (
                      <tr key={row.id} className={isRowOverdue ? "bg-rose-50/50" : "hover:bg-slate-50/50"}>
                        <td className="px-4 py-3 font-medium">{row.installmentNumber}</td>
                        <td className="px-4 py-3 font-medium">{new Date(row.dueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{formatMoney(row.principalDue, loan.currency)}</td>
                        <td className="px-4 py-3">{formatMoney(row.interestDue, loan.currency)}</td>
                        <td className="px-4 py-3">{formatMoney(row.feeDue, loan.currency)}</td>
                        <td className="px-4 py-3 text-amber-800 font-semibold">{formatMoney(row.penaltyDue, loan.currency)}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(totDue, loan.currency)}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium">{formatMoney(row.totalPaid, loan.currency)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={row.status === "PAID" ? "success" : isRowOverdue ? "danger" : "warning"}>
                            {row.status === "PARTIAL" && isRowOverdue
                              ? `Partial • ${row.overdueDays}d overdue`
                              : row.status === "OVERDUE"
                              ? `Overdue (${row.overdueDays}d)`
                              : row.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Collection Actions History */}
        {loan.collectionNotes && loan.collectionNotes.length > 0 && (
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="size-5 text-indigo-600" /> Collection Log History
              </h2>
              <Button size="sm" variant="outline" onClick={() => setCollectionModalOpen(true)}>
                + Add Collection Note
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Follow-up Date</th>
                    <th className="px-4 py-3">PTP Details</th>
                    <th className="px-4 py-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loan.collectionNotes.map((note) => (
                    <tr key={note.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(note.actionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-900">{note.actionType}</td>
                      <td className="px-4 py-3">{note.notes}</td>
                      <td className="px-4 py-3">{note.followUpDate ? new Date(note.followUpDate).toLocaleDateString() : "N/A"}</td>
                      <td className="px-4 py-3">
                        {note.promiseToPayAmount ? (
                          <span className="font-bold text-emerald-800">
                            {formatMoney(note.promiseToPayAmount, loan.currency)} on{" "}
                            {note.promiseToPayDate ? new Date(note.promiseToPayDate).toLocaleDateString() : "N/A"}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{note.createdByName ?? "Staff"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* APPROVE MODAL */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Approve Loan Application</h3>
            <p className="text-xs text-slate-500">Are you sure you want to approve loan {loan.loanNumber} for {formatMoney(loan.principalAmount, loan.currency)}?</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setApproveModalOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleApprove} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />} Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reject Loan Application</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectModalOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleReject} disabled={loading || !rejectionReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />} Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSE MODAL */}
      {disburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Disburse Loan Funds</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Savings Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
              >
                {memberAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.accountNumber} ({acc.accountType} - Balance: {formatMoney(acc.balance, acc.currency)})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDisburseModalOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleDisburse} disabled={loading || !selectedAccountId} className="bg-emerald-600 hover:bg-emerald-700">
                {loading && <LoaderCircle className="mr-2 size-4 animate-spin" />} Confirm Disbursement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <RecordRepaymentModal
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        initialLoan={loan}
        activeLoans={allActiveLoans}
        memberAccounts={memberAccountsMap}
      />

      <CollectionNoteModal
        isOpen={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        loanId={loan.id}
        loanNumber={loan.loanNumber}
        memberName={loan.memberName ?? "Member"}
      />
    </div>
  );
}
