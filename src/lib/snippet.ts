export const SNIPPET_LENGTH_OPTIONS = [2, 3, 4] as const;
export const DEFAULT_SNIPPET_LENGTH = 3;

/**
 * Auto-picks where to start a clip's snippet: skip the first slice of the
 * video (title cards, logo bumpers, cold opens are usually there) and grab
 * from a bit past that, clamped so the snippet always fits inside duration.
 */
export function autoSnippetStart(durationSeconds: number, snippetLengthSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const afterIntro = durationSeconds * 0.15;
  const latestPossibleStart = Math.max(durationSeconds - snippetLengthSeconds, 0);
  return Math.min(afterIntro, latestPossibleStart);
}
