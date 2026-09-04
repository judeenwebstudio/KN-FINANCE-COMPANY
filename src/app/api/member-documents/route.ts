import { DocumentCategory } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/authz";
import { uploadMemberDocument } from "@/lib/members/document-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const memberId = form.get("memberId");
    const category = form.get("category");
    if (!(file instanceof File) || typeof memberId !== "string" || !Object.values(DocumentCategory).includes(category as DocumentCategory)) return Response.json({ error: "Invalid upload request." }, { status: 400 });
    const doc = await uploadMemberDocument({ memberId, category: category as DocumentCategory, fileName: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()), uploadedById: user.id });
    return Response.json({ data: doc }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 }); }
}
