"use client";

import { Loader2, Download, Film, AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";
import type { Project } from "@/lib/db";

export function MontagePanel({
  project,
  readyCount,
  onGenerate,
  generating,
}: {
  project: Project;
  readyCount: number;
  onGenerate: () => void;
  generating: boolean;
}) {
  const canGenerate = readyCount >= 2 && !generating && project.montageStatus !== "processing";

  return (
    <div className="rounded-2xl border-2 border-fst-black bg-white p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <Film size={18} />
            Montage
          </h2>
          <p className="text-sm text-fst-ink/60 mt-1">
            {readyCount < 2
              ? "Add at least two ready clips to build a montage."
              : `Stitches the ${readyCount} ready clip${readyCount === 1 ? "" : "s"}, in the order they were added, into one GIF.`}
          </p>
        </div>
        <Button onClick={onGenerate} disabled={!canGenerate}>
          {project.montageStatus === "processing" || generating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Film size={16} />
          )}
          {project.montageStatus === "ready" ? "Regenerate montage" : "Generate montage"}
        </Button>
      </div>

      {project.montageStatus === "error" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-fst-red">
          <AlertTriangle size={16} />
          Montage failed — try again once more clips are ready.
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
        </div>
      )}
    </div>
  );
}
