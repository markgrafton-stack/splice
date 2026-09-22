// Two backends, same idea as db.ts:
//  - BLOB_READ_WRITE_TOKEN set  -> real Vercel Blob (shared, public URLs)
//  - unset                      -> write into public/uploads and return a
//    local /uploads/... URL, so generated clips/gifs are servable with zero
//    cloud setup during local dev.
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";

const usingVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const uploadsDir = path.join(process.cwd(), "public", "uploads");

export async function putFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (usingVercelBlob) {
    const { put } = await import("@vercel/blob");
    const result = await put(key, data, { access: "public", contentType, addRandomSuffix: false });
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
    await del(url).catch(() => {});
    return;
  }
  if (!url.startsWith("/uploads/")) return;
  const dest = path.join(uploadsDir, url.slice("/uploads/".length));
  await unlink(dest).catch(() => {});
}
