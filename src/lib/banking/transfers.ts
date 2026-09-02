"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { Prisma } from "@/generated/prisma/client";
import type { TransferType } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export async function createTransferAction(input: {
  transferType: TransferType;
  sourceTreasuryAccountId?: string | null;
  sourceBankAccountId?: string | null;
  destinationTreasuryAccountId?: string | null;
  destinationBankAccountId?: string | null;
  amount: number;
  currency: string;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}) {
  try {
    const user = await requirePermission("banking.transfer");
    const branchIds = await getAccessibleBranchIds();

    if (input.amount <= 0) return { error: "Transfer amount must be greater than zero" };

    // 1. Strict XOR & Type Validation
    if (input.transferType === "CASH_TO_BANK") {
      if (!input.sourceTreasuryAccountId || !input.destinationBankAccountId || input.sourceBankAccountId || input.destinationTreasuryAccountId) {
        return { error: "CASH_TO_BANK transfer requires sourceTreasuryAccountId and destinationBankAccountId" };
      }
    } else if (input.transferType === "BANK_TO_CASH") {
      if (!input.sourceBankAccountId || !input.destinationTreasuryAccountId || input.sourceTreasuryAccountId || input.destinationBankAccountId) {
        return { error: "BANK_TO_CASH transfer requires sourceBankAccountId and destinationTreasuryAccountId" };
      }
    } else if (input.transferType === "BANK_TO_BANK") {
      if (!input.sourceBankAccountId || !input.destinationBankAccountId || input.sourceTreasuryAccountId || input.destinationTreasuryAccountId) {
        return { error: "BANK_TO_BANK transfer requires sourceBankAccountId and destinationBankAccountId" };
      }
      if (input.sourceBankAccountId === input.destinationBankAccountId) {
        return { error: "Source and destination bank accounts cannot be the same" };
      }
    } else {
      return { error: "Invalid transferType" };
    }

    const trfAmount = new Decimal(input.amount);
    const key = input.idempotencyKey ? input.idempotencyKey.trim() : null;

    if (key) {
      const existing = await prisma.transfer.findFirst({ where: { reference: key } });
      if (existing) {
        return { error: "Duplicate transfer request rejected (Idempotency key matched)." };
      }
    }

    const transferNumber = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch source and destination and validate branch & currency
      let sourceBranchId: string;
      let sourceCurr: string;

      let destBranchId: string;
      let destCurr: string;

      let srcTreasury: Awaited<ReturnType<typeof tx.treasuryAccount.findUnique>> = null;
      let srcBank: Awaited<ReturnType<typeof tx.bankAccount.findUnique>> = null;
      let destTreasury: Awaited<ReturnType<typeof tx.treasuryAccount.findUnique>> = null;
      let destBank: Awaited<ReturnType<typeof tx.bankAccount.findUnique>> = null;

      // Validate Source Leg
      if (input.sourceTreasuryAccountId) {
        srcTreasury = await tx.treasuryAccount.findUnique({ where: { id: input.sourceTreasuryAccountId } });
        if (!srcTreasury) throw new Error("Source treasury account not found");
        if (srcTreasury.status !== "ACTIVE") throw new Error("Source treasury account is not ACTIVE");
        sourceBranchId = srcTreasury.branchId;
        sourceCurr = srcTreasury.currency;

        if (srcTreasury.balance.lt(trfAmount)) {
          throw new Error(`Insufficient source treasury funds: Available ${srcTreasury.balance.toFixed(2)}, required ${trfAmount.toFixed(2)}`);
        }
      } else {
        srcBank = await tx.bankAccount.findUnique({ where: { id: input.sourceBankAccountId! } });
        if (!srcBank) throw new Error("Source bank account not found");
        if (srcBank.status !== "ACTIVE") throw new Error("Source bank account is not ACTIVE");
        sourceBranchId = srcBank.branchId;
        sourceCurr = srcBank.currency;

        if (srcBank.currentBalance.lt(trfAmount)) {
          throw new Error(`Insufficient source bank funds: Available ${srcBank.currentBalance.toFixed(2)}, required ${trfAmount.toFixed(2)}`);
        }
      }

      // Validate Destination Leg
      if (input.destinationTreasuryAccountId) {
        destTreasury = await tx.treasuryAccount.findUnique({ where: { id: input.destinationTreasuryAccountId } });
        if (!destTreasury) throw new Error("Destination treasury account not found");
        if (destTreasury.status !== "ACTIVE") throw new Error("Destination treasury account is not ACTIVE");
        destBranchId = destTreasury.branchId;
        destCurr = destTreasury.currency;
      } else {
        destBank = await tx.bankAccount.findUnique({ where: { id: input.destinationBankAccountId! } });
        if (!destBank) throw new Error("Destination bank account not found");
        if (destBank.status !== "ACTIVE") throw new Error("Destination bank account is not ACTIVE");
        destBranchId = destBank.branchId;
        destCurr = destBank.currency;
      }

      // Phase 4 Safeguards: Branch scope access, Same-Branch restriction, Currency match
      if (!branchIds.includes(sourceBranchId) || !branchIds.includes(destBranchId)) {
        throw new Error("Unauthorized branch access");
      }

      if (sourceBranchId !== destBranchId) {
        throw new Error("Phase 4 Restriction: Transfers are restricted to accounts within the SAME branch");
      }

      if (sourceCurr !== destCurr || sourceCurr !== input.currency.toUpperCase()) {
        throw new Error(`Currency mismatch: Source (${sourceCurr}) and Destination (${destCurr}) must match transfer currency (${input.currency.toUpperCase()})`);
      }

      // Execute Mutative Debits and Credits
      // Source Debit
      if (srcTreasury) {
        const balBefore = srcTreasury.balance;
        const balAfter = balBefore.sub(trfAmount);
        await tx.treasuryAccount.update({
          where: { id: srcTreasury.id },
          data: { balance: balAfter },
        });
      } else if (srcBank) {
        const balBefore = srcBank.currentBalance;
        const balAfter = balBefore.sub(trfAmount);
        await tx.bankAccount.update({
          where: { id: srcBank.id },
          data: { currentBalance: balAfter },
        });
      }

      // Destination Credit
      if (destTreasury) {
        const balBefore = destTreasury.balance;
        const balAfter = balBefore.add(trfAmount);
        await tx.treasuryAccount.update({
          where: { id: destTreasury.id },
          data: { balance: balAfter },
        });
      } else if (destBank) {
        const balBefore = destBank.currentBalance;
        const balAfter = balBefore.add(trfAmount);
        await tx.bankAccount.update({
          where: { id: destBank.id },
          data: { currentBalance: balAfter },
        });
      }

      // Create Workflow Transfer Record
      const transfer = await tx.transfer.create({
        data: {
          transferNumber,
          transferType: input.transferType,
          sourceTreasuryAccountId: input.sourceTreasuryAccountId || null,
          sourceBankAccountId: input.sourceBankAccountId || null,
          destinationTreasuryAccountId: input.destinationTreasuryAccountId || null,
          destinationBankAccountId: input.destinationBankAccountId || null,
          amount: trfAmount,
          currency: sourceCurr,
          reference: key || input.reference?.trim() || null,
          notes: input.notes?.trim() || null,
          status: "COMPLETED",
          createdById: user.id,
        },
      });

      // Post Leg 1 DEBIT Ledger Entry
      if (srcTreasury) {
        const balBefore = srcTreasury.balance;
        const balAfter = balBefore.sub(trfAmount);
        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-TRF-OUT-${Date.now()}`,
            treasuryAccountId: srcTreasury.id,
            type: "TRANSFER_OUT",
            direction: "DEBIT",
            amount: trfAmount,
            currency: sourceCurr,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: transfer.id,
            reference: key || input.reference?.trim() || null,
            description: `Transfer Out: ${transferNumber}`,
            createdById: user.id,
          },
        });
      } else if (srcBank) {
        const balBefore = srcBank.currentBalance;
        const balAfter = balBefore.sub(trfAmount);
        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-TRF-OUT-${Date.now()}`,
            bankAccountId: srcBank.id,
            type: "TRANSFER_OUT",
            direction: "DEBIT",
            amount: trfAmount,
            currency: sourceCurr,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: transfer.id,
            reference: key || input.reference?.trim() || null,
            description: `Transfer Out: ${transferNumber}`,
            createdById: user.id,
          },
        });
      }

      // Post Leg 2 CREDIT Ledger Entry
      if (destTreasury) {
        const balBefore = destTreasury.balance;
        const balAfter = balBefore.add(trfAmount);
        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-TRF-IN-${Date.now()}`,
            treasuryAccountId: destTreasury.id,
            type: "TRANSFER_IN",
            direction: "CREDIT",
            amount: trfAmount,
            currency: sourceCurr,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: transfer.id,
            reference: key || input.reference?.trim() || null,
            description: `Transfer In: ${transferNumber}`,
            createdById: user.id,
          },
        });
      } else if (destBank) {
        const balBefore = destBank.currentBalance;
        const balAfter = balBefore.add(trfAmount);
        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-TRF-IN-${Date.now()}`,
            bankAccountId: destBank.id,
            type: "TRANSFER_IN",
            direction: "CREDIT",
            amount: trfAmount,
            currency: sourceCurr,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: transfer.id,
            reference: key || input.reference?.trim() || null,
            description: `Transfer In: ${transferNumber}`,
            createdById: user.id,
          },
        });
      }

      return transfer;
    });

    revalidatePath("/admin/transfers");
    revalidatePath("/admin/bank-accounts");
    revalidatePath("/admin/dashboard");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to execute transfer";
    return { error: msg };
  }
}

export async function reverseTransferAction(transferId: string, reversalReason: string) {
  try {
    const user = await requirePermission("banking.reverse_transfer");

    if (!reversalReason || !reversalReason.trim()) {
      return { error: "Reversal reason is mandatory" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const origTransfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          reversedByTransfer: true,
        },
      });

      if (!origTransfer) throw new Error("Original transfer record not found");
      if (origTransfer.status === "REVERSED" || origTransfer.reversedAt !== null || origTransfer.reversedByTransfer) {
        throw new Error("Transfer has already been reversed");
      }
      if (origTransfer.reversalOfId !== null) {
        throw new Error("A reversal transfer itself cannot be reversed");
      }

      const trfAmount = origTransfer.amount;

      // Check destination account (must have sufficient funds for reversing DEBIT)
      if (origTransfer.destinationTreasuryAccountId) {
        const destTreasury = await tx.treasuryAccount.findUnique({ where: { id: origTransfer.destinationTreasuryAccountId } });
        if (!destTreasury) throw new Error("Destination treasury account not found for reversal");
        if (destTreasury.balance.lt(trfAmount)) {
          throw new Error(`Reversal blocked: Destination account has insufficient funds (${destTreasury.balance.toFixed(2)}) to reverse transfer of ${trfAmount.toFixed(2)}`);
        }
      } else if (origTransfer.destinationBankAccountId) {
        const destBank = await tx.bankAccount.findUnique({ where: { id: origTransfer.destinationBankAccountId } });
        if (!destBank) throw new Error("Destination bank account not found for reversal");
        if (destBank.currentBalance.lt(trfAmount)) {
          throw new Error(`Reversal blocked: Destination account has insufficient funds (${destBank.currentBalance.toFixed(2)}) to reverse transfer of ${trfAmount.toFixed(2)}`);
        }
      }

      // Mark original transfer REVERSED
      await tx.transfer.update({
        where: { id: origTransfer.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedById: user.id,
          reversalReason: reversalReason.trim(),
        },
      });

      // Create new reversal Transfer record
      let revTransferType: TransferType;
      if (origTransfer.transferType === "CASH_TO_BANK") revTransferType = "BANK_TO_CASH";
      else if (origTransfer.transferType === "BANK_TO_CASH") revTransferType = "CASH_TO_BANK";
      else revTransferType = "BANK_TO_BANK";

      const reversalTransfer = await tx.transfer.create({
        data: {
          transferNumber: `TRF-REV-${Date.now()}`,
          transferType: revTransferType,
          sourceTreasuryAccountId: origTransfer.destinationTreasuryAccountId,
          sourceBankAccountId: origTransfer.destinationBankAccountId,
          destinationTreasuryAccountId: origTransfer.sourceTreasuryAccountId,
          destinationBankAccountId: origTransfer.sourceBankAccountId,
          amount: trfAmount,
          currency: origTransfer.currency,
          reference: `REV-${origTransfer.transferNumber}`,
          notes: `Reversal: ${reversalReason.trim()}`,
          status: "COMPLETED",
          reversalOfId: origTransfer.id,
          createdById: user.id,
        },
      });

      // Reverse Destination Leg (DEBIT destination)
      if (origTransfer.destinationTreasuryAccountId) {
        const destAcc = await tx.treasuryAccount.findUnique({ where: { id: origTransfer.destinationTreasuryAccountId } });
        const balBefore = destAcc!.balance;
        const balAfter = balBefore.sub(trfAmount);

        await tx.treasuryAccount.update({
          where: { id: destAcc!.id },
          data: { balance: balAfter },
        });

        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-REV-DEB-${Date.now()}`,
            treasuryAccountId: destAcc!.id,
            type: "REVERSAL",
            direction: "DEBIT",
            amount: trfAmount,
            currency: origTransfer.currency,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: reversalTransfer.id,
            reference: `REV-${origTransfer.transferNumber}`,
            description: `Transfer Reversal Debit: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      } else if (origTransfer.destinationBankAccountId) {
        const destAcc = await tx.bankAccount.findUnique({ where: { id: origTransfer.destinationBankAccountId } });
        const balBefore = destAcc!.currentBalance;
        const balAfter = balBefore.sub(trfAmount);

        await tx.bankAccount.update({
          where: { id: destAcc!.id },
          data: { currentBalance: balAfter },
        });

        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-REV-DEB-${Date.now()}`,
            bankAccountId: destAcc!.id,
            type: "REVERSAL",
            direction: "DEBIT",
            amount: trfAmount,
            currency: origTransfer.currency,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: reversalTransfer.id,
            reference: `REV-${origTransfer.transferNumber}`,
            description: `Transfer Reversal Debit: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      }

      // Reverse Source Leg (CREDIT source)
      if (origTransfer.sourceTreasuryAccountId) {
        const srcAcc = await tx.treasuryAccount.findUnique({ where: { id: origTransfer.sourceTreasuryAccountId } });
        const balBefore = srcAcc!.balance;
        const balAfter = balBefore.add(trfAmount);

        await tx.treasuryAccount.update({
          where: { id: srcAcc!.id },
          data: { balance: balAfter },
        });

        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-REV-CRE-${Date.now()}`,
            treasuryAccountId: srcAcc!.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amount: trfAmount,
            currency: origTransfer.currency,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: reversalTransfer.id,
            reference: `REV-${origTransfer.transferNumber}`,
            description: `Transfer Reversal Credit: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      } else if (origTransfer.sourceBankAccountId) {
        const srcAcc = await tx.bankAccount.findUnique({ where: { id: origTransfer.sourceBankAccountId } });
        const balBefore = srcAcc!.currentBalance;
        const balAfter = balBefore.add(trfAmount);

        await tx.bankAccount.update({
          where: { id: srcAcc!.id },
          data: { currentBalance: balAfter },
        });

        await tx.bankTransaction.create({
          data: {
            bankTransactionNumber: `BTX-REV-CRE-${Date.now()}`,
            bankAccountId: srcAcc!.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amount: trfAmount,
            currency: origTransfer.currency,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            transferId: reversalTransfer.id,
            reference: `REV-${origTransfer.transferNumber}`,
            description: `Transfer Reversal Credit: ${reversalReason.trim()}`,
            createdById: user.id,
          },
        });
      }

      return reversalTransfer;
    });

    revalidatePath("/admin/transfers");
    revalidatePath("/admin/bank-accounts");
    revalidatePath("/admin/dashboard");
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reverse transfer";
    return { error: msg };
  }
}
