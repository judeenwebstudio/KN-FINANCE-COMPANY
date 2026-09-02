import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeAccount, serializeDepositRequest, serializeTransactionCategory } from "@/lib/serializers";
import { AdminDepositsClient } from "./deposits-client";

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  await requirePermission("accounts.deposit");
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

  const depositRequests = await prisma.depositRequest.findMany({
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
  const serializedRequests = depositRequests.map(serializeDepositRequest);
  const serializedCategories = categories.map(serializeTransactionCategory);

  return (
    <AdminDepositsClient
      activeAccounts={serializedAccounts}
      depositRequests={serializedRequests}
      categories={serializedCategories}
      initialTab={tab}
    />
  );
}
