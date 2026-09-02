import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { serializeBankTransaction } from "@/lib/serializers";
import { BankTransactionsClient } from "./bank-transactions-client";

export default async function AdminBankTransactionsPage() {
  const branchIds = await getAccessibleBranchIds();

  const [bankTransactions, bankAccounts] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { branchId: { in: branchIds } },
      },
      include: {
        bankAccount: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.bankAccount.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true, name: true, bankName: true },
    }),
  ]);

  return (
    <BankTransactionsClient
      transactions={bankTransactions.map(serializeBankTransaction)}
      bankAccounts={bankAccounts}
    />
  );
}
