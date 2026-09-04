import { DocumentCategory } from "@/generated/prisma/client";
import { getUserAuthorizedBranchScope, hasPermission } from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
import { prisma } from "../prisma";
import { createPrivateObjectKey, deletePrivateFile, getPrivateFile, isStorageConfigured, uploadPrivateFile } from "../storage/private-file-storage";

export { isStorageConfigured };
export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export type MemberDocumentDTO = { id: string; memberId: string; category: DocumentCategory; fileName: string; mimeType: string; sizeBytes: number; uploadedByName: string; createdAt: string; fileUrl: string };

export function sanitizeFileName(name: string): string {
  const leaf = name.replace(/\\/g, "/").split("/").pop() || "document";
  return leaf.replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 120) || "document";
}

export function validateFileSignature(bytes: Uint8Array, mime: string): boolean {
  if (mime === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function authorizeMember(memberId: string, actorId: string, permission: "members.documents.view" | "members.documents.manage") {
  const member = await prisma.memberProfile.findUnique({ where: { id: memberId }, select: { id: true, userId: true, branchId: true } });
  if (!member) throw new Error("Member profile not found.");
  if (actorId === member.userId) return member;
  if (!(await hasPermission(actorId, permission))) throw new Error(`Unauthorized: Missing ${permission} permission.`);
  const scope = await getUserAuthorizedBranchScope(actorId);
  if (!scope.global && !scope.branchIds.includes(member.branchId)) throw new Error("Unauthorized: Member branch is outside your authorized scope.");
  return member;
}

export async function getMemberDocuments(memberId: string, actorId: string): Promise<MemberDocumentDTO[]> {
  await authorizeMember(memberId, actorId, "members.documents.view");
  const docs = await prisma.memberDocument.findMany({ where: { memberId }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  return docs.map((d) => ({ id: d.id, memberId: d.memberId, category: d.category, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes, uploadedByName: d.uploadedBy.name, createdAt: d.createdAt.toISOString(), fileUrl: `/api/member-documents/${d.id}/file` }));
}

export async function uploadMemberDocument(input: { memberId: string; category: DocumentCategory; fileName: string; mimeType: string; bytes?: Uint8Array; sizeBytes?: number; uploadedById: string; bypassStorageCheckForTest?: boolean }): Promise<MemberDocumentDTO> {
  const member = await authorizeMember(input.memberId, input.uploadedById, "members.documents.manage");
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) throw new Error("Unsupported document file type. Use PDF, JPEG, PNG, or WebP.");
  const size = input.bytes?.length ?? input.sizeBytes ?? 0;
  if (!size || size > MAX_DOCUMENT_SIZE_BYTES) throw new Error("File size exceeds maximum allowed limit of 5 MB.");
  if (!input.bypassStorageCheckForTest && (!input.bytes || !validateFileSignature(input.bytes, input.mimeType))) throw new Error("File content does not match its declared type.");
  const key = input.bypassStorageCheckForTest ? `test/${createPrivateObjectKey(member.id, "documents")}` : createPrivateObjectKey(member.id, "documents");
  if (!input.bypassStorageCheckForTest) await uploadPrivateFile({ key, bytes: input.bytes!, contentType: input.mimeType });
  try {
    const doc = await prisma.memberDocument.create({ data: { memberId: member.id, category: input.category, fileName: sanitizeFileName(input.fileName), mimeType: input.mimeType, sizeBytes: size, storageKey: key, uploadedById: input.uploadedById }, include: { uploadedBy: { select: { name: true } } } });
    await logAuditEvent({ actorUserId: input.uploadedById, action: "MEMBER_DOCUMENT_UPLOADED", entityType: "MemberDocument", entityId: doc.id, branchId: member.branchId, metadata: { memberId: member.id, category: input.category, mimeType: input.mimeType, sizeBytes: size } });
    return { id: doc.id, memberId: doc.memberId, category: doc.category, fileName: doc.fileName, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, uploadedByName: doc.uploadedBy.name, createdAt: doc.createdAt.toISOString(), fileUrl: `/api/member-documents/${doc.id}/file` };
  } catch (error) { if (!input.bypassStorageCheckForTest) await deletePrivateFile(key).catch(() => undefined); throw error; }
}

export async function getAuthorizedDocumentFile(documentId: string, actorId: string) {
  const doc = await prisma.memberDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found.");
  await authorizeMember(doc.memberId, actorId, "members.documents.view");
  const blob = await getPrivateFile(doc.storageKey);
  if (!blob) throw new Error("Stored document not found.");
  return { doc, stream: blob.stream };
}

export async function deleteMemberDocument(documentId: string, actorId: string): Promise<{ success: true }> {
  const doc = await prisma.memberDocument.findUnique({ where: { id: documentId }, include: { member: { select: { branchId: true } } } });
  if (!doc) throw new Error("Document not found.");
  await authorizeMember(doc.memberId, actorId, "members.documents.manage");
  await prisma.memberDocument.delete({ where: { id: documentId } });
  if (!doc.storageKey.startsWith("test/")) await deletePrivateFile(doc.storageKey);
  await logAuditEvent({ actorUserId: actorId, action: "MEMBER_DOCUMENT_DELETED", entityType: "MemberDocument", entityId: documentId, branchId: doc.member.branchId, metadata: { memberId: doc.memberId, category: doc.category, mimeType: doc.mimeType } });
  return { success: true };
}

export async function uploadMemberPhoto(input: { memberId: string; mimeType: string; bytes: Uint8Array; actorId: string }) {
  const member = await authorizeMember(input.memberId, input.actorId, "members.documents.manage");
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) throw new Error("Photo must be JPEG, PNG, or WebP.");
  if (!input.bytes.length || input.bytes.length > MAX_PHOTO_SIZE_BYTES) throw new Error("Photo must be between 1 byte and 5 MB.");
  if (!validateFileSignature(input.bytes, input.mimeType)) throw new Error("Photo content does not match its declared type.");
  const key = createPrivateObjectKey(member.id, "photo");
  await uploadPrivateFile({ key, bytes: input.bytes, contentType: input.mimeType });
  const previous = await prisma.memberProfile.findUnique({ where: { id: member.id }, select: { photoStorageKey: true } });
  try {
    await prisma.memberProfile.update({ where: { id: member.id }, data: { photoStorageKey: key } });
    await logAuditEvent({ actorUserId: input.actorId, action: previous?.photoStorageKey ? "MEMBER_PHOTO_REPLACED" : "MEMBER_PHOTO_UPLOADED", entityType: "MemberProfile", entityId: member.id, branchId: member.branchId, metadata: { mimeType: input.mimeType, sizeBytes: input.bytes.length } });
  } catch (error) { await deletePrivateFile(key).catch(() => undefined); throw error; }
  if (previous?.photoStorageKey) await deletePrivateFile(previous.photoStorageKey).catch(() => undefined);
  return { photoUrl: `/api/member-photo/${member.id}` };
}

export async function getAuthorizedMemberPhoto(memberId: string, actorId: string) {
  const member = await authorizeMember(memberId, actorId, "members.documents.view");
  const row = await prisma.memberProfile.findUnique({ where: { id: member.id }, select: { photoStorageKey: true } });
  return row?.photoStorageKey ? getPrivateFile(row.photoStorageKey) : null;
}

export async function deleteMemberPhoto(memberId: string, actorId: string) {
  const member = await authorizeMember(memberId, actorId, "members.documents.manage");
  const row = await prisma.memberProfile.findUnique({ where: { id: member.id }, select: { photoStorageKey: true } });
  if (!row?.photoStorageKey) return { success: true } as const;
  await prisma.memberProfile.update({ where: { id: member.id }, data: { photoStorageKey: null } });
  await deletePrivateFile(row.photoStorageKey);
  await logAuditEvent({ actorUserId: actorId, action: "MEMBER_PHOTO_REMOVED", entityType: "MemberProfile", entityId: member.id, branchId: member.branchId, metadata: {} });
  return { success: true } as const;
}
