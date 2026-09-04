import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Clock3, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default async function MemberRequestsPage() {
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const memberId = user.memberProfile.id;

  const [depositRequests, withdrawalRequests] = await Promise.all([
    prisma.depositRequest.findMany({
      where: { memberId },
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.withdrawalRequest.findMany({
      where: { memberId },
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const allRequests = [
    ...depositRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      type: "DEPOSIT" as const,
      accountNumber: r.account.accountNumber,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      paymentMethod: r.paymentMethod || "—",
      reference: r.reference || "—",
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...withdrawalRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      type: "WITHDRAWAL" as const,
      accountNumber: r.account.accountNumber,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      paymentMethod: r.paymentMethod || "—",
      reference: r.reference || "—",
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formatCurrency = (val: string, currency: string) => {
    const num = parseFloat(val || "0");
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Clock3 className="size-6 text-indigo-600" /> Pending & Historical Requests
          </h1>
          <p className="text-sm text-slate-500">
            Track deposit and withdrawal requests submitted to your credit union branch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="text-xs gap-1 border-slate-300">
            <Link href="/member/deposits">
              <ArrowDownToLine className="size-3.5 text-emerald-600" /> Submit Deposit
            </Link>
          </Button>
          <Button asChild size="sm" className="text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Link href="/member/withdrawals">
              <ArrowUpFromLine className="size-3.5" /> Request Withdrawal
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Account Number</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Method / Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Submitted Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {allRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Clock3 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No requests found</p>
                    <p className="text-xs mt-1 text-slate-400">
                      Submitted deposit or withdrawal requests will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                allRequests.map((req) => (
                  <tr key={`${req.type}-${req.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {req.requestNumber}
                    </td>
                    <td className="px-4 py-3">
                      {req.type === "DEPOSIT" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <ArrowDownToLine className="h-3 w-3" /> Deposit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <ArrowUpFromLine className="h-3 w-3" /> Withdrawal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {req.accountNumber}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                      {formatCurrency(req.amount, req.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{req.paymentMethod}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{req.reference}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={
                          req.status === "APPROVED"
                            ? "success"
                            : req.status === "REJECTED"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {req.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-[11px]">
                      {formatDate(req.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
