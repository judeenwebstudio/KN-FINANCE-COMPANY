import { getCurrentUser } from "@/lib/authz";
import { deleteMemberDocument } from "@/lib/members/document-service";

export async function DELETE(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return Response.json({ error: "Authentication required." }, { status: 401 });
  try { const { documentId } = await context.params; await deleteMemberDocument(documentId, user.id); return Response.json({ success: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 403 }); }
}
