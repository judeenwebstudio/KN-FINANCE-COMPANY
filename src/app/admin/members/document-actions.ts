"use server";

import { getCurrentUser } from "@/lib/authz";
import {
  getMemberDocuments,
  uploadMemberDocument,
  deleteMemberDocument,
  MemberDocumentDTO,
  isStorageConfigured,
} from "@/lib/members/document-service";
import { DocumentCategory } from "@/generated/prisma/client";

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

export async function uploadMemberDocumentAction(params: {
  memberId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ success: boolean; data?: MemberDocumentDTO; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    const doc = await uploadMemberDocument({ ...params, uploadedById: user.id });
    return { success: true, data: doc };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to upload document." };
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
