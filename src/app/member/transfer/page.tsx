import Link from "next/link";
import { requireMember } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Lock, ShieldAlert, ArrowLeft } from "lucide-react";

export default async function MemberTransferPage() {
  await requireMember();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="size-6 text-indigo-600" /> Account Transfer
        </h1>
        <p className="text-sm text-slate-500">
          Transfer funds securely between credit union accounts.
        </p>
      </div>

      <Card className="p-8 text-center bg-white border-slate-200 shadow-xs rounded-2xl space-y-4">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
          <Lock className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">Transfers Are Currently Unavailable</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Inter-account transfer functionality requires Phase 8 Payment & Clearing Infrastructure integration. Internal financial posting for arbitrary client transfers is locked pending automated ledger verification.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-[11px] text-slate-600 flex items-center gap-2 max-w-md mx-auto text-left">
          <ShieldAlert className="size-5 text-amber-600 shrink-0" />
          <span>Need to deposit or withdraw funds? Please use official deposit/withdrawal request channels.</span>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/member/dashboard">
              <ArrowLeft className="mr-1.5 size-3.5" /> Back to Dashboard
            </Link>
          </Button>
          <Button asChild size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
            <Link href="/member/requests">Submit Member Request</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
