import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeTransaction } from "@/lib/serializers";
import { AdminTransactionsClient } from "./transactions-client";

export default async function AdminTransactionsPage() {
  await requirePermission("accounts.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const transactions = await prisma.transaction.findMany({
    where: { branchId: { in: accessibleBranchIds } },
    include: {
      account: true,
      member: { include: { user: true } },
      branch: true,
      category: true,
      createdBy: true,
      reversedBy: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = transactions.map(serializeTransaction);

  return <AdminTransactionsClient transactions={serialized} />;
}
