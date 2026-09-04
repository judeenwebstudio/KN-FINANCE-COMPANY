import { getCurrentUser } from "@/lib/authz";
import { uploadMemberPhoto } from "@/lib/members/document-service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const form = await request.formData(); const file = form.get("file"); const memberId = form.get("memberId");
    if (!(file instanceof File) || typeof memberId !== "string") return Response.json({ error: "Invalid photo request." }, { status: 400 });
    return Response.json(await uploadMemberPhoto({ memberId, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()), actorId: user.id }), { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 }); }
}
