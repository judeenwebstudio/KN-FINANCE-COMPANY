import { getCurrentUser } from "@/lib/authz";
import { deleteMemberPhoto, getAuthorizedMemberPhoto } from "@/lib/members/document-service";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ memberId: string }> }) {
  const user = await getCurrentUser(); if (!user || user.status !== "ACTIVE") return new Response("Authentication required.", { status: 401 });
  try { const { memberId } = await context.params; const blob = await getAuthorizedMemberPhoto(memberId, user.id); if (!blob) return new Response("Not found.", { status: 404 }); return new Response(blob.stream, { headers: { "Content-Type": blob.blob.contentType || "application/octet-stream", "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" } }); }
  catch { return new Response("Not found.", { status: 404 }); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ memberId: string }> }) {
  const user = await getCurrentUser(); if (!user || user.status !== "ACTIVE") return Response.json({ error: "Authentication required." }, { status: 401 });
  try { const { memberId } = await context.params; await deleteMemberPhoto(memberId, user.id); return Response.json({ success: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 403 }); }
}
