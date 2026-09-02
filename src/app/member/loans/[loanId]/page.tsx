import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, History, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeLoan } from "@/lib/serializers";
import { calculateLoanFinancialSummary } from "@/lib/loans/balance";
import { calculateLoanDelinquencySummary } from "@/lib/loans/overdue";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

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

export default async function MemberLoanDetailsPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const user = await requireMember();

  if (!user.memberProfile) notFound();

  const loan = await prisma.loan.findFirst({
    where: {
      id: loanId,
      memberId: user.memberProfile.id,
    },
    include: {
      product: true,
      branch: true,
      repaymentSchedules: {
        orderBy: { installmentNumber: "asc" },
      },
      repayments: {
        orderBy: { paymentDate: "desc" },
        include: { account: true, createdBy: true },
      },
    },
  });

  if (!loan) notFound();

  const l = serializeLoan(loan);

  const summary = calculateLoanFinancialSummary(
    loan.principalAmount,
    loan.totalPayable,
    loan.repaymentSchedules
  );

  const now = new Date();
  const schedulesForDelinq = loan.repaymentSchedules.map((s) => ({
    id: s.id,
    installmentNumber: s.installmentNumber,
    dueDate: s.dueDate,
    principalDue: s.principalDue,
    interestDue: s.interestDue,
    feeDue: s.feeDue,
    penaltyDue: s.penaltyDue,
    totalDue: s.totalDue,
    principalPaid: s.principalPaid,
    interestPaid: s.interestPaid,
    feePaid: s.feePaid,
    penaltyPaid: s.penaltyPaid,
    totalPaid: s.totalPaid,
    overdueDays: s.overdueDays,
    status: s.status,
  }));

  const delinq = calculateLoanDelinquencySummary(
    { id: loan.id, loanNumber: loan.loanNumber, status: loan.status, currency: loan.currency },
    schedulesForDelinq,
    now
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/member/loans">
            <ArrowLeft className="mr-2 size-4" /> Back to My Loans
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {delinq.isDelinquent && (
            <StatusBadge tone="danger">
              Overdue ({delinq.daysPastDue}d)
            </StatusBadge>
          )}
          <StatusBadge tone={statusTones[l.status] ?? "neutral"}>{l.status}</StatusBadge>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 space-y-6">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Loan Facility Details
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{l.loanNumber}</h1>
            <p className="text-sm text-slate-500">
              {l.productName ?? "Standard Product"} • Applied on{" "}
              {new Date(l.applicationDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {delinq.isDelinquent && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3 text-xs text-rose-900 font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-rose-600 shrink-0" />
              <span>Overdue Payment Required: {formatMoney(delinq.totalOverdueAmount.toString(), l.currency)}</span>
            </div>
            <div>
              Penalties Accrued: {formatMoney(delinq.overduePenalties.toString(), l.currency)}
            </div>
          </div>
        )}

        {/* Enhanced Financial Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs text-slate-500">Total Payable</span>
            <span className="text-lg font-bold text-slate-900">
              {formatMoney(summary.totalOutstanding.add(summary.totalPaid).toString(), l.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs text-slate-500">Total Paid</span>
            <span className="text-lg font-bold text-emerald-700">
              {formatMoney(summary.totalPaid.toString(), l.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <span className="block text-xs font-semibold text-indigo-700">Outstanding Balance</span>
            <span className="text-lg font-bold text-indigo-900">
              {formatMoney(summary.totalOutstanding.toString(), l.currency)}
            </span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <span className="block text-xs font-semibold text-amber-700">Next Payment</span>
            <span className="text-lg font-bold text-amber-900">
              {summary.nextPaymentDate
                ? formatMoney(summary.nextPaymentAmount.toString(), l.currency)
                : "None"}
            </span>
            <span className="block text-[10px] text-amber-700 mt-0.5">
              {summary.nextPaymentDate
                ? `Due ${new Date(summary.nextPaymentDate).toLocaleDateString()}`
                : "Fully Paid"}
            </span>
          </div>
        </div>

        {/* Detailed Financial Breakdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-700">
          <div>
            <span className="text-slate-400 block">Principal Paid</span>
            <span className="font-semibold">{formatMoney(summary.totalPrincipalPaid.toString(), l.currency)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Interest Paid</span>
            <span className="font-semibold">{formatMoney(summary.totalInterestPaid.toString(), l.currency)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Fees Paid</span>
            <span className="font-semibold">{formatMoney(summary.totalFeesPaid.toString(), l.currency)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Penalties Outstanding</span>
            <span className="font-semibold text-amber-800">{formatMoney(summary.remainingPenalty.toString(), l.currency)}</span>
          </div>
        </div>

        {/* Schedule */}
        {l.repaymentSchedules && l.repaymentSchedules.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
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
                  {l.repaymentSchedules.map((row) => {
                    const dueTime = new Date(row.dueDate).getTime();
                    const isPastDue = now.getTime() > dueTime;
                    const totDue = Number(row.totalDue) + Number(row.penaltyDue);
                    const remaining = Math.max(0, totDue - Number(row.totalPaid));
                    const isRowOverdue = isPastDue && remaining > 0;

                    return (
                      <tr key={row.id} className={isRowOverdue ? "bg-rose-50/50" : "hover:bg-slate-50/50"}>
                        <td className="px-4 py-3 font-medium">{row.installmentNumber}</td>
                        <td className="px-4 py-3">{new Date(row.dueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{formatMoney(row.principalDue, l.currency)}</td>
                        <td className="px-4 py-3">{formatMoney(row.interestDue, l.currency)}</td>
                        <td className="px-4 py-3">{formatMoney(row.feeDue, l.currency)}</td>
                        <td className="px-4 py-3 text-amber-800 font-semibold">{formatMoney(row.penaltyDue, l.currency)}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(totDue, l.currency)}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium">{formatMoney(row.totalPaid, l.currency)}</td>
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

        {/* Member Repayment History */}
        {loan.repayments && loan.repayments.length > 0 && (
          <div className="pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History className="size-5 text-indigo-600" /> Payment History
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Repayment #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Breakdown (Pen / Fee / Int / Prin)</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loan.repayments.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.repaymentNumber}</td>
                      <td className="px-4 py-3">{new Date(r.paymentDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{r.account?.accountNumber ?? "Account"}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(r.amount.toString(), l.currency)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        Pen: {formatMoney(r.penaltyAmount.toString(), l.currency)} | Fee: {formatMoney(r.feeAmount.toString(), l.currency)} | Int: {formatMoney(r.interestAmount.toString(), l.currency)} | Prin: {formatMoney(r.principalAmount.toString(), l.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={r.status === "POSTED" ? "success" : "danger"}>
                          {r.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
