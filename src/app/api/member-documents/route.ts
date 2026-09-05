import { DocumentCategory } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/authz";
import { hasAdminPortalAccess, getUserEffectivePermissions } from "@/lib/auth/authorize";
import { uploadMemberDocument } from "@/lib/members/document-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const submittedMemberId = form.get("memberId");
    const category = form.get("category");

    if (
      !(file instanceof File) ||
      typeof submittedMemberId !== "string" ||
      !Object.values(DocumentCategory).includes(category as DocumentCategory)
    ) {
      return Response.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const isAdmin = await hasAdminPortalAccess(user.id);
    let targetMemberId: string;

    if (isAdmin) {
      const perms = await getUserEffectivePermissions(user.id);
      if (!perms.has("members.documents.manage")) {
        return Response.json({ error: "Unauthorized: Missing members.documents.manage permission." }, { status: 403 });
      }
      targetMemberId = submittedMemberId;
    } else if (user.memberProfile) {
      if (submittedMemberId !== user.memberProfile.id) {
        return Response.json({ error: "Forbidden: Cannot upload document for another member." }, { status: 403 });
      }
      targetMemberId = user.memberProfile.id;
    } else {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    const doc = await uploadMemberDocument({
      memberId: targetMemberId,
      category: category as DocumentCategory,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      uploadedById: user.id,
    });

    return Response.json({ data: doc }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
