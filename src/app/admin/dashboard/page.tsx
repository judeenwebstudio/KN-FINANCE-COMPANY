import { ArrowDownToLine, ArrowUpFromLine, HandCoins, Users, AlertTriangle, IndianRupee } from "lucide-react";
import { ExpenseChart, MovementChart } from "@/components/dashboard-charts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { CurrencyBadge, MoneyDisplay } from "@/components/money-display";
import { getAccessibleBranchIds } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { calculateLoanDelinquencySummary } from "@/lib/loans/overdue";
import { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";

export default async function AdminDashboard() {
  const branchIds = await getAccessibleBranchIds();
  const scope = { branchId: { in: branchIds } };

  const [
    members,
    pendingDepositsCount,
    pendingWithdrawalsCount,
    pendingLoans,
    activeLoansList,
    allAccounts,
    bankAccounts,
    treasuryAccounts,
    postedExpensesCount,
  ] = await Promise.all([
    prisma.memberProfile.count({ where: scope }),
    prisma.depositRequest.count({ where: { ...scope, status: "PENDING" } }),
    prisma.withdrawalRequest.count({ where: { ...scope, status: "PENDING" } }),
    prisma.loan.count({ where: { ...scope, status: "PENDING" } }),
    prisma.loan.findMany({
      where: { ...scope, status: "ACTIVE" },
      include: {
        repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
        member: { include: { user: true } },
      },
    }),
    prisma.account.findMany({
      where: { ...scope, status: "ACTIVE" },
      select: { currency: true, balance: true, accountType: true, accountNumber: true },
    }),
    prisma.bankAccount.findMany({
      where: { ...scope, status: "ACTIVE" },
      select: { currency: true, currentBalance: true, name: true, bankName: true },
    }),
    prisma.treasuryAccount.findMany({
      where: { ...scope, status: "ACTIVE" },
      select: { currency: true, balance: true, name: true, code: true },
    }),
    prisma.expense.count({ where: { ...scope, status: "POSTED" } }),
  ]);

  const now = new Date();
  let overdueLoansCount = 0;
  let totalOverdueSum = new Prisma.Decimal(0);

  const dueLoanRows: Array<{
    id: string;
    loanNumber: string;
    currency: string;
    member: { memberNumber: string; user: { name: string } };
    overdueAmount: number;
    daysPastDue: number;
  }> = [];

  for (const loan of activeLoansList) {
    const schedules = loan.repaymentSchedules.map((s) => ({
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
      schedules,
      now
    );

    if (delinq.isDelinquent) {
      overdueLoansCount++;
      totalOverdueSum = totalOverdueSum.add(delinq.totalOverdueAmount);
      dueLoanRows.push({
        ...loan,
        overdueAmount: delinq.totalOverdueAmount.toNumber(),
        daysPastDue: delinq.daysPastDue,
      });
    }
  }

  // Group member account balances strictly by currency
  const accountBalancesByCurrency = Object.values(
    allAccounts.reduce<Record<string, { currency: string; totalBalance: number; count: number }>>((acc, a) => {
      const row = acc[a.currency] ?? { currency: a.currency, totalBalance: 0, count: 0 };
      row.totalBalance += Number(a.balance);
      row.count += 1;
      acc[a.currency] = row;
      return acc;
    }, {})
  );

  // Group company bank balances strictly by currency
  const bankBalancesByCurrency = Object.values(
    bankAccounts.reduce<Record<string, { currency: string; totalBalance: number; count: number }>>((acc, b) => {
      const row = acc[b.currency] ?? { currency: b.currency, totalBalance: 0, count: 0 };
      row.totalBalance += Number(b.currentBalance);
      row.count += 1;
      acc[b.currency] = row;
      return acc;
    }, {})
  );

  // Group company treasury cash balances strictly by currency
  const treasuryBalancesByCurrency = Object.values(
    treasuryAccounts.reduce<Record<string, { currency: string; totalBalance: number; count: number }>>((acc, t) => {
      const row = acc[t.currency] ?? { currency: t.currency, totalBalance: 0, count: 0 };
      row.totalBalance += Number(t.balance);
      row.count += 1;
      acc[t.currency] = row;
      return acc;
    }, {})
  );

  return (
    <>
      <PageHeader title="Dashboard" description="A clear view of member activity, operational bank & treasury balances, and portfolio health across accessible branches." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total Members" value={members.toLocaleString()} hint="Across accessible branches" icon={Users} tone="indigo" />
        <StatCard label="Overdue Loans" value={overdueLoansCount.toString()} hint={`Total overdue: ₹${totalOverdueSum.toFixed(2)}`} icon={AlertTriangle} tone="rose" />
        <StatCard label="Deposit Requests" value={pendingDepositsCount.toString()} hint="Pending operational review" icon={ArrowDownToLine} tone="emerald" />
        <StatCard label="Withdraw Requests" value={pendingWithdrawalsCount.toString()} hint="Pending operational review" icon={ArrowUpFromLine} tone="amber" />
        <StatCard label="Pending Loans" value={pendingLoans.toString()} hint="Applications to review" icon={HandCoins} tone="violet" />
        <StatCard label="Posted Expenses" value={formatMoney(postedExpensesCount)} hint="Operational expense ledger" icon={IndianRupee} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ExpenseChart />
        <MovementChart />
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-3">
        {/* Member Balances */}
        <Card className="overflow-hidden">
          <SectionTitle title="Member Account Balances" subtitle="Authoritative active member account position grouped by currency" />
          <TableScroll>
            <table className="w-full text-left text-sm">
              <TableHead labels={["Currency", "Accounts", "Total Member Balance"]} numericFrom={1} />
              <tbody>
                {accountBalancesByCurrency.length ? (
                  accountBalancesByCurrency.map((row) => (
                    <tr key={row.currency} className="border-t border-slate-100 transition-colors hover:bg-emerald-50/30">
                      <Td><CurrencyBadge currency={row.currency} /></Td>
                      <Td numeric className="font-medium text-slate-700">{row.count} accounts</Td>
                      <Td numeric className="font-extrabold text-emerald-800"><MoneyDisplay value={row.totalBalance} currency={row.currency} /></Td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={3} />
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>

        {/* Company Bank Balances */}
        <Card className="overflow-hidden">
          <SectionTitle title="Company Bank Liquidity" subtitle="Authoritative company bank balances grouped by currency" />
          <TableScroll>
            <table className="w-full text-left text-sm">
              <TableHead labels={["Currency", "Bank Accounts", "Current Bank Balance"]} numericFrom={1} />
              <tbody>
                {bankBalancesByCurrency.length ? (
                  bankBalancesByCurrency.map((row) => (
                    <tr key={row.currency} className="border-t border-slate-100 transition-colors hover:bg-blue-50/30">
                      <Td><CurrencyBadge currency={row.currency} /></Td>
                      <Td numeric className="font-medium text-slate-700">{row.count} bank accounts</Td>
                      <Td numeric className="font-extrabold text-blue-800"><MoneyDisplay value={row.totalBalance} currency={row.currency} /></Td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={3} />
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>

        {/* Treasury Cash Balances */}
        <Card className="overflow-hidden">
          <SectionTitle title="Treasury Cash Balances" subtitle="Authoritative company operational cash balances grouped by currency" />
          <TableScroll>
            <table className="w-full text-left text-sm">
              <TableHead labels={["Currency", "Treasury Accounts", "Cash Balance"]} numericFrom={1} />
              <tbody>
                {treasuryBalancesByCurrency.length ? (
                  treasuryBalancesByCurrency.map((row) => (
                    <tr key={row.currency} className="border-t border-slate-100 transition-colors hover:bg-amber-50/30">
                      <Td><CurrencyBadge currency={row.currency} /></Td>
                      <Td numeric className="font-medium text-slate-700">{row.count} accounts</Td>
                      <Td numeric className="font-extrabold text-amber-800"><MoneyDisplay value={row.totalBalance} currency={row.currency} /></Td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={3} />
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="overflow-hidden">
          <SectionTitle title="Delinquent & Due Loan Payments" subtitle="Active facilities requiring urgent collection attention" />
          <TableScroll>
            <table className="w-full text-left text-sm">
              <TableHead labels={["Loan ID", "Member No", "Member", "Days Past Due", "Status", "Overdue Amount"]} numericFrom={5} />
              <tbody>
                {dueLoanRows.length ? (
                  dueLoanRows.slice(0, 5).map((loan) => (
                    <tr key={loan.id} className="border-t border-slate-100 transition-colors hover:bg-rose-50/35">
                      <Td className="font-semibold text-indigo-700">{loan.loanNumber}</Td>
                      <Td>{loan.member.memberNumber}</Td>
                      <Td className="font-medium text-slate-800">{loan.member.user.name}</Td>
                      <Td font-mono className="font-bold text-rose-700">{loan.daysPastDue}d</Td>
                      <Td numeric><StatusBadge tone="danger">Overdue</StatusBadge></Td>
                      <Td numeric className="font-semibold text-rose-700"><MoneyDisplay value={loan.overdueAmount} currency={loan.currency} /></Td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={6} />
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      </div>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5 md:p-6">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="max-w-full overflow-x-auto overscroll-x-contain">{children}</div>;
}

function TableHead({ labels, numericFrom }: { labels: string[]; numericFrom: number }) {
  return (
    <thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
      <tr>
        {labels.map((label, index) => (
          <th key={label} className={`whitespace-nowrap px-5 py-3 font-semibold md:px-6 ${index >= numericFrom ? "text-right" : ""}`}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Td({ children, className = "", numeric = false }: { children: React.ReactNode; className?: string; numeric?: boolean }) {
  return <td className={`whitespace-nowrap px-5 py-4 md:px-6 ${numeric ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td colSpan={columns} className="px-5 py-12 text-center text-sm text-slate-400">
        No records in this view.
      </td>
    </tr>
  );
}
