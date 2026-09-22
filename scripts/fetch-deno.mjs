// Downloads the platform-appropriate Deno binary into ./bin/deno. yt-dlp now
// needs an external JS runtime to solve YouTube's signature/n-challenge —
// without one, extraction silently degrades (missing formats, or outright
// "The page needs to be reloaded" failures) even with valid cookies. Same
// "fetch per-platform at install time" approach as fetch-ytdlp.mjs, for the
// same reason: this runs both on whatever OS a dev is on and on Vercel's
// Linux x64 build machine, so a single committed binary can't work for both.
import { mkdir, chmod, access, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.join(__dirname, "..", "bin");

function assetNameFor(platform, arch) {
  const archPart = arch === "arm64" ? "aarch64" : "x86_64";
  if (platform === "darwin") return `deno-${archPart}-apple-darwin.zip`;
  if (platform === "linux") return `deno-${archPart}-unknown-linux-gnu.zip`;
  if (platform === "win32") return `deno-${archPart}-pc-windows-msvc.zip`;
  throw new Error(`Unsupported platform for deno: ${platform}/${arch}`);
}

async function main() {
  if (process.env.SPLICE_SKIP_DENO_DOWNLOAD) {
    console.log("[fetch-deno] SPLICE_SKIP_DENO_DOWNLOAD set, skipping.");
    return;
  }

  const destName = process.platform === "win32" ? "deno.exe" : "deno";
  const dest = path.join(binDir, destName);

  try {
    await access(dest);
    console.log(`[fetch-deno] ${dest} already present, skipping download.`);
    return;
  } catch {
    // doesn't exist yet, fall through and download
  }

  await mkdir(binDir, { recursive: true });

  const asset = assetNameFor(process.platform, process.arch);
  const url = `https://github.com/denoland/deno/releases/latest/download/${asset}`;
  console.log(`[fetch-deno] downloading ${asset} from ${url}`);

  const zipPath = path.join(binDir, "deno-download.zip");
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`[fetch-deno] failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(zipPath));

  console.log(`[fetch-deno] extracting ${destName}`);
  await execFileAsync("unzip", ["-o", zipPath, "-d", binDir]);
  await rm(zipPath, { force: true });

  if (process.platform !== "win32") {
    await chmod(dest, 0o755);
  }
  console.log(`[fetch-deno] wrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  // Don't fail `npm install` over this — yt-dlp still runs without a JS
  // runtime, just with degraded extraction reliability, so a sandboxed
  // install without internet access to github.com shouldn't be blocked.
  console.error("[fetch-deno] continuing without deno — YouTube extraction reliability will be degraded.");
});
