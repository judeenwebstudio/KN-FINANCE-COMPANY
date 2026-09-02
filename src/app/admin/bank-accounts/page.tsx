import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { serializeBankAccount } from "@/lib/serializers";
import { BankAccountsClient } from "./bank-accounts-client";

export default async function AdminBankAccountsPage() {
  await requirePermission("banking.view");
  const branchIds = await getAccessibleBranchIds();

  const [bankAccounts, branches] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { branchId: { in: branchIds } },
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, code: true, currency: true },
    }),
  ]);

  return (
    <BankAccountsClient
      initialAccounts={bankAccounts.map(serializeBankAccount)}
      accessibleBranches={branches}
    />
  );
}
