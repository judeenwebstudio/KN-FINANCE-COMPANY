import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { serializeBankAccount, serializeBankTransaction, serializeExpense } from "@/lib/serializers";
import { BankAccountDetailsClient } from "./bank-account-details-client";

type Params = Promise<{ bankAccountId: string }>;

export default async function AdminBankAccountDetailsPage({ params }: { params: Params }) {
  const { bankAccountId } = await params;
  const branchIds = await getAccessibleBranchIds();

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, branchId: { in: branchIds } },
    include: { branch: true },
  });

  if (!bankAccount) {
    notFound();
  }

  const [transactions, expenses] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { bankAccountId },
      include: { createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.expense.findMany({
      where: { bankAccountId },
      include: { category: true, createdBy: true },
      orderBy: { expenseDate: "desc" },
      take: 50,
    }),
  ]);

  return (
    <BankAccountDetailsClient
      bankAccount={serializeBankAccount(bankAccount)}
      transactions={transactions.map(serializeBankTransaction)}
      expenses={expenses.map(serializeExpense)}
    />
  );
}
