import { notFound } from "next/navigation";
import Link from "next/link";
import { Wallet, Lock, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { serializeAccount } from "@/lib/serializers";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export default async function MemberAccountsPage() {
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const accounts = await prisma.account.findMany({
    where: { memberId: user.memberProfile.id },
    include: {
      branch: true,
      accountTypePolicy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = accounts.map(serializeAccount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Wallet className="size-6 text-indigo-600" /> My Financial Accounts
        </h1>
        <p className="text-sm text-slate-500">
          View your balances, loan guarantee commitments, and recent account activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {serialized.map((acc) => {
          const available = Math.max(0, Number(acc.balance) - Number(acc.loanGuarantee));
          return (
            <div key={acc.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-indigo-600 block">{acc.accountNumber}</span>
                  <h2 className="text-base font-bold text-slate-900">{acc.accountTypeName}</h2>
                </div>
                <StatusBadge tone={acc.status === "ACTIVE" ? "success" : "warning"}>{acc.status}</StatusBadge>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Current Balance</span>
                  <span className="font-bold text-slate-900 text-sm">{formatMoney(acc.balance, acc.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-800">
                  <span className="flex items-center gap-1"><Lock className="size-3" /> Loan Guarantee</span>
                  <span className="font-semibold">{formatMoney(acc.loanGuarantee, acc.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-800 border-t border-slate-200 pt-2">
                  <span className="font-bold">Available Unencumbered</span>
                  <span className="font-extrabold text-emerald-950">{formatMoney(available, acc.currency)}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/member/accounts/${acc.id}`}>
                    <Eye className="mr-1 size-3.5" /> View Activity
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
