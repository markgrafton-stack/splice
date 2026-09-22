"use client";

import { useEffect, useState } from "react";
import { Loader2, X, RotateCw, ExternalLink, AlertTriangle } from "lucide-react";
import type { Entry } from "@/lib/db";
import { useRotatingStatus } from "@/lib/funnyStatus";
import { EntryFlash } from "./EntryFlash";

export function EntryCard({
  entry,
  onDelete,
  onRegenerate,
  justReady,
}: {
  entry: Entry;
  onDelete: (id: string) => void;
  onRegenerate: (id: string, startSeconds: number) => void;
  justReady?: boolean;
}) {
  const [offset, setOffset] = useState<number>(Math.round(entry.snippetStartSeconds ?? 0));
  const pending = entry.status === "queued" || entry.status === "downloading";
  const statusLine = useRotatingStatus(pending);

  // The field is only shown once resolved (ready/error) and hides again the
  // moment a regenerate kicks off, so it's safe to resync here without ever
  // clobbering an in-progress edit — this only fires when a new value has
  // actually landed from the server, not while the user is mid-typing.
  useEffect(() => {
    if (entry.snippetStartSeconds != null) setOffset(Math.round(entry.snippetStartSeconds));
  }, [entry.snippetStartSeconds]);

  return (
    <div className="rounded-2xl border-2 border-fst-black bg-white overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-fst-ink/5">
        {entry.status === "ready" && entry.gifUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.gifUrl} alt={entry.title ?? entry.sourceUrl} className="w-full h-full object-cover" />
        ) : entry.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.thumbnailUrl} alt={entry.title ?? entry.sourceUrl} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fst-ink/30 text-xs">no preview yet</div>
        )}

        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-2 text-white text-xs font-medium bg-black/50 rounded-full px-3 py-1.5">
              <Loader2 size={14} className="animate-spin" />
              {statusLine}
            </div>
          </div>
        )}

        {justReady && <EntryFlash />}

        {entry.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-fst-red/10">
            <div className="flex items-center gap-2 text-fst-red text-xs font-medium bg-white rounded-full px-3 py-1.5 border border-fst-red/30">
              <AlertTriangle size={14} />
              Failed
            </div>
          </div>
        )}

        <button
          onClick={() => onDelete(entry.id)}
          aria-label="Remove from board"
          title="Remove from board"
          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-fst-red transition-colors"
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

        {(entry.status === "ready" || entry.status === "error") && entry.durationSeconds != null && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={0}
              max={Math.max(0, Math.floor(entry.durationSeconds))}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              className="fst-input py-1 text-xs w-16"
              title="Start offset in seconds"
            />
            <button
              onClick={() => onRegenerate(entry.id, offset)}
              className="flex items-center gap-1 text-xs text-fst-ink/60 hover:text-fst-black"
            >
              <RotateCw size={12} />
              Regenerate from here
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
