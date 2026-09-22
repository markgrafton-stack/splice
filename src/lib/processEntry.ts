import { getEntry, updateEntry, touchProject } from "./db";
import { fetchVideoMeta } from "./ytdlp";
import { autoSnippetStart } from "./snippet";

/**
 * Resolves a freshly-added entry's metadata (title/thumbnail/duration) so
 * its embedded player and offset nudge can show up. Nothing is downloaded
 * or cut here — that only happens for entries someone actually selects,
 * when the montage is generated. Called fire-and-forget from the POST
 * /entries route via next/server's after(), so the request that added the
 * link returns immediately and the UI polls the entry's status while this
 * (much lighter, metadata-only) lookup runs.
 */
export async function resolveEntry(entryId: string): Promise<void> {
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
      status: "ready",
      errorMessage: null,
    });
    await touchProject(entry.projectId);
  } catch (err) {
    await updateEntry(entryId, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Something went wrong resolving this link.",
    }).catch(() => {});
  }
}
