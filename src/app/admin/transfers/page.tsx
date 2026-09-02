import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import {
  serializeTransfer,
  serializeTreasuryAccount,
  serializeBankAccount,
} from "@/lib/serializers";
import { TransfersClient } from "./transfers-client";

export default async function AdminTransfersPage() {
  const branchIds = await getAccessibleBranchIds();

  const [transfers, treasuryAccounts, bankAccounts, branches] = await Promise.all([
    prisma.transfer.findMany({
      where: {
        OR: [
          { sourceTreasuryAccount: { branchId: { in: branchIds } } },
          { sourceBankAccount: { branchId: { in: branchIds } } },
          { destinationTreasuryAccount: { branchId: { in: branchIds } } },
          { destinationBankAccount: { branchId: { in: branchIds } } },
        ],
      },
      include: {
        sourceTreasuryAccount: true,
        sourceBankAccount: true,
        destinationTreasuryAccount: true,
        destinationBankAccount: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
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
    <TransfersClient
      initialTransfers={transfers.map(serializeTransfer)}
      treasuryAccounts={treasuryAccounts.map(serializeTreasuryAccount)}
      bankAccounts={bankAccounts.map(serializeBankAccount)}
      branches={branches}
    />
  );
}
