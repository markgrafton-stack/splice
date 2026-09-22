"use client";

import { Loader2, Download, Film, AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";
import type { Project } from "@/lib/db";
import { useRotatingStatus } from "@/lib/funnyStatus";

export function MontagePanel({
  project,
  selectedCount,
  onGenerate,
  generating,
}: {
  project: Project;
  selectedCount: number;
  onGenerate: () => void;
  generating: boolean;
}) {
  const processing = project.montageStatus === "processing" || generating;
  const canGenerate = selectedCount >= 2 && !processing;
  const statusLine = useRotatingStatus(processing);

  return (
    <div className="rounded-2xl border-2 border-fst-black bg-white p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <Film size={18} />
            Montage
          </h2>
          <p className="text-sm text-fst-ink/60 mt-1">
            {processing
              ? statusLine
              : selectedCount < 2
                ? "Watch the collected references, then mark at least two “Add to montage” to build one."
                : `Cuts and stitches the ${selectedCount} selected clip${selectedCount === 1 ? "" : "s"}, in the order they were added, into one GIF.`}
          </p>
        </div>
        <Button onClick={onGenerate} disabled={!canGenerate}>
          {processing ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
          {project.montageStatus === "ready" ? "Regenerate montage" : "Generate montage"}
        </Button>
      </div>

      {project.montageStatus === "error" && (
        <div className="mt-4 flex items-start gap-2 text-sm text-fst-red">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{project.montageErrorMessage || "Montage failed — check that the selected clips are still reachable and try again."}</span>
        </div>
      )}

      {project.montageStatus === "ready" && project.montageGifUrl && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.montageGifUrl}
            alt={`${project.name} reference montage`}
            className="rounded-xl border-2 border-fst-black max-w-full"
          />
          <a href={project.montageGifUrl} download target="_blank" rel="noreferrer" className="inline-block">
            <Button variant="dark">
              <Download size={16} />
              Download GIF
            </Button>
          </a>
          {project.montageErrorMessage && (
            <p className="text-xs text-fst-ink/50 text-center max-w-md">{project.montageErrorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
