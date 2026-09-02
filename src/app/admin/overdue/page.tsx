import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { calculateLoanDelinquencySummary } from "@/lib/loans/overdue";
import { serializeLoan, serializeAccount, type AccountDTO } from "@/lib/serializers";
import { AdminOverdueClient, type OverdueRowData } from "./overdue-client";

export default async function AdminOverduePage() {
  await requirePermission("loans.collections.manage");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const activeLoans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      branchId: { in: accessibleBranchIds },
    },
    include: {
      product: true,
      member: { include: { user: true } },
      branch: true,
      repaymentSchedules: { orderBy: { installmentNumber: "asc" } },
      collectionNotes: { orderBy: { actionDate: "desc" }, take: 1 },
    },
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

  const now = new Date();
  const overdueRows: OverdueRowData[] = [];

  let totalOverdueAmountSum = new Prisma.Decimal(0);
  let totalOverduePrincipalSum = new Prisma.Decimal(0);
  let totalPenaltiesOutstandingSum = new Prisma.Decimal(0);

  for (const loan of activeLoans) {
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
      totalOverdueAmountSum = totalOverdueAmountSum.add(delinq.totalOverdueAmount);
      totalOverduePrincipalSum = totalOverduePrincipalSum.add(delinq.overduePrincipal);
      totalPenaltiesOutstandingSum = totalPenaltiesOutstandingSum.add(delinq.overduePenalties);

      const lastNote = loan.collectionNotes[0] ?? null;

      overdueRows.push({
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        memberId: loan.memberId,
        memberName: loan.member.user.name,
        memberNumber: loan.member.memberNumber,
        branchId: loan.branchId,
        branchName: loan.branch.name,
        currency: loan.currency,
        totalOverdueAmount: delinq.totalOverdueAmount.toString(),
        overduePrincipal: delinq.overduePrincipal.toString(),
        overdueInterest: delinq.overdueInterest.toString(),
        overdueFees: delinq.overdueFees.toString(),
        overduePenalties: delinq.overduePenalties.toString(),
        oldestDueDate: delinq.oldestDueDate ? delinq.oldestDueDate.toISOString() : null,
        daysPastDue: delinq.daysPastDue,
        overdueInstallmentsCount: delinq.overdueInstallmentsCount,
        totalOutstandingBalance: delinq.totalOutstandingBalance.toString(),
        agingBucket: delinq.agingBucket,
        lastCollectionAction: lastNote?.actionType ?? null,
        lastCollectionDate: lastNote?.actionDate ? lastNote.actionDate.toISOString() : null,
        followUpDate: lastNote?.followUpDate ? lastNote.followUpDate.toISOString() : null,
        promiseToPayAmount: lastNote?.promiseToPayAmount ? lastNote.promiseToPayAmount.toString() : null,
        promiseToPayDate: lastNote?.promiseToPayDate ? lastNote.promiseToPayDate.toISOString() : null,
      });
    }
  }

  const serializedActiveLoans = activeLoans.map(serializeLoan);

  return (
    <AdminOverdueClient
      rows={overdueRows}
      summary={{
        totalOverdueLoans: overdueRows.length,
        totalOverdueAmount: totalOverdueAmountSum.toString(),
        totalOverduePrincipal: totalOverduePrincipalSum.toString(),
        totalPenaltiesOutstanding: totalPenaltiesOutstandingSum.toString(),
      }}
      activeLoans={serializedActiveLoans}
      memberAccounts={memberAccountsMap}
    />
  );
}
