import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeLoan } from "@/lib/serializers";
import { AdminLoansClient } from "./admin-loans-client";

export default async function AdminLoansPage() {
  await requirePermission("loans.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const loans = await prisma.loan.findMany({
    where: { branchId: { in: accessibleBranchIds } },
    include: {
      product: true,
      member: { include: { user: true } },
      branch: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedLoans = loans.map((l) => serializeLoan(l));

  return <AdminLoansClient loans={serializedLoans} />;
}
