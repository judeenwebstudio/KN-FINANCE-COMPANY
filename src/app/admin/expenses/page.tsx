import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import {
  serializeExpense,
  serializeExpenseCategory,
  serializeTreasuryAccount,
  serializeBankAccount,
} from "@/lib/serializers";
import { ExpensesClient } from "./expenses-client";

export default async function AdminExpensesPage() {
  await requirePermission("expenses.view");
  const branchIds = await getAccessibleBranchIds();

  const [expenses, categories, treasuryAccounts, bankAccounts, branches] = await Promise.all([
    prisma.expense.findMany({
      where: { branchId: { in: branchIds } },
      include: {
        branch: true,
        category: true,
        treasuryAccount: true,
        bankAccount: true,
        createdBy: true,
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.expenseCategory.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ branchId: null }, { branchId: { in: branchIds } }],
      },
      include: { branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.treasuryAccount.findMany({
      where: { branchId: { in: branchIds }, status: "ACTIVE" },
      include: { branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { branchId: { in: branchIds }, status: "ACTIVE" },
      include: { branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, code: true, currency: true },
    }),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses.map(serializeExpense)}
      categories={categories.map(serializeExpenseCategory)}
      treasuryAccounts={treasuryAccounts.map(serializeTreasuryAccount)}
      bankAccounts={bankAccounts.map(serializeBankAccount)}
      branches={branches}
    />
  );
}
