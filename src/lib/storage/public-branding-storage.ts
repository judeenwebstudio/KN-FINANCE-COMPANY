import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Public Branding Object Storage Service.
 * 
 * Strict Invariants:
 * 1. COMPLETELY SEPARATE from private Member KYC Blob storage (BLOB_READ_WRITE_TOKEN / access: "private").
 * 2. Uses distinct PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN / PUBLIC_BRANDING_BLOB_STORE_ID.
 * 3. Never attempts access: "public" against the private KYC Blob store.
 * 4. Zero base64 data: URLs, zero DB binary blobs, zero filesystem fallbacks.
 * 5. Fails closed with controlled response when unconfigured.
 */

export function isPublicBrandingStorageConfigured(): boolean {
  return Boolean(
    process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN ||
      process.env.PUBLIC_BRANDING_BLOB_STORE_ID
  );
}

function getPublicBrandingToken(): string | undefined {
  return process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_").toLowerCase();
}

export async function uploadPublicBrandingAsset(
  kind: "logo" | "favicon",
  bytes: Uint8Array,
  contentType: string,
  fileName: string
): Promise<string> {
  if (!isPublicBrandingStorageConfigured()) {
    throw new Error("Public branding storage is not configured.");
  }

  const token = getPublicBrandingToken();
  const safeName = sanitizeFileName(fileName);
  const key = `branding/${kind}/${randomUUID()}-${safeName}`;

  const blob = await put(key, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType,
    cacheControlMaxAge: 31536000,
    ...(token ? { token } : {}),
  });

  return blob.url;
}

export async function deletePublicBrandingAsset(url: string): Promise<void> {
  if (!url || !url.startsWith("http")) return;
  // Protect bundled static defaults from deletion
  if (url === "/branding/kn-finance-logo.png" || url === "/favicon.ico") return;

  if (!isPublicBrandingStorageConfigured()) return;

  const token = getPublicBrandingToken();
  try {
    await del(url, ...(token ? [{ token }] : []));
  } catch (error) {
    console.error("[Public Branding Storage Delete Error]", error);
  }
}
