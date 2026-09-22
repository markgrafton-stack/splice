import type { Platform } from "./db";

/** Builds the official embeddable player URL for a source link — used to
 * show the actual full video in the browser with zero downloading, so
 * collecting/browsing references never touches yt-dlp at all. */
export function toEmbedUrl(sourceUrl: string, platform: Platform): string | null {
  if (platform === "youtube") {
    try {
      const url = new URL(sourceUrl);
      const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    } catch {
      return null;
    }
  }
  if (platform === "vimeo") {
    const match = sourceUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  return null;
}
