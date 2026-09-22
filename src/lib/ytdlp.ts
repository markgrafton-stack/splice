import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import type { Platform } from "./db";

const execFileAsync = promisify(execFile);

const YTDLP_PATH = path.join(process.cwd(), "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

/**
 * YouTube increasingly challenges requests from datacenter IPs (the "Sign in
 * to confirm you're not a bot" error) — passing cookies from a real,
 * logged-in browser session makes yt-dlp's requests look like a normal
 * signed-in user instead. YT_COOKIES holds the *contents* of a Netscape-
 * format cookies.txt file (exported via a browser extension), written once
 * per warm server instance rather than re-written on every call. Unset in
 * local dev — not needed there, and not required for this to work at all;
 * it's a workaround for a block some deployments hit, not a hard dependency.
 */
let cookiesFilePromise: Promise<string | null> | null = null;

async function getCookiesFile(): Promise<string | null> {
  if (!process.env.YT_COOKIES) return null;
  if (!cookiesFilePromise) {
    cookiesFilePromise = (async () => {
      const file = path.join(tmpdir(), "splice-yt-cookies.txt");
      await writeFile(file, process.env.YT_COOKIES as string, "utf8");
      return file;
    })();
  }
  return cookiesFilePromise;
}

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

// TEMPORARY: unconditionally surfaces the full, unfiltered yt-dlp stderr
// instead of a cleaned-up friendly message — the env-var-gated version of
// this turned out to be one more fiddly dashboard step to get wrong, so
// this removes that as a variable entirely while diagnosing the live
// block. The previous version (SAMPLE-AES / bot-check / reload / generic
// ERROR-line messages) is recoverable from git history — restore it once
// the live failure is actually understood. This leaks local file paths
// into the error, only acceptable as a short-lived debugging aid.
function cleanYtDlpError(err: unknown): Error {
  const stderr = (err as { stderr?: string })?.stderr ?? "";
  const message = err instanceof Error ? err.message : String(err);
  return new Error(`RAW: ${stderr.trim() || "(empty stderr)"} | err: ${message}`);
}

// YouTube actively blocks known datacenter IP ranges (Vercel's included) —
// this is an ongoing, evolving fight between YouTube and tools like yt-dlp,
// not a one-time bug with a permanent fix. Two mitigations: a realistic
// browser User-Agent (YouTube can quietly return blocked/empty results to
// yt-dlp's own default UA specifically from cloud IPs) and a configurable
// player-client fallback list (YT_PLAYER_CLIENT) so it can be retuned
// without a code change when YouTube's blocking shifts again — check
// https://github.com/yt-dlp/yt-dlp/issues for the current best value if
// clips start failing again after cookies are confirmed working.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PLAYER_CLIENTS = process.env.YT_PLAYER_CLIENT || "default,web_embedded,android,ios";

async function runYtDlp(args: string[], timeoutMs: number): Promise<string> {
  const cookiesFile = await getCookiesFile();
  try {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      [
        "--no-warnings",
        "--ignore-config",
        "--no-playlist",
        "--ffmpeg-location",
        ffmpegInstaller.path,
        "--user-agent",
        BROWSER_USER_AGENT,
        "--extractor-args",
        `youtube:player_client=${PLAYER_CLIENTS}`,
        ...(cookiesFile ? ["--cookies", cookiesFile] : []),
        ...args,
      ],
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
