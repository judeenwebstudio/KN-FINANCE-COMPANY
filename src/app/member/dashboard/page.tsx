import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CalendarClock, Clock3, HandCoins, Wallet } from "lucide-react";
import { requireMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { CurrencyBadge, MoneyDisplay } from "@/components/money-display";

const quickActions = [
  { label: "My Loans", description: "View loan facilities", href: "/member/loans", icon: HandCoins, tone: "bg-violet-100 text-violet-700" },
  { label: "Transfer", description: "Move funds securely", href: "/member/transfer", icon: ArrowLeftRight, tone: "bg-indigo-100 text-indigo-700" },
  { label: "Deposit", description: "Add money", href: "/member/deposits", icon: ArrowDownToLine, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Withdraw", description: "Request a withdrawal", href: "/member/withdrawals", icon: ArrowUpFromLine, tone: "bg-amber-100 text-amber-700" },
] as const;

export default async function MemberDashboard() {
  const user = await requireMember();
  const memberId = user.memberProfile?.id;
  const [accounts, activeLoans, pendingRequests] = memberId ? await Promise.all([
    prisma.account.findMany({ where: { memberId }, orderBy: { createdAt: "asc" } }),
    prisma.loan.count({ where: { memberId, status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.loan.count({ where: { memberId, status: "PENDING" } }),
  ]) : [[], 0, 0];
  const totalByCurrency = accounts.reduce<Record<string, number>>((sum, account) => { sum[account.currency] = (sum[account.currency] ?? 0) + Number(account.balance); return sum; }, {});
  const totalLabel = Object.entries(totalByCurrency).map(([currency, value]) => new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency }).format(value)).join(" · ") || "—";

  return <>
    <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Your accounts, loan position, and pending activity at a glance." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total Balance" value={totalLabel} hint="Across all active accounts" icon={Wallet} tone="indigo" />
      <StatCard label="Active Loans" value={String(activeLoans)} hint="Approved and active facilities" icon={HandCoins} tone="violet" />
      <StatCard label="Pending Requests" value={String(pendingRequests)} hint="Submitted for review" icon={Clock3} tone="amber" />
      <StatCard label="Next Payment" value="Not scheduled" hint="Repayment schedule is not available yet" icon={CalendarClock} tone="emerald" />
    </div>
    <Card className="mt-6 p-5 md:p-6"><div className="mb-4"><h2 className="font-semibold text-slate-900">Quick actions</h2><p className="mt-1 text-xs text-slate-500">Go directly to your most-used account tools</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ label, description, href, icon: Icon, tone }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-4.5" aria-hidden="true" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-slate-800 group-hover:text-indigo-700">{label}</span><span className="block truncate text-xs text-slate-500">{description}</span></span></Link>)}</div></Card>
    <Card className="mt-6 overflow-hidden"><div className="p-5 md:p-6"><h2 className="font-semibold text-slate-900">Accounts Overview</h2><p className="mt-1 text-xs text-slate-500">Balances for your authenticated member profile only</p></div><div className="max-w-full overflow-x-auto overscroll-x-contain"><table className="w-full text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500"><tr>{["Account Number", "Account Type", "Currency", "Balance", "Loan Guarantee", "Current Balance"].map((heading, index) => <th key={heading} className={`whitespace-nowrap px-5 py-3 font-semibold md:px-6 ${index >= 3 ? "text-right" : ""}`}>{heading}</th>)}</tr></thead><tbody>{accounts.length ? accounts.map((account) => <tr key={account.id} className="border-t border-slate-100 transition-colors hover:bg-indigo-50/30"><td className="whitespace-nowrap px-5 py-4 font-semibold text-indigo-700 md:px-6">{account.accountNumber}</td><td className="px-5 py-4 capitalize text-slate-600 md:px-6"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{account.accountType.toLowerCase()}</span></td><td className="px-5 py-4 md:px-6"><CurrencyBadge currency={account.currency} /></td><td className="whitespace-nowrap px-5 py-4 text-right tabular-nums md:px-6"><MoneyDisplay value={account.balance.toString()} currency={account.currency} /></td><td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-amber-700 md:px-6"><MoneyDisplay value={account.loanGuarantee.toString()} currency={account.currency} /></td><td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-950 md:px-6"><MoneyDisplay value={(Number(account.balance) - Number(account.loanGuarantee)).toString()} currency={account.currency} /></td></tr>) : <tr><td colSpan={6} className="p-12 text-center text-slate-400">No accounts are linked to your profile.</td></tr>}</tbody></table></div></Card>
  </>;
}
