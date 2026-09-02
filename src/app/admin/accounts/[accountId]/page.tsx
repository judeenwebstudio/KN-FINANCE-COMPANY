import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeAccount, serializeTransaction, serializeTransactionCategory } from "@/lib/serializers";
import { AdminAccountDetailsClient } from "./account-details-client";

export default async function AdminAccountDetailsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  await requirePermission("accounts.view");
  const accessibleBranchIds = await getAccessibleBranchIds();

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      member: { include: { user: true } },
      branch: true,
      accountTypePolicy: true,
    },
  });

  if (!account) notFound();

  if (!accessibleBranchIds.includes(account.branchId)) notFound();

  const transactions = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: {
      account: true,
      member: { include: { user: true } },
      branch: true,
      category: true,
      createdBy: true,
    },
    take: 50,
  });

  const categories = await prisma.transactionCategory.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });

  const serializedAccount = serializeAccount(account);
  const serializedTransactions = transactions.map(serializeTransaction);
  const serializedCategories = categories.map(serializeTransactionCategory);

  return (
    <AdminAccountDetailsClient
      account={serializedAccount}
      transactions={serializedTransactions}
      categories={serializedCategories}
    />
  );
}
