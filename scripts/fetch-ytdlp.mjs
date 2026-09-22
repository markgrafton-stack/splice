// Downloads the platform-appropriate *standalone* yt-dlp binary (no Python
// runtime dependency) into ./bin/yt-dlp. Runs on every `npm install`, both
// locally (whatever OS the dev is on) and on the deploy build machine (Linux
// x64 for Vercel) — so the right binary is always fetched for wherever this
// actually runs, instead of committing a single-platform binary to git.
//
// Deliberately not using a wrapper package here: yt-dlp's GitHub releases
// ship several assets per platform, and the ones most such wrappers default
// to (the plain `yt-dlp` file) are a Python zipapp that needs `python3` on
// PATH at *runtime* — not guaranteed on a serverless host. Asking explicitly
// for `yt-dlp_macos` / `yt-dlp_linux` gets the real compiled binary instead.
import { mkdir, chmod, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.join(__dirname, "..", "bin");

function assetNameFor(platform, arch) {
  if (platform === "darwin") return "yt-dlp_macos";
  if (platform === "linux") return arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  if (platform === "win32") return "yt-dlp.exe";
  throw new Error(`Unsupported platform for yt-dlp: ${platform}/${arch}`);
}

async function main() {
  if (process.env.SPLICE_SKIP_YTDLP_DOWNLOAD) {
    console.log("[fetch-ytdlp] SPLICE_SKIP_YTDLP_DOWNLOAD set, skipping.");
    return;
  }

  const asset = assetNameFor(process.platform, process.arch);
  const destName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const dest = path.join(binDir, destName);

  try {
    await access(dest);
    console.log(`[fetch-ytdlp] ${dest} already present, skipping download.`);
    return;
  } catch {
    // doesn't exist yet, fall through and download
  }

  await mkdir(binDir, { recursive: true });

  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  console.log(`[fetch-ytdlp] downloading ${asset} from ${url}`);

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`[fetch-ytdlp] failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  await pipeline(res.body, createWriteStream(dest));
  if (process.platform !== "win32") {
    await chmod(dest, 0o755);
  }
  console.log(`[fetch-ytdlp] wrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  // Don't fail `npm install` over this — the app degrades gracefully at
  // runtime (adding a link just errors per-entry) and CI/sandboxed installs
  // without internet access to github.com shouldn't be blocked entirely.
  console.error("[fetch-ytdlp] continuing without a yt-dlp binary — links won't resolve until this is fixed.");
});
