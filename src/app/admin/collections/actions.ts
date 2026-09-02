"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/authz";
import { requirePermission } from "@/lib/auth/authorize";
import type { CollectionActionType } from "@/generated/prisma/client";

import { serializeCollectionNote, type CollectionNoteDTO } from "@/lib/serializers";

export type CollectionNoteActionState = {
  success?: boolean;
  error?: string;
  data?: CollectionNoteDTO;
};

export async function createCollectionNoteAction(
  loanId: string,
  actionType: CollectionActionType,
  notes: string,
  followUpDateStr?: string | null,
  promiseToPayAmountNum?: number | null,
  promiseToPayDateStr?: string | null
): Promise<CollectionNoteActionState> {
  const admin = await requirePermission("loans.collections.manage");
  const accessibleBranchIds = await getAccessibleBranchIds();

  if (!notes || !notes.trim()) {
    return { error: "Notes content is required" };
  }

  if (actionType === "PROMISE_TO_PAY") {
    if (!promiseToPayDateStr) {
      return { error: "Promise-to-pay date is required for PROMISE_TO_PAY action" };
    }
    if (!promiseToPayAmountNum || promiseToPayAmountNum <= 0) {
      return { error: "Promise-to-pay amount must be greater than 0" };
    }
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { member: true },
  });

  if (!loan) return { error: "Loan facility not found" };

  if (!accessibleBranchIds.includes(loan.branchId)) {
    return { error: "You are not authorized to manage collections for this branch" };
  }

  try {
    const note = await prisma.collectionNote.create({
      data: {
        loanId: loan.id,
        memberId: loan.memberId,
        actionType,
        notes: notes.trim(),
        actionDate: new Date(),
        followUpDate: followUpDateStr ? new Date(followUpDateStr) : null,
        promiseToPayAmount: promiseToPayAmountNum ? promiseToPayAmountNum : null,
        promiseToPayDate: promiseToPayDateStr ? new Date(promiseToPayDateStr) : null,
        createdById: admin.id,
      },
      include: {
        createdBy: true,
      },
    });

    revalidatePath("/admin/overdue");
    revalidatePath("/admin/loans");
    revalidatePath(`/admin/loans/${loanId}`);

    return {
      success: true,
      data: serializeCollectionNote(note),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to record collection note" };
  }
}
