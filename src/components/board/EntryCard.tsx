"use client";

import { useEffect, useState } from "react";
import { Loader2, X, ExternalLink, AlertTriangle, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import clsx from "clsx";
import type { Entry, Rating } from "@/lib/db";
import { useRotatingStatus } from "@/lib/funnyStatus";
import { toEmbedUrl } from "@/lib/embedUrl";
import { EntryFlash } from "./EntryFlash";

export function EntryCard({
  entry,
  onDelete,
  onSetOffset,
  onRate,
  onToggleSelected,
  justReady,
}: {
  entry: Entry;
  onDelete: (id: string) => void;
  onSetOffset: (id: string, startSeconds: number) => void;
  onRate: (id: string, rating: Rating) => void;
  onToggleSelected: (id: string, selected: boolean) => void;
  justReady?: boolean;
}) {
  const [offset, setOffset] = useState<number>(Math.round(entry.snippetStartSeconds ?? 0));
  const pending = entry.status === "queued";
  const statusLine = useRotatingStatus(pending);
  const embedUrl = entry.status === "ready" ? toEmbedUrl(entry.sourceUrl, entry.platform) : null;

  // Resyncs only when a fresh value actually lands from the server (the
  // auto-pick on first resolve) — never while someone's mid-edit, since the
  // stored value doesn't change again until they explicitly save it here.
  useEffect(() => {
    if (entry.snippetStartSeconds != null) setOffset(Math.round(entry.snippetStartSeconds));
  }, [entry.snippetStartSeconds]);

  return (
    <div
      className={clsx(
        "rounded-2xl border-2 bg-white overflow-hidden flex flex-col transition-colors",
        entry.selectedForMontage ? "border-fst-red" : "border-fst-black"
      )}
    >
      <div className="relative aspect-video bg-fst-ink/5">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={entry.title ?? entry.sourceUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : entry.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.thumbnailUrl} alt={entry.title ?? entry.sourceUrl} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fst-ink/30 text-xs">no preview yet</div>
        )}

        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="flex items-center gap-2 text-white text-xs font-medium bg-black/50 rounded-full px-3 py-1.5">
              <Loader2 size={14} className="animate-spin" />
              {statusLine}
            </div>
          </div>
        )}

        {entry.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-fst-red/10 pointer-events-none">
            <div className="flex items-center gap-2 text-fst-red text-xs font-medium bg-white rounded-full px-3 py-1.5 border border-fst-red/30">
              <AlertTriangle size={14} />
              Failed
            </div>
          </div>
        )}

        {justReady && <EntryFlash />}

        <button
          onClick={() => onDelete(entry.id)}
          aria-label="Remove from board"
          title="Remove from board"
          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-fst-red transition-colors z-10"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug line-clamp-2">{entry.title ?? entry.sourceUrl}</p>
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-fst-ink/40 hover:text-fst-black shrink-0"
            title="Open source"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        <span className="text-[11px] uppercase tracking-wide text-fst-ink/40">{entry.platform}</span>

        {entry.status === "error" && entry.errorMessage && (
          <p className="text-xs text-fst-red">{entry.errorMessage}</p>
        )}

        {entry.status === "ready" && entry.durationSeconds != null && (
          <>
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRate(entry.id, entry.rating === "up" ? null : "up")}
                  aria-label="Thumbs up"
                  className={clsx(
                    "p-1.5 rounded-full border-2 transition-colors",
                    entry.rating === "up" ? "border-fst-black bg-fst-black text-fst-cream" : "border-fst-black/15 text-fst-ink/50 hover:border-fst-black/40"
                  )}
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  onClick={() => onRate(entry.id, entry.rating === "down" ? null : "down")}
                  aria-label="Thumbs down"
                  className={clsx(
                    "p-1.5 rounded-full border-2 transition-colors",
                    entry.rating === "down" ? "border-fst-red bg-fst-red text-fst-cream" : "border-fst-black/15 text-fst-ink/50 hover:border-fst-black/40"
                  )}
                >
                  <ThumbsDown size={13} />
                </button>
              </div>

              <button
                onClick={() => onToggleSelected(entry.id, !entry.selectedForMontage)}
                className={clsx(
                  "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border-2 transition-colors",
                  entry.selectedForMontage
                    ? "border-fst-red bg-fst-red text-fst-cream"
                    : "border-fst-black/20 text-fst-ink/60 hover:border-fst-black/50"
                )}
              >
                {entry.selectedForMontage && <Check size={13} strokeWidth={3} />}
                {entry.selectedForMontage ? "In montage" : "Add to montage"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={Math.max(0, Math.floor(entry.durationSeconds))}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
                className="fst-input py-1 text-xs w-16"
                title="Start point in seconds, used when the montage is generated"
              />
              <button
                onClick={() => onSetOffset(entry.id, offset)}
                disabled={offset === Math.round(entry.snippetStartSeconds ?? 0)}
                className="text-xs text-fst-ink/60 hover:text-fst-black disabled:opacity-30 disabled:pointer-events-none"
              >
                Set start point
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
