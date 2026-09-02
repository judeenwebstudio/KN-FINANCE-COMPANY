import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { determineScheduleStatus } from "@/lib/loans/balance";
import { UpcomingPaymentsClient, type UpcomingPaymentRow } from "./payments-client";

export default async function AdminPaymentsPage() {
  await requirePermission("loans.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const schedules = await prisma.loanRepaymentSchedule.findMany({
    where: {
      loan: {
        status: { in: ["ACTIVE", "APPROVED"] },
        branchId: { in: accessibleBranchIds },
      },
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    },
    include: {
      loan: {
        include: {
          member: { include: { user: true } },
          branch: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();

  const rows: UpcomingPaymentRow[] = schedules.map((s) => {
    const totalDue = s.totalDue;
    const totalPaid = s.totalPaid;
    const remaining = Prisma.Decimal.max(0, totalDue.sub(totalPaid));
    const computedStatus = determineScheduleStatus(totalDue, totalPaid, s.dueDate, now);

    return {
      scheduleId: s.id,
      loanId: s.loan.id,
      loanNumber: s.loan.loanNumber,
      memberName: s.loan.member.user.name,
      memberNumber: s.loan.member.memberNumber,
      branchId: s.loan.branchId,
      branchName: s.loan.branch.name,
      installmentNumber: s.installmentNumber,
      dueDate: s.dueDate.toISOString(),
      currency: s.loan.currency,
      principalDue: s.principalDue.toString(),
      interestDue: s.interestDue.toString(),
      feeDue: s.feeDue.toString(),
      totalDue: s.totalDue.toString(),
      totalPaid: s.totalPaid.toString(),
      remainingAmount: remaining.toString(),
      status: computedStatus,
    };
  });

  return <UpcomingPaymentsClient rows={rows} />;
}
