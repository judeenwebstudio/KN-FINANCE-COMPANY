import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import {
  serializeBankStatementImport,
  serializeBankStatementLine,
  serializeBankReconciliationMatch,
} from "@/lib/serializers";
import { ImportDetailsClient } from "./import-details-client";

type Params = Promise<{ importId: string }>;

export default async function AdminImportDetailsPage({ params }: { params: Params }) {
  const { importId } = await params;
  const branchIds = await getAccessibleBranchIds();

  const statementImport = await prisma.bankStatementImport.findFirst({
    where: { id: importId, branchId: { in: branchIds } },
    include: {
      bankAccount: { select: { name: true, accountNumber: true } },
      branch: { select: { name: true } },
      createdBy: true,
    },
  });

  if (!statementImport) {
    notFound();
  }

  const [statementLines, matches, candidateTransactions, errors] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where: { statementImportId: importId },
      include: { ignoredBy: true },
      orderBy: { lineNumber: "asc" },
    }),
    prisma.bankReconciliationMatch.findMany({
      where: { statementLine: { statementImportId: importId } },
      include: { matchedBy: true, unmatchedBy: true },
      orderBy: { matchedAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        bankAccountId: statementImport.bankAccountId,
        reconciliationStatus: "UNRECONCILED",
      },
      select: {
        id: true,
        bankTransactionNumber: true,
        transactionDate: true,
        amount: true,
        direction: true,
        currency: true,
        reference: true,
        description: true,
        reconciliationStatus: true,
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    }),
    prisma.bankStatementImportError.findMany({
      where: { statementImportId: importId },
      orderBy: { lineNumber: "asc" },
    }),
  ]);

  const candidateTxDtos = candidateTransactions.map((tx) => ({
    id: tx.id,
    bankTransactionNumber: tx.bankTransactionNumber,
    transactionDate: tx.transactionDate.toISOString(),
    amount: tx.amount.toString(),
    direction: tx.direction,
    currency: tx.currency,
    reference: tx.reference,
    description: tx.description,
    reconciliationStatus: tx.reconciliationStatus,
  }));

  return (
    <ImportDetailsClient
      statementImport={serializeBankStatementImport(statementImport)}
      statementLines={statementLines.map(serializeBankStatementLine)}
      matches={matches.map(serializeBankReconciliationMatch)}
      candidateTransactions={candidateTxDtos}
      errors={errors.map((e) => ({
        id: e.id,
        lineNumber: e.lineNumber,
        field: e.field,
        reason: e.reason,
        rawValue: e.rawValue,
      }))}
    />
  );
}
