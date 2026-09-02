import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeLoan } from "@/lib/serializers";
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

export default async function MemberMyLoansPage() {
  const user = await requireMember();
  if (!user.memberProfile) {
    return <div className="p-8 text-center text-slate-500">Member profile not found.</div>;
  }

  const loans = await prisma.loan.findMany({
    where: { memberId: user.memberProfile.id },
    include: { product: true, branch: true },
    orderBy: { createdAt: "desc" },
  });

  const serializedLoans = loans.map((l) => serializeLoan(l));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Loans</h1>
          <p className="text-sm text-slate-500">
            View your active loans, pending applications, and repayment schedules.
          </p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Link href="/member/loans/apply">
            <Plus className="mr-2 size-4" /> Apply for Loan
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Loan Number</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Principal</th>
                <th className="px-5 py-3.5">Term</th>
                <th className="px-5 py-3.5">Total Payable</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Applied Date</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {serializedLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    You have no loans or pending applications yet.
                  </td>
                </tr>
              ) : (
                serializedLoans.map((l) => (
                  <tr key={l.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-900">
                      {l.loanNumber}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {l.productName ?? "Standard Loan"}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatMoney(l.principalAmount, l.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {l.termMonths} mo ({l.repaymentFrequency.toLowerCase()})
                    </td>
                    <td className="px-5 py-4 font-semibold text-indigo-700">
                      {formatMoney(l.totalPayable, l.currency)}
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
                        <Link href={`/member/loans/${l.id}`}>View Details</Link>
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
