import { getCurrentUser } from "@/lib/authz";
import { getAuthorizedDocumentFile, sanitizeFileName } from "@/lib/members/document-service";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return new Response("Authentication required.", { status: 401 });
  try {
    const { documentId } = await context.params;
    const { doc, stream } = await getAuthorizedDocumentFile(documentId, user.id);
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(stream, { headers: { "Content-Type": doc.mimeType, "Content-Disposition": `${disposition}; filename="${sanitizeFileName(doc.fileName).replace(/"/g, "")}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
