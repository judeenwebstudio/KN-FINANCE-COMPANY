import { notFound } from "next/navigation";
import { requireMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MemberReportsClient } from "./member-reports-client";

export default async function MemberReportsPage() {
  const user = await requireMember();
  if (!user.memberProfile) notFound();

  const memberId = user.memberProfile.id;

  const [accounts, loans, transactions, repayments] = await Promise.all([
    prisma.account.findMany({
      where: { memberId },
      include: { accountTypePolicy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findMany({
      where: { memberId },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { memberId },
      include: { account: { select: { accountNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.loanRepayment.findMany({
      where: { memberId },
      include: {
        loan: { select: { loanNumber: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { paymentDate: "desc" },
      take: 100,
    }),
  ]);

  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    accountType: a.accountTypePolicy?.name || a.accountType,
    currency: a.currency,
    balance: a.balance.toFixed(2),
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));

  const serializedLoans = loans.map((l) => ({
    id: l.id,
    loanNumber: l.loanNumber,
    productName: l.product?.name || "Standard Loan",
    currency: l.currency,
    principalAmount: l.principalAmount.toFixed(2),
    paidAmount: l.paidAmount.toFixed(2),
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));

  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    accountNumber: t.account?.accountNumber || "N/A",
    reference: t.reference,
    type: t.type,
    amount: t.amount.toFixed(2),
    currency: t.currency,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));

  const serializedRepayments = repayments.map((r) => ({
    id: r.id,
    repaymentNumber: r.repaymentNumber,
    loanNumber: r.loan.loanNumber,
    accountNumber: r.account.accountNumber,
    amount: r.amount.toFixed(2),
    principalPaid: r.principalAmount.toFixed(2),
    interestPaid: r.interestAmount.toFixed(2),
    paymentDate: r.paymentDate.toISOString(),
    status: r.status,
  }));

  return (
    <MemberReportsClient
      memberName={user.name}
      memberNumber={user.memberProfile.memberNumber}
      accounts={serializedAccounts}
      loans={serializedLoans}
      transactions={serializedTransactions}
      repayments={serializedRepayments}
    />
  );
}
