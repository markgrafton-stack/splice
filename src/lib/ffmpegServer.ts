import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

const GIF_FPS = 10;
const MONTAGE_WIDTH = 480;
const MONTAGE_HEIGHT = 270;
// A capped palette + ordered (bayer) dithering instead of the default
// sierra2_4a knocks a noticeable chunk off file size on noisy/high-motion
// footage with barely any visible quality loss — worth it since these are
// meant to be quick to send, not archival masters.
const PALETTE_GEN = "palettegen=max_colors=160";
const PALETTE_USE = "paletteuse=dither=bayer:bayer_scale=5";

async function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  await execFileAsync(ffmpegInstaller.path, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Concatenates several clips (center-cropped/scaled to one common canvas so
 * mixed aspect ratios and resolutions line up) into a single palette-
 * optimized GIF, in the given order.
 */
export async function concatClipsToGif(clips: Buffer[]): Promise<Buffer> {
  if (clips.length < 2) {
    throw new Error("Need at least two ready clips to build a montage.");
  }
  const dir = await mkdtemp(path.join(tmpdir(), "splice-montage-"));
  try {
    const inputPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const p = path.join(dir, `in${i}.mp4`);
      await writeFile(p, clips[i]);
      inputPaths.push(p);
    }

    const perClipFilters = inputPaths
      .map(
        (_, i) =>
          `[${i}:v]scale=${MONTAGE_WIDTH}:${MONTAGE_HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${MONTAGE_WIDTH}:${MONTAGE_HEIGHT},fps=${GIF_FPS},setsar=1[v${i}]`
      )
      .join(";");
    const concatInputs = inputPaths.map((_, i) => `[v${i}]`).join("");
    const filter =
      `${perClipFilters};${concatInputs}concat=n=${inputPaths.length}:v=1:a=0[vcat];` +
      `[vcat]split[a][b];[a]${PALETTE_GEN}[p];[b][p]${PALETTE_USE}`;

    const args = inputPaths.flatMap((p) => ["-i", p]);
    const outPath = path.join(dir, "montage.gif");
    await runFfmpeg([...args, "-filter_complex", filter, outPath], 180_000);

    const bytes = await readFile(outPath);
    if (bytes.byteLength < 500) {
      throw new Error("Montage encode produced no usable output.");
    }
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
