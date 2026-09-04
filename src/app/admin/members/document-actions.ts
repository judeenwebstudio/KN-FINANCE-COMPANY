"use server";

import { getCurrentUser } from "@/lib/authz";
import {
  getMemberDocuments,
  deleteMemberDocument,
  MemberDocumentDTO,
  isStorageConfigured,
} from "@/lib/members/document-service";

export async function getMemberDocumentsAction(
  memberId: string,
): Promise<{ success: boolean; data?: MemberDocumentDTO[]; isStorageConfigured?: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    const docs = await getMemberDocuments(memberId, user.id);
    return { success: true, data: docs, isStorageConfigured: isStorageConfigured() };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to fetch member documents." };
  }
}

export async function deleteMemberDocumentAction(
  documentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    const res = await deleteMemberDocument(documentId, user.id);
    return { success: res.success };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to delete document." };
  }
}
