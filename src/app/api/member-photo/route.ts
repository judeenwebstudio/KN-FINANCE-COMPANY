import { getCurrentUser } from "@/lib/authz";
import { hasAdminPortalAccess, getUserEffectivePermissions } from "@/lib/auth/authorize";
import { uploadMemberPhoto } from "@/lib/members/document-service";

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

    if (!(file instanceof File) || typeof submittedMemberId !== "string") {
      return Response.json({ error: "Invalid photo request." }, { status: 400 });
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
        return Response.json({ error: "Forbidden: Cannot upload photo for another member." }, { status: 403 });
      }
      targetMemberId = user.memberProfile.id;
    } else {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    const result = await uploadMemberPhoto({
      memberId: targetMemberId,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      actorId: user.id,
    });

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
  }
}
