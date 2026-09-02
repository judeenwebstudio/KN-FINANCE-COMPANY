import Link from "next/link";
import {
  FileText,
  CreditCard,
  Coins,
  Clock,
  Receipt,
  ArrowLeftRight,
  DollarSign,
  Building,
  Building2,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorize";

export default async function AdminReportsPage() {
  await requirePermission("reports.view");
  const reportCategories = [
    {
      title: "Member Accounts",
      description: "Member savings/checking account ledgers, balances, and statements.",
      items: [
        { title: "Account Statement", href: "/admin/reports/account-statement", icon: FileText, desc: "Detailed debit/credit statement with opening & closing balances." },
        { title: "Account Balances", href: "/admin/reports/account-balances", icon: CreditCard, desc: "Current member account balances grouped by currency." },
        { title: "Member Transactions", href: "/admin/reports/transactions", icon: ArrowLeftRight, desc: "Unified member transaction ledger history." },
      ],
    },
    {
      title: "Loan Portfolio",
      description: "Loan application, active facilities, repayments, delinquency aging, and portfolio risk.",
      items: [
        { title: "Loan Report", href: "/admin/reports/loans", icon: Coins, desc: "Loan portfolio status, amounts, and outstanding balances." },
        { title: "Loan Aging & Delinquency", href: "/admin/reports/loan-aging", icon: Clock, desc: "Overdue principal, interest, fees, penalties by aging bucket (1-30, 31-60, 61-90, 90+)." },
        { title: "Portfolio Quality & Risk", href: "/admin/reports/portfolio-quality", icon: TrendingUp, desc: "PAR 1/30/60/90+, mutually exclusive aging buckets, collection performance rates, vintage cohorts." },
        { title: "Loan Repayments", href: "/admin/reports/loan-repayments", icon: Receipt, desc: "Repayment collection breakdown (Principal, Interest, Fee, Penalty)." },
      ],
    },
    {
      title: "Company Operations & Expenses",
      description: "Operational cash treasury, company expenses, and bank subledgers.",
      items: [
        { title: "Expense Report", href: "/admin/reports/expenses", icon: DollarSign, desc: "Operational expenses funded by Treasury Cash or Bank Accounts." },
        { title: "Treasury Cash Report", href: "/admin/reports/treasury", icon: Building, desc: "Company operational cash accounts & subledger statements." },
      ],
    },
    {
      title: "Company Banking",
      description: "Bank accounts, liquidity positions, and bank transaction subledgers.",
      items: [
        { title: "Bank Balances", href: "/admin/reports/bank-balances", icon: Building2, desc: "Company operational bank accounts & current balances." },
        { title: "Bank Transactions", href: "/admin/reports/bank-transactions", icon: ArrowLeftRight, desc: "Operational bank subledger statement with reconciliation status." },
      ],
    },
    {
      title: "Financial Summary",
      description: "Operational revenue collections and net operating income.",
      items: [
        { title: "Income & Expense Summary", href: "/admin/reports/income-summary", icon: TrendingUp, desc: "Collected interest/fees/penalties less operating expenses by currency." },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics Hub"
        description="Centralized operational and financial reporting suite derived directly from authoritative KN Finance Company ledgers."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reportCategories.map((cat) => (
          <Card key={cat.title} className="p-5 space-y-4 border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">{cat.title}</h2>
              <p className="text-xs text-slate-500">{cat.description}</p>
            </div>

            <div className="space-y-2">
              {cat.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30 group"
                  >
                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">{item.title}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
