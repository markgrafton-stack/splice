import { listEntries, setProjectMontage, getProject } from "./db";
import { downloadSnippet } from "./ytdlp";
import { concatClipsToGif } from "./ffmpegServer";
import { putFile, deleteFile } from "./blob";

/**
 * The actual download-and-cut work happens here, at montage time, only for
 * entries someone checked "include in montage" — not when a link is first
 * added. A failure on one selected clip (a since-removed video, a source
 * that turns out to be DRM-protected, etc.) doesn't abort the whole
 * montage; it's just left out, same as if it had never been selected.
 */
export async function processMontage(projectId: string): Promise<void> {
  try {
    const entries = await listEntries(projectId);
    const selected = entries.filter((e) => e.status === "ready" && e.selectedForMontage && e.durationSeconds != null);
    if (selected.length < 2) {
      await setProjectMontage(projectId, { montageStatus: "error" });
      return;
    }

    const results = await Promise.allSettled(
      selected.map((e) => {
        const start = e.snippetStartSeconds ?? 0;
        const length = Math.min(e.snippetLengthSeconds, Math.max(e.durationSeconds! - start, 0.5));
        return downloadSnippet(e.sourceUrl, start, length);
      })
    );
    const clips = results.filter((r): r is PromiseFulfilledResult<Buffer> => r.status === "fulfilled").map((r) => r.value);

    if (clips.length < 2) {
      await setProjectMontage(projectId, { montageStatus: "error" });
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
    });

    if (oldUrl && oldUrl !== url) await deleteFile(oldUrl).catch(() => {});
  } catch {
    await setProjectMontage(projectId, { montageStatus: "error" }).catch(() => {});
  }
}
