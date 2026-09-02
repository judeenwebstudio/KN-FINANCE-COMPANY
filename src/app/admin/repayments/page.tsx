import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeLoanRepayment, serializeLoan, serializeAccount, type AccountDTO } from "@/lib/serializers";
import { LoanRepaymentsClient } from "./repayments-client";

export default async function AdminRepaymentsPage() {
  await requirePermission("loans.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const repayments = await prisma.loanRepayment.findMany({
    where: { member: { branchId: { in: accessibleBranchIds } } },
    include: {
      loan: true,
      account: true,
      member: { include: { user: true, branch: true } },
      createdBy: true,
      reversedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const activeLoans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      branchId: { in: accessibleBranchIds },
    },
    include: { product: true, member: { include: { user: true } }, branch: true },
    orderBy: { loanNumber: "asc" },
  });

  const memberIds = Array.from(new Set(activeLoans.map((l) => l.memberId)));
  const memberAccountsList = await prisma.account.findMany({
    where: { memberId: { in: memberIds }, status: "ACTIVE" },
  });

  const memberAccountsMap: Record<string, AccountDTO[]> = {};
  for (const acc of memberAccountsList) {
    if (!memberAccountsMap[acc.memberId]) memberAccountsMap[acc.memberId] = [];
    memberAccountsMap[acc.memberId].push(serializeAccount(acc));
  }

  const serializedRepayments = repayments.map(serializeLoanRepayment);
  const serializedLoans = activeLoans.map(serializeLoan);

  return (
    <LoanRepaymentsClient
      repayments={serializedRepayments}
      activeLoans={serializedLoans}
      memberAccounts={memberAccountsMap}
    />
  );
}
