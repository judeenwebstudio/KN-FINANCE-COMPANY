import { del, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL && process.env.BLOB_STORE_ID));
}

export function createPrivateObjectKey(memberId: string, kind: "documents" | "photo"): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(memberId)) throw new Error("Invalid internal member identifier.");
  return `members/${memberId}/${kind}/${randomUUID()}`;
}

export async function uploadPrivateFile(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<string> {
  if (!isStorageConfigured()) throw new Error("Private storage is not configured.");
  const blob = await put(input.key, Buffer.from(input.bytes), { access: "private", addRandomSuffix: false, contentType: input.contentType, cacheControlMaxAge: 60 });
  return blob.pathname;
}

export async function getPrivateFile(key: string) {
  if (!isStorageConfigured()) throw new Error("Private storage is not configured.");
  return get(key, { access: "private", useCache: false });
}

export async function deletePrivateFile(key: string): Promise<void> {
  if (!isStorageConfigured()) throw new Error("Private storage is not configured.");
  await del(key);
}
