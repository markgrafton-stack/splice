import { getEntry, updateEntry, touchProject } from "./db";
import { fetchVideoMeta, downloadSnippet } from "./ytdlp";
import { clipToGif } from "./ffmpegServer";
import { putFile, deleteFile } from "./blob";
import { autoSnippetStart } from "./snippet";

/**
 * Runs the full queued -> downloading -> ready pipeline for a freshly-added
 * entry. Called fire-and-forget from the POST /entries route via next/server's
 * after(), so the request that added the link returns immediately and the
 * UI polls the entry's status while this runs.
 */
export async function processNewEntry(entryId: string): Promise<void> {
  try {
    const entry = await getEntry(entryId);
    if (!entry) return;

    const meta = await fetchVideoMeta(entry.sourceUrl);
    const start = autoSnippetStart(meta.durationSeconds, entry.snippetLengthSeconds);
    await updateEntry(entryId, {
      title: meta.title,
      thumbnailUrl: meta.thumbnailUrl,
      durationSeconds: meta.durationSeconds,
      snippetStartSeconds: start,
      status: "downloading",
    });

    await renderEntrySnippet(entryId, start, meta.durationSeconds);
    await touchProject(entry.projectId);
  } catch (err) {
    await updateEntry(entryId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Something went wrong resolving this link.",
    }).catch(() => {});
  }
}

/** Re-runs just the download+gif step with a manually nudged start offset. */
export async function regenerateEntrySnippet(entryId: string, startOverrideSeconds: number): Promise<void> {
  try {
    const entry = await getEntry(entryId);
    if (!entry || entry.durationSeconds == null) return;
    const start = Math.max(0, Math.min(startOverrideSeconds, entry.durationSeconds));
    await updateEntry(entryId, { status: "downloading", snippetStartSeconds: start });
    await renderEntrySnippet(entryId, start, entry.durationSeconds);
    await touchProject(entry.projectId);
  } catch (err) {
    await updateEntry(entryId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Couldn't regenerate this clip.",
    }).catch(() => {});
  }
}

async function renderEntrySnippet(entryId: string, start: number, duration: number): Promise<void> {
  const entry = await getEntry(entryId);
  if (!entry) return;

  const length = Math.min(entry.snippetLengthSeconds, Math.max(duration - start, 0.5));
  const mp4 = await downloadSnippet(entry.sourceUrl, start, length);
  const gif = await clipToGif(mp4);

  const [oldClipUrl, oldGifUrl] = [entry.clipUrl, entry.gifUrl];
  const clipUrl = await putFile(`clips/${entryId}.mp4`, mp4, "video/mp4");
  const gifUrl = await putFile(`gifs/${entryId}.gif`, gif, "image/gif");

  await updateEntry(entryId, { clipUrl, gifUrl, status: "ready", errorMessage: null });

  if (oldClipUrl && oldClipUrl !== clipUrl) await deleteFile(oldClipUrl).catch(() => {});
  if (oldGifUrl && oldGifUrl !== gifUrl) await deleteFile(oldGifUrl).catch(() => {});
}
