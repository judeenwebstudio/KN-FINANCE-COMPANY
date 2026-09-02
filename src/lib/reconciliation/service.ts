import { prisma } from "@/lib/prisma";
import { resolveAuthorizedBranchIds } from "@/lib/reports/filters";
import { getUserAuthorizedBranchScope } from "@/lib/auth/authorize";
import { parseBankStatementCsv } from "./parser";
import { findAutoMatches, MatchingCandidate } from "./matching";

export type ImportBankStatementInput = {
  bankAccountId: string;
  fileName: string;
  fileContent: string;
  createdById?: string;
};

export type ManualMatchInput = {
  statementLineId: string;
  bankTransactionId: string;
  actorId?: string;
};

export type UnmatchInput = {
  matchId: string;
  unmatchReason: string;
  actorId?: string;
};

export type IgnoreLineInput = {
  statementLineId: string;
  ignoreReason: string;
  actorId?: string;
};

async function resolveServiceBranchIds(actorId?: string) {
  if (actorId) {
    const scope = await getUserAuthorizedBranchScope(actorId);
    return scope.branchIds;
  }

  return resolveAuthorizedBranchIds();
}

/**
 * Imports a CSV bank statement for a specific BankAccount after verifying branch scope,
 * duplicate file hashes, currency consistency, and row validations.
 */
export async function processBankStatementImport(input: ImportBankStatementInput) {
  const branchIds = await resolveServiceBranchIds(input.createdById);

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: input.bankAccountId, branchId: { in: branchIds } },
    include: { branch: true },
  });

  if (!bankAccount) {
    throw new Error("Bank account not found or access denied.");
  }

  // Parse CSV
  const parseResult = parseBankStatementCsv(input.fileContent, bankAccount.currency);

  // Check duplicate import file hash per BankAccount
  const existingImport = await prisma.bankStatementImport.findUnique({
    where: {
      bankAccountId_fileHash: {
        bankAccountId: bankAccount.id,
        fileHash: parseResult.fileHash,
      },
    },
  });

  if (existingImport) {
    throw new Error(
      `Duplicate statement file import detected for bank account ${bankAccount.name} (${bankAccount.accountNumber}). Import #${existingImport.importNumber} already processed this file.`
    );
  }

  const importNumber = `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const result = await prisma.$transaction(async (tx) => {
    const isSuccess = parseResult.validRows.length > 0;
    const status = isSuccess ? "READY" : "FAILED";
    const failureReason = !isSuccess ? parseResult.errors.map((e) => e.reason).join("; ") || "No valid statement lines parsed" : null;

    const statementImport = await tx.bankStatementImport.create({
      data: {
        importNumber,
        bankAccountId: bankAccount.id,
        branchId: bankAccount.branchId,
        fileName: input.fileName,
        fileHash: parseResult.fileHash,
        statementStartDate: parseResult.statementStartDate,
        statementEndDate: parseResult.statementEndDate,
        currency: bankAccount.currency,
        status,
        rowCount: parseResult.rowCount,
        validRowCount: parseResult.validRows.length,
        invalidRowCount: parseResult.errors.length,
        failureReason,
        createdById: input.createdById,
        completedAt: isSuccess ? undefined : new Date(),
      },
    });

    if (parseResult.validRows.length > 0) {
      await tx.bankStatementLine.createMany({
        data: parseResult.validRows.map((row) => ({
          statementImportId: statementImport.id,
          lineNumber: row.lineNumber,
          transactionDate: row.transactionDate,
          description: row.description,
          reference: row.reference,
          externalTransactionId: row.externalTransactionId,
          direction: row.direction,
          amount: row.amount,
          currency: row.currency,
          runningBalance: row.runningBalance,
          status: "UNMATCHED",
          rawDescription: row.rawDescription,
        })),
      });
    }

    if (parseResult.errors.length > 0) {
      await tx.bankStatementImportError.createMany({
        data: parseResult.errors.map((err) => ({
          statementImportId: statementImport.id,
          lineNumber: err.lineNumber,
          field: err.field,
          reason: err.reason,
          rawValue: err.rawValue,
        })),
      });
    }

    return statementImport;
  });

  return result;
}

/**
 * Runs conservative auto-matching engine over an import's unmatched statement lines
 * against unreconciled internal BankTransactions for the same account.
 */
export async function executeAutoMatch(importId: string, actorId?: string) {
  const branchIds = await resolveServiceBranchIds(actorId);

  const statementImport = await prisma.bankStatementImport.findFirst({
    where: { id: importId, branchId: { in: branchIds } },
    include: {
      statementLines: {
        where: { status: "UNMATCHED" },
      },
    },
  });

  if (!statementImport) {
    throw new Error("Statement import not found or access denied.");
  }

  const unreconciledTxList = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: statementImport.bankAccountId,
      reconciliationStatus: "UNRECONCILED",
    },
  });

  const candidates: MatchingCandidate[] = unreconciledTxList.map((tx) => ({
    bankTransactionId: tx.id,
    bankTransactionNumber: tx.bankTransactionNumber,
    transactionDate: tx.transactionDate,
    amount: tx.amount,
    direction: tx.direction,
    currency: tx.currency,
    reference: tx.reference,
    description: tx.description,
    reconciliationStatus: tx.reconciliationStatus,
  }));

  const autoMatches = findAutoMatches(statementImport.statementLines, candidates);

  if (autoMatches.length === 0) {
    return { matchesCreated: 0, autoMatches };
  }

  const matchesCreated = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const match of autoMatches) {
      // Concurrency check: Ensure line & tx do not already have an active match
      const existingLineMatch = await tx.bankReconciliationMatch.findFirst({
        where: { statementLineId: match.statementLineId, status: "ACTIVE" },
      });
      const existingTxMatch = await tx.bankReconciliationMatch.findFirst({
        where: { bankTransactionId: match.candidateId, status: "ACTIVE" },
      });

      if (existingLineMatch || existingTxMatch) continue;

      const line = statementImport.statementLines.find((l) => l.id === match.statementLineId);

      const matchRecord = await tx.bankReconciliationMatch.create({
        data: {
          statementLineId: match.statementLineId,
          bankTransactionId: match.candidateId,
          matchType: "AUTO",
          status: "ACTIVE",
          matchedById: actorId,
        },
      });

      await tx.bankStatementLine.update({
        where: { id: match.statementLineId },
        data: { status: "MATCHED", activeMatchId: matchRecord.id },
      });

      await tx.bankTransaction.update({
        where: { id: match.candidateId },
        data: {
          reconciliationStatus: "RECONCILED",
          reconciledAt: new Date(),
          reconciledById: actorId,
          externalStatementReference: line?.reference || undefined,
          activeMatchId: matchRecord.id,
        },
      });

      count++;
    }

    return count;
  });

  return { matchesCreated, autoMatches };
}

/**
 * Manually matches an unmatched BankStatementLine to an unreconciled BankTransaction.
 */
export async function executeManualMatch(input: ManualMatchInput) {
  const branchIds = await resolveServiceBranchIds(input.actorId);

  const line = await prisma.bankStatementLine.findUnique({
    where: { id: input.statementLineId },
    include: { statementImport: true },
  });

  if (!line || !branchIds.includes(line.statementImport.branchId)) {
    throw new Error("Statement line not found or access denied.");
  }

  const bankTx = await prisma.bankTransaction.findUnique({
    where: { id: input.bankTransactionId },
    include: { bankAccount: true },
  });

  if (!bankTx || !branchIds.includes(bankTx.bankAccount.branchId)) {
    throw new Error("Bank transaction not found or access denied.");
  }

  // Validations
  if (line.statementImport.bankAccountId !== bankTx.bankAccountId) {
    throw new Error("Cannot match statement line and bank transaction from different bank accounts.");
  }
  if (line.currency.toUpperCase() !== bankTx.currency.toUpperCase()) {
    throw new Error("Currency mismatch between statement line and bank transaction.");
  }
  if (line.direction !== bankTx.direction) {
    throw new Error("Financial direction mismatch (CREDIT vs DEBIT).");
  }
  if (!line.amount.equals(bankTx.amount)) {
    throw new Error(`Amount mismatch: line has ${line.amount.toString()} but transaction has ${bankTx.amount.toString()}.`);
  }

  return await prisma.$transaction(async (tx) => {
    // Concurrency safe check using DB active pointer architecture
    if (line.activeMatchId) {
      throw new Error("This statement line already has an active match.");
    }
    if (bankTx.activeMatchId) {
      throw new Error("This bank transaction already has an active match.");
    }

    const matchRecord = await tx.bankReconciliationMatch.create({
      data: {
        statementLineId: line.id,
        bankTransactionId: bankTx.id,
        matchType: "MANUAL",
        status: "ACTIVE",
        matchedById: input.actorId,
      },
    });

    await tx.bankStatementLine.update({
      where: { id: line.id },
      data: { status: "MATCHED", activeMatchId: matchRecord.id },
    });

    await tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: {
        reconciliationStatus: "RECONCILED",
        reconciledAt: new Date(),
        reconciledById: input.actorId,
        externalStatementReference: line.reference || undefined,
        activeMatchId: matchRecord.id,
      },
    });

    return matchRecord;
  });
}

/**
 * Unmatches an existing ACTIVE match, preserving historical evidence while restoring statuses.
 */
export async function executeUnmatch(input: UnmatchInput) {
  if (!input.unmatchReason || !input.unmatchReason.trim()) {
    throw new Error("An explicit reason is required to unmatch a transaction.");
  }

  const branchIds = await resolveServiceBranchIds(input.actorId);

  const matchRecord = await prisma.bankReconciliationMatch.findUnique({
    where: { id: input.matchId },
    include: {
      statementLine: { include: { statementImport: true } },
      bankTransaction: { include: { bankAccount: true } },
    },
  });

  if (!matchRecord) {
    throw new Error("Reconciliation match record not found.");
  }

  if (
    !branchIds.includes(matchRecord.statementLine.statementImport.branchId) ||
    !branchIds.includes(matchRecord.bankTransaction.bankAccount.branchId)
  ) {
    throw new Error("Access denied.");
  }

  if (matchRecord.status !== "ACTIVE") {
    throw new Error("This match is not currently active.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Update match record to UNMATCHED (preserving matchedById and matchedAt)
    const updatedMatch = await tx.bankReconciliationMatch.update({
      where: { id: matchRecord.id },
      data: {
        status: "UNMATCHED",
        unmatchedById: input.actorId,
        unmatchedAt: new Date(),
        unmatchReason: input.unmatchReason.trim(),
      },
    });

    // 2. Restore statement line status to UNMATCHED and clear activeMatchId pointer
    await tx.bankStatementLine.update({
      where: { id: matchRecord.statementLineId },
      data: { status: "UNMATCHED", activeMatchId: null },
    });

    // 3. Restore BankTransaction status to UNRECONCILED and clear activeMatchId pointer
    await tx.bankTransaction.update({
      where: { id: matchRecord.bankTransactionId },
      data: {
        reconciliationStatus: "UNRECONCILED",
        reconciledAt: null,
        reconciledById: null,
        activeMatchId: null,
      },
    });

    return updatedMatch;
  });
}

/**
 * Ignores a statement line (e.g., bank fee already handled elsewhere, interest line to skip).
 */
export async function executeIgnoreLine(input: IgnoreLineInput) {
  if (!input.ignoreReason || !input.ignoreReason.trim()) {
    throw new Error("A reason is required to ignore a statement line.");
  }

  const branchIds = await resolveServiceBranchIds(input.actorId);

  const line = await prisma.bankStatementLine.findUnique({
    where: { id: input.statementLineId },
    include: { statementImport: true },
  });

  if (!line || !branchIds.includes(line.statementImport.branchId)) {
    throw new Error("Statement line not found or access denied.");
  }

  if (line.status === "MATCHED") {
    throw new Error("Cannot ignore a matched statement line. Unmatch it first.");
  }

  return await prisma.bankStatementLine.update({
    where: { id: line.id },
    data: {
      status: "IGNORED",
      ignoredAt: new Date(),
      ignoredById: input.actorId,
      ignoreReason: input.ignoreReason.trim(),
    },
  });
}

/**
 * Restores an IGNORED statement line back to UNMATCHED.
 */
export async function executeUnignoreLine(statementLineId: string, actorId?: string) {
  const branchIds = await resolveServiceBranchIds(actorId);

  const line = await prisma.bankStatementLine.findUnique({
    where: { id: statementLineId },
    include: { statementImport: true },
  });

  if (!line || !branchIds.includes(line.statementImport.branchId)) {
    throw new Error("Statement line not found or access denied.");
  }

  if (line.status !== "IGNORED") {
    throw new Error("Line is not currently ignored.");
  }

  return await prisma.bankStatementLine.update({
    where: { id: line.id },
    data: {
      status: "UNMATCHED",
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
    },
  });
}
