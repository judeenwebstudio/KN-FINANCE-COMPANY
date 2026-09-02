import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { serializeExpenseCategory } from "@/lib/serializers";
import { ExpenseCategoriesClient } from "./expense-categories-client";

export default async function AdminExpenseCategoriesPage() {
  const branchIds = await getAccessibleBranchIds();

  const [categories, branches] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: {
        OR: [{ branchId: null }, { branchId: { in: branchIds } }],
      },
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const categoryDTOs = categories.map(serializeExpenseCategory);

  return (
    <ExpenseCategoriesClient
      initialCategories={categoryDTOs}
      accessibleBranches={branches}
    />
  );
}
