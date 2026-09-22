import { listEntries, setProjectMontage, getProject } from "./db";
import { downloadSnippet } from "./ytdlp";
import { concatClipsToGif } from "./ffmpegServer";
import { putFile, deleteFile } from "./blob";

/**
 * The actual download-and-cut work happens here, at montage time, only for
 * entries someone checked "include in montage" — not when a link is first
 * added. A failure on one selected clip (a since-removed video, a source
 * that turns out to be DRM-protected, etc.) doesn't abort the whole
 * montage; it's just left out, same as if it had never been selected —
 * but unlike the first version of this, the actual reason gets stored
 * instead of discarded, so a failure here doesn't need another round of
 * screenshot-driven debugging to understand.
 *
 * Downloads run one at a time rather than in parallel: each yt-dlp call
 * now also spins up a Deno/V8 instance to solve YouTube's JS challenge,
 * and several of those running concurrently is real, avoidable memory/CPU
 * pressure on a serverless function for a background job with no latency
 * requirement to justify the risk.
 */
export async function processMontage(projectId: string): Promise<void> {
  try {
    const entries = await listEntries(projectId);
    const selected = entries.filter((e) => e.status === "ready" && e.selectedForMontage && e.durationSeconds != null);
    if (selected.length < 2) {
      await setProjectMontage(projectId, {
        montageStatus: "error",
        montageErrorMessage: "Need at least two selected clips.",
      });
      return;
    }

    const clips: Buffer[] = [];
    const failures: string[] = [];
    for (const e of selected) {
      const start = e.snippetStartSeconds ?? 0;
      const length = Math.min(e.snippetLengthSeconds, Math.max(e.durationSeconds! - start, 0.5));
      try {
        clips.push(await downloadSnippet(e.sourceUrl, start, length));
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        failures.push(`"${e.title ?? e.sourceUrl}": ${reason}`);
      }
    }

    if (clips.length < 2) {
      await setProjectMontage(projectId, {
        montageStatus: "error",
        montageErrorMessage:
          failures.length > 0
            ? `Fewer than two clips downloaded successfully. ${failures.join(" | ")}`
            : "Fewer than two clips downloaded successfully.",
      });
      return;
    }

    const gif = await concatClipsToGif(clips);

    const project = await getProject(projectId);
    const oldUrl = project?.montageGifUrl ?? null;
    const url = await putFile(`montages/${projectId}-${Date.now()}.gif`, gif, "image/gif");

    await setProjectMontage(projectId, {
      montageStatus: "ready",
      montageGifUrl: url,
      montageUpdatedAt: Date.now(),
      // Clear any stale error from a previous failed attempt now that this
      // one succeeded — still worth knowing if some selected clips were
      // silently skipped along the way, so keep that part.
      montageErrorMessage: failures.length > 0 ? `Skipped: ${failures.join(" | ")}` : null,
    });

    if (oldUrl && oldUrl !== url) await deleteFile(oldUrl).catch(() => {});
  } catch (err) {
    await setProjectMontage(projectId, {
      montageStatus: "error",
      montageErrorMessage: err instanceof Error ? err.message : "Unknown error.",
    }).catch(() => {});
  }
}
