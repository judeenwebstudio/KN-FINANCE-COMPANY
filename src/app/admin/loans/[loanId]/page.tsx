import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeLoan, serializeAccount, type AccountDTO } from "@/lib/serializers";
import { AdminLoanDetailsClient } from "./loan-details-client";

export default async function AdminLoanDetailsPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  await requirePermission("loans.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      product: true,
      member: { include: { user: true } },
      branch: true,
      repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
      repayments: {
        orderBy: { paymentDate: "desc" },
        include: { account: true, createdBy: true, reversedBy: true },
      },
    },
  });

  if (!loan) notFound();

  // Branch authorization check
  if (!accessibleBranchIds.includes(loan.branchId)) notFound();

  // Fetch member's active accounts in matching currency for disbursement selection
  const memberAccounts = await prisma.account.findMany({
    where: {
      memberId: loan.memberId,
      status: "ACTIVE",
      currency: loan.currency,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch all active loans & accounts for Record Repayment modal
  const allActiveLoansList = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      branchId: { in: accessibleBranchIds },
    },
    include: { product: true, member: { include: { user: true } }, branch: true },
    orderBy: { loanNumber: "asc" },
  });

  const memberIds = Array.from(new Set(allActiveLoansList.map((l) => l.memberId)));
  const allAccountsList = await prisma.account.findMany({
    where: { memberId: { in: memberIds }, status: "ACTIVE" },
  });

  const memberAccountsMap: Record<string, AccountDTO[]> = {};
  for (const acc of allAccountsList) {
    if (!memberAccountsMap[acc.memberId]) memberAccountsMap[acc.memberId] = [];
    memberAccountsMap[acc.memberId].push(serializeAccount(acc));
  }

  const serializedLoan = serializeLoan(loan);
  const serializedAccounts = memberAccounts.map(serializeAccount);
  const serializedActiveLoans = allActiveLoansList.map(serializeLoan);

  return (
    <AdminLoanDetailsClient
      loan={serializedLoan}
      memberAccounts={serializedAccounts}
      allActiveLoans={serializedActiveLoans}
      memberAccountsMap={memberAccountsMap}
    />
  );
}
