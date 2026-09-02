import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeTransactionCategory } from "@/lib/serializers";
import { TransactionCategoriesClient } from "./transaction-categories-client";

export default async function AdminTransactionCategoriesPage() {
  await requirePermission("accounts.view");

  const categories = await prisma.transactionCategory.findMany({
    orderBy: { code: "asc" },
  });

  const serialized = categories.map(serializeTransactionCategory);

  return <TransactionCategoriesClient categories={serialized} />;
}
