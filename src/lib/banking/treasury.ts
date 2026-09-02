"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import { Prisma } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;

export async function createTreasuryAccountAction(input: {
  name: string;
  code: string;
  branchId: string;
  currency: string;
  openingBalance?: number;
}) {
  try {
    const user = await requirePermission("banking.manage_accounts");
    const branchIds = await getAccessibleBranchIds();

    if (!branchIds.includes(input.branchId)) {
      return { error: "Unauthorized: Access denied for branch" };
    }

    const code = input.code.trim().toUpperCase();
    const accountNumber = `TREAS-${code}-${Date.now()}`;
    const openingBal = new Decimal(input.openingBalance && input.openingBalance > 0 ? input.openingBalance : 0);

    const treasuryAccount = await prisma.$transaction(async (tx) => {
      const created = await tx.treasuryAccount.create({
        data: {
          name: input.name.trim(),
          code,
          accountNumber,
          branchId: input.branchId,
          currency: input.currency.toUpperCase(),
          balance: openingBal,
          status: "ACTIVE",
          createdById: user.id,
        },
      });

      if (openingBal.gt(0)) {
        await tx.treasuryTransaction.create({
          data: {
            treasuryTransactionNumber: `TTX-OPN-${Date.now()}`,
            treasuryAccountId: created.id,
            type: "OPENING_BALANCE",
            direction: "CREDIT",
            amount: openingBal,
            currency: input.currency.toUpperCase(),
            balanceBefore: new Decimal(0),
            balanceAfter: openingBal,
            reference: `OPN-${code}`,
            description: "Opening cash balance",
            createdById: user.id,
          },
        });
      }

      return created;
    });

    revalidatePath("/admin/treasury");
    revalidatePath("/admin/dashboard");
    return { data: treasuryAccount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create treasury account";
    return { error: msg };
  }
}
