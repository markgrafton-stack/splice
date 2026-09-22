// Two backends, same idea as db.ts:
//  - a Blob read-write token is set -> real Vercel Blob (shared, public URLs)
//  - unset                          -> write into public/uploads and return
//    a local /uploads/... URL, so generated clips/gifs are servable with
//    zero cloud setup during local dev.
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";

// The store got connected with a custom "SPLICE" prefix (to dodge a name
// collision with a stale placeholder var from the initial Vercel import),
// so the token isn't under the SDK's default BLOB_READ_WRITE_TOKEN name —
// check both, and pass the token through explicitly since the SDK only
// auto-discovers the unprefixed default.
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.SPLICE_BLOB_READ_WRITE_TOKEN;
const usingVercelBlob = Boolean(BLOB_TOKEN);
const uploadsDir = path.join(process.cwd(), "public", "uploads");

export async function putFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (usingVercelBlob) {
    const { put } = await import("@vercel/blob");
    const result = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: BLOB_TOKEN,
    });
    return result.url;
  }
  await mkdir(uploadsDir, { recursive: true });
  const dest = path.join(uploadsDir, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, data);
  return `/uploads/${key}`;
}

/** Reads back a file this module wrote — from disk for the local fallback
 * (no network round-trip needed), or over HTTP for a real Blob URL. */
export async function getFile(url: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    const dest = path.join(uploadsDir, url.slice("/uploads/".length));
    return readFile(dest);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFile(url: string): Promise<void> {
  if (usingVercelBlob) {
    if (!url.includes("blob.vercel-storage.com")) return;
    const { del } = await import("@vercel/blob");
    await del(url, { token: BLOB_TOKEN }).catch(() => {});
    return;
  }
  if (!url.startsWith("/uploads/")) return;
  const dest = path.join(uploadsDir, url.slice("/uploads/".length));
  await unlink(dest).catch(() => {});
}
