import { prisma } from "../prisma";
import { getUserAuthorizedBranchScope, hasPermission } from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
import { DocumentCategory } from "@/generated/prisma/client";

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET
  );
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type MemberDocumentDTO = {
  id: string;
  memberId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
};

export async function getMemberDocuments(
  memberId: string,
  executorUserId?: string,
): Promise<MemberDocumentDTO[]> {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, branchId: true },
  });

  if (!member) {
    throw new Error("Member profile not found.");
  }

  if (executorUserId && executorUserId !== member.userId) {
    const hasViewPerm = await hasPermission(executorUserId, "members.documents.view");
    if (!hasViewPerm) {
      throw new Error("Unauthorized: Missing members.documents.view permission.");
    }
    const scope = await getUserAuthorizedBranchScope(executorUserId);
    if (!scope.global && !scope.branchIds.includes(member.branchId)) {
      throw new Error("Unauthorized: Member branch is outside your authorized scope.");
    }
  }

  const docs = await prisma.memberDocument.findMany({
    where: { memberId },
    include: {
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return docs.map((d) => ({
    id: d.id,
    memberId: d.memberId,
    category: d.category,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    storageKey: d.storageKey,
    uploadedById: d.uploadedById,
    uploadedByName: d.uploadedBy?.name || "System",
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function uploadMemberDocument(input: {
  memberId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById?: string;
  bypassStorageCheckForTest?: boolean;
}): Promise<MemberDocumentDTO> {
  const member = await prisma.memberProfile.findUnique({
    where: { id: input.memberId },
    select: { id: true, userId: true, branchId: true },
  });

  if (!member) {
    throw new Error("Member profile not found.");
  }

  if (input.uploadedById && input.uploadedById !== member.userId) {
    const hasManagePerm = await hasPermission(input.uploadedById, "members.documents.manage");
    if (!hasManagePerm) {
      throw new Error("Unauthorized: Missing members.documents.manage permission.");
    }
    const scope = await getUserAuthorizedBranchScope(input.uploadedById);
    if (!scope.global && !scope.branchIds.includes(member.branchId)) {
      throw new Error("Unauthorized: Member branch is outside your authorized scope.");
    }
  }

  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`Unsupported document file type '${input.mimeType}'. Allowed formats: PDF, JPEG, PNG, WEBP.`);
  }

  if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed limit of 5MB. Provided: ${(input.sizeBytes / (1024 * 1024)).toFixed(2)}MB`);
  }

  if (!input.bypassStorageCheckForTest && !isStorageConfigured()) {
    throw new Error("Storage provider not configured in environment. Binary uploads are disabled.");
  }

  const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const randomKey = `docs/${member.id}/${input.category.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${sanitizedFileName}`;

  const doc = await prisma.memberDocument.create({
    data: {
      memberId: member.id,
      category: input.category,
      fileName: sanitizedFileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: randomKey,
      uploadedById: input.uploadedById || member.userId,
    },
    include: {
      uploadedBy: { select: { name: true } },
    },
  });

  if (input.uploadedById) {
    await logAuditEvent({
      actorUserId: input.uploadedById,
      action: "MEMBER_DOCUMENT_UPLOADED",
      entityType: "MemberDocument",
      entityId: doc.id,
      branchId: member.branchId,
      metadata: {
        memberId: member.id,
        category: input.category,
        fileName: sanitizedFileName,
        sizeBytes: input.sizeBytes,
      },
    });
  }

  return {
    id: doc.id,
    memberId: doc.memberId,
    category: doc.category,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    storageKey: doc.storageKey,
    uploadedById: doc.uploadedById,
    uploadedByName: doc.uploadedBy?.name || "System",
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function deleteMemberDocument(
  documentId: string,
  executorUserId?: string,
): Promise<{ success: boolean }> {
  const doc = await prisma.memberDocument.findUnique({
    where: { id: documentId },
    include: { member: { select: { id: true, userId: true, branchId: true } } },
  });

  if (!doc) {
    throw new Error("Document not found.");
  }

  if (executorUserId && executorUserId !== doc.member.userId) {
    const hasManagePerm = await hasPermission(executorUserId, "members.documents.manage");
    if (!hasManagePerm) {
      throw new Error("Unauthorized: Missing members.documents.manage permission.");
    }
    const scope = await getUserAuthorizedBranchScope(executorUserId);
    if (!scope.global && !scope.branchIds.includes(doc.member.branchId)) {
      throw new Error("Unauthorized: Member branch is outside your authorized scope.");
    }
  }

  await prisma.memberDocument.delete({ where: { id: documentId } });

  if (executorUserId) {
    await logAuditEvent({
      actorUserId: executorUserId,
      action: "MEMBER_DOCUMENT_DELETED",
      entityType: "MemberDocument",
      entityId: documentId,
      branchId: doc.member.branchId,
      metadata: {
        memberId: doc.memberId,
        category: doc.category,
        fileName: doc.fileName,
      },
    });
  }

  return { success: true };
}
