import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { getReconciliationSummary } from "@/lib/reconciliation/selectors";
import { serializeBankStatementImport } from "@/lib/serializers";
import { ReconciliationClient } from "./reconciliation-client";

export default async function AdminReconciliationPage() {
  await requirePermission("banking.reconcile");
  const branchIds = await getAccessibleBranchIds();

  const [summary, recentImports, bankAccounts] = await Promise.all([
    getReconciliationSummary(),
    prisma.bankStatementImport.findMany({
      where: { branchId: { in: branchIds } },
      include: { bankAccount: { select: { name: true, accountNumber: true } }, branch: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.bankAccount.findMany({
      where: { branchId: { in: branchIds }, status: "ACTIVE" },
      select: { id: true, name: true, accountNumber: true, currency: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ReconciliationClient
      summary={summary}
      recentImports={recentImports.map(serializeBankStatementImport)}
      bankAccounts={bankAccounts}
    />
  );
}
