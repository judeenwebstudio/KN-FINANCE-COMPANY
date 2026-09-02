import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeAccount, serializeWithdrawalRequest, serializeTransactionCategory } from "@/lib/serializers";
import { AdminWithdrawalsClient } from "./withdrawals-client";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  await requirePermission("accounts.withdraw");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const activeAccounts = await prisma.account.findMany({
    where: {
      status: "ACTIVE",
      branchId: { in: accessibleBranchIds },
    },
    include: {
      member: { include: { user: true } },
      branch: true,
      accountTypePolicy: true,
    },
    orderBy: { accountNumber: "asc" },
  });

  const withdrawalRequests = await prisma.withdrawalRequest.findMany({
    where: { branchId: { in: accessibleBranchIds } },
    include: {
      member: { include: { user: true } },
      account: true,
      branch: true,
      approvedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const categories = await prisma.transactionCategory.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });

  const serializedAccounts = activeAccounts.map(serializeAccount);
  const serializedRequests = withdrawalRequests.map(serializeWithdrawalRequest);
  const serializedCategories = categories.map(serializeTransactionCategory);

  return (
    <AdminWithdrawalsClient
      activeAccounts={serializedAccounts}
      withdrawalRequests={serializedRequests}
      categories={serializedCategories}
      initialTab={tab}
    />
  );
}
