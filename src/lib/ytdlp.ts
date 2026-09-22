import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { Platform } from "./db";

const execFileAsync = promisify(execFile);

const YTDLP_PATH = path.join(process.cwd(), "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

/** Only youtube.com/youtu.be/vimeo.com links are accepted anywhere in the
 * app — this is the one gate everything else relies on. Reject early rather
 * than letting an arbitrary string reach the yt-dlp CLI: a validated
 * https://(www.)youtube.com/... or https://vimeo.com/... string can never be
 * mistaken for a CLI flag (e.g. something starting with "--"), which matters
 * because yt-dlp has flags like --exec that run arbitrary commands. */
export function detectPlatform(rawUrl: string): Platform | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    return "youtube";
  }
  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    return "vimeo";
  }
  return null;
}

/** yt-dlp's Vimeo "web" extractor currently refuses anonymous access to the
 * regular vimeo.com/<id> page ("only works when logged-in"), but the same
 * public video is still reachable through its embed URL — same video, a
 * path that isn't gated. Rewrite just for the yt-dlp call; the original URL
 * a person pasted is still what's stored and shown as the source link. */
function forYtDlp(url: string): string {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return url;
}

export interface VideoMeta {
  title: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
}

function cleanYtDlpError(err: unknown): Error {
  const stderr = (err as { stderr?: string })?.stderr ?? "";
  // Some sources serve their video behind encrypted/DRM-protected HLS
  // segments (seen on some Vimeo hosts) that ffmpeg can't decrypt — that
  // shows up as a generic "ffmpeg exited with code 1" alongside a
  // SAMPLE-AES/"Not yet implemented" line buried in the log, not as a
  // yt-dlp ERROR: line, so it needs its own check before the generic one.
  if (stderr.includes("SAMPLE-AES") || stderr.includes("Not yet implemented in FFmpeg")) {
    return new Error("This source serves a copy-protected stream that can't be downloaded.");
  }
  // yt-dlp's own "ERROR: ..." line is the useful part otherwise; the rest is
  // a raw command/path dump that's noise (and leaks local file paths).
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("ERROR:"));
  if (line) return new Error(line.replace(/^ERROR:\s*/, ""));
  if (err instanceof Error && (err as { killed?: boolean }).killed) {
    return new Error("Timed out talking to the source site — try again in a moment.");
  }
  return new Error("Couldn't reach that link's source site.");
}

async function runYtDlp(args: string[], timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      ["--no-warnings", "--ignore-config", "--no-playlist", "--ffmpeg-location", ffmpegInstaller.path, ...args],
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }
    );
    return stdout;
  } catch (err) {
    throw cleanYtDlpError(err);
  }
}

export async function fetchVideoMeta(url: string): Promise<VideoMeta> {
  const stdout = await runYtDlp(["--dump-json", "--skip-download", "--", forYtDlp(url)], 30_000);
  const data = JSON.parse(stdout);
  const duration = typeof data.duration === "number" ? data.duration : 0;
  if (!duration) {
    throw new Error("Couldn't read this video's duration — it may be a livestream or unavailable.");
  }
  return {
    title: typeof data.title === "string" ? data.title : url,
    durationSeconds: duration,
    thumbnailUrl: typeof data.thumbnail === "string" ? data.thumbnail : null,
  };
}

/**
 * Downloads only the [start, start+length) window of the source video (via
 * yt-dlp's --download-sections, not the whole file) and returns it as an mp4
 * Buffer. Caller owns cleanup of nothing — this manages its own temp dir.
 */
export async function downloadSnippet(url: string, startSeconds: number, lengthSeconds: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "splice-snippet-"));
  const outPath = path.join(dir, "snippet.mp4");
  const end = startSeconds + lengthSeconds;
  try {
    await runYtDlp(
      [
        "-f",
        "bv*+ba/b",
        "-S",
        "res:480,ext:mp4:m4a",
        "--download-sections",
        `*${startSeconds.toFixed(2)}-${end.toFixed(2)}`,
        "--force-keyframes-at-cuts",
        "--merge-output-format",
        "mp4",
        "-o",
        outPath,
        "--",
        forYtDlp(url),
      ],
      120_000
    );
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
