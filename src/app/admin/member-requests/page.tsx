import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, getAccessibleBranchIds } from "@/lib/authz";
import { getUserEffectivePermissions } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Inbox, ShieldCheck } from "lucide-react";

export default async function AdminMemberRequestsPage() {
  const user = await requireAdmin();
  const permissions = await getUserEffectivePermissions(user.id);

  if (!permissions.has("accounts.view")) {
    redirect("/admin/dashboard");
  }

  const accessibleBranchIds = await getAccessibleBranchIds();

  // Fetch real deposit requests & withdrawal requests for accessible branches
  const [depositRequests, withdrawalRequests] = await Promise.all([
    prisma.depositRequest.findMany({
      where: { branchId: { in: accessibleBranchIds } },
      include: {
        member: { select: { id: true, memberNumber: true, user: { select: { name: true } } } },
        branch: { select: { name: true, code: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.withdrawalRequest.findMany({
      where: { branchId: { in: accessibleBranchIds } },
      include: {
        member: { select: { id: true, memberNumber: true, user: { select: { name: true } } } },
        branch: { select: { name: true, code: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const allRequests = [
    ...depositRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      type: "DEPOSIT" as const,
      memberId: r.memberId,
      memberName: r.member.user.name,
      memberNumber: r.member.memberNumber,
      accountNumber: r.account.accountNumber,
      branchName: r.branch.name,
      branchCode: r.branch.code,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      actionHref: `/admin/deposits`,
    })),
    ...withdrawalRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      type: "WITHDRAWAL" as const,
      memberId: r.memberId,
      memberName: r.member.user.name,
      memberNumber: r.member.memberNumber,
      accountNumber: r.account.accountNumber,
      branchName: r.branch.name,
      branchCode: r.branch.code,
      amount: r.amount.toFixed(2),
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      actionHref: `/admin/withdrawals`,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formatCurrency = (val: string, currency: string) => {
    const num = parseFloat(val || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-US", {
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Centralized Member Requests</h1>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <ShieldCheck className="mr-1 h-3 w-3" /> Branch-Scoped
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consolidated operational review of real member deposit and withdrawal requests.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Request Number</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Request Type</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Submitted</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {allRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <Inbox className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No member requests submitted</p>
                    <p className="text-xs mt-1 text-slate-400">
                      Real member-originated requests will appear here.
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
                      <Link
                        href={`/admin/members/${req.memberId}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {req.memberName}
                      </Link>
                      <div className="text-[11px] font-mono text-slate-400">{req.memberNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{req.branchName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{req.branchCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      {req.type === "DEPOSIT" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ArrowDownToLine className="h-3 w-3" /> Deposit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={req.actionHref}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Process <ExternalLink className="h-3 w-3" />
                      </Link>
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
