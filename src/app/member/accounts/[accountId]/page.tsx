import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeAccount, serializeTransaction } from "@/lib/serializers";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export default async function MemberAccountDetailsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      memberId: user.memberProfile.id,
    },
    include: {
      branch: true,
      accountTypePolicy: true,
    },
  });

  if (!account) notFound();

  const transactions = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
    },
    take: 50,
  });

  const acc = serializeAccount(account);
  const txs = transactions.map(serializeTransaction);
  const availableBalance = Math.max(0, Number(acc.balance) - Number(acc.loanGuarantee));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/member/accounts">
            <ArrowLeft className="mr-2 size-4" /> Back to My Accounts
          </Link>
        </Button>
        <StatusBadge tone={acc.status === "ACTIVE" ? "success" : "warning"}>{acc.status}</StatusBadge>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8 space-y-6">
        <div>
          <span className="text-xs font-mono font-bold text-indigo-600 block">{acc.accountNumber}</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{acc.accountTypeName}</h1>
          <p className="text-xs text-slate-500 mt-1">Branch: {acc.branchName} • Currency: {acc.currency}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <span className="block text-xs font-semibold text-indigo-700">Total Balance</span>
            <span className="text-xl font-extrabold text-indigo-950 mt-1 block">
              {formatMoney(acc.balance, acc.currency)}
            </span>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <span className="block text-xs font-semibold text-amber-800 flex items-center gap-1">
              <Lock className="size-3" /> Loan Guarantee
            </span>
            <span className="text-xl font-bold text-amber-950 mt-1 block">
              {formatMoney(acc.loanGuarantee, acc.currency)}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <span className="block text-xs font-semibold text-emerald-800">Unencumbered Available</span>
            <span className="text-xl font-extrabold text-emerald-950 mt-1 block">
              {formatMoney(availableBalance, acc.currency)}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <History className="size-5 text-indigo-600" /> Transaction History
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {txs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No transaction history found for this account.
                    </td>
                  </tr>
                ) : (
                  txs.map((tx) => {
                    const isCredit = ["DEPOSIT", "LOAN_DISBURSEMENT", "OPENING_BALANCE", "WITHDRAWAL_REVERSAL"].includes(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{tx.reference}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold">{tx.type}</td>
                        <td className={`px-4 py-3 text-right font-bold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCredit ? "+" : "-"}{formatMoney(tx.amount, tx.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 font-semibold">
                          {tx.balanceAfter ? formatMoney(tx.balanceAfter, tx.currency) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={tx.status === "COMPLETED" ? "success" : "warning"}>
                            {tx.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
