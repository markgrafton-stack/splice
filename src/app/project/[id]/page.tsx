"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { PasteLinkBar } from "@/components/board/PasteLinkBar";
import { EntryCard } from "@/components/board/EntryCard";
import { MontagePanel } from "@/components/board/MontagePanel";
import { MascotCameo } from "@/components/board/MascotCameo";
import type { Project, Entry, Rating } from "@/lib/db";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [generatingMontage, setGeneratingMontage] = useState(false);
  const [justReadyIds, setJustReadyIds] = useState<Set<string>>(new Set());
  const [showCameo, setShowCameo] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setProject(data.project);

      // Flash any entry that flipped to "ready" since the last poll — but
      // only a genuine transition, not an entry that was already ready the
      // first time this board loads.
      setEntries((prev) => {
        const prevStatus = new Map(prev.map((e) => [e.id, e.status]));
        const newlyReady: string[] = data.entries
          .filter((e: Entry) => e.status === "ready" && prevStatus.get(e.id) && prevStatus.get(e.id) !== "ready")
          .map((e: Entry) => e.id);
        if (newlyReady.length > 0) {
          setJustReadyIds((cur) => new Set([...cur, ...newlyReady]));
          setTimeout(() => {
            setJustReadyIds((cur) => {
              const next = new Set(cur);
              newlyReady.forEach((entryId: string) => next.delete(entryId));
              return next;
            });
          }, 900);
        }
        return data.entries;
      });

      // Celebrate the first time this browser ever sees a ready montage for
      // this board — a plain localStorage flag is enough since it's just a
      // one-off flourish, not something that needs to sync across people.
      if (data.project.montageStatus === "ready") {
        const key = `splice-celebrated:${id}`;
        if (typeof window !== "undefined" && !localStorage.getItem(key)) {
          localStorage.setItem(key, "1");
          setShowCameo(true);
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while anything is still in flight — an entry's metadata resolving,
  // or the montage rendering.
  useEffect(() => {
    const anyEntryPending = entries.some((e) => e.status === "queued");
    const montagePending = project?.montageStatus === "processing";
    if (!anyEntryPending && !montagePending) return;

    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [entries, project?.montageStatus, refresh]);

  async function handleAdd(url: string): Promise<string | null> {
    const res = await fetch(`/api/projects/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return data?.error ?? "Couldn't add that link.";
    }
    await refresh();
    return null;
  }

  async function handleDeleteEntry(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
    refresh();
  }

  async function handleSetOffset(entryId: string, startSeconds: number) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, snippetStartSeconds: startSeconds } : e)));
    await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startSeconds }),
    });
  }

  async function handleSetLength(entryId: string, lengthSeconds: number) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, snippetLengthSeconds: lengthSeconds } : e)));
    await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snippetLengthSeconds: lengthSeconds }),
    });
  }

  async function handleRate(entryId: string, rating: Rating) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, rating } : e)));
    await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
  }

  async function handleToggleSelected(entryId: string, selected: boolean) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, selectedForMontage: selected } : e)));
    await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedForMontage: selected }),
    });
  }

  async function handleGenerateMontage() {
    setGeneratingMontage(true);
    const res = await fetch(`/api/projects/${id}/montage`, { method: "POST" });
    setGeneratingMontage(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      window.alert(data?.error ?? "Couldn't start the montage.");
      return;
    }
    refresh();
  }

  async function handleDeleteProject() {
    if (!confirm("Delete this board and everything on it? This can't be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-fst-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-fst-ink/60 mb-4">That board doesn&apos;t exist (or was deleted).</p>
          <Button onClick={() => router.push("/")}>Back to boards</Button>
        </div>
      </div>
    );
  }

  const selectedCount = entries.filter((e) => e.status === "ready" && e.selectedForMontage).length;

  // Up-voted first, then unrated, then down-voted — makes the follow-up
  // "pick which ones to include" pass easier without needing manual
  // drag-to-reorder. Ties keep the order links were added.
  const rank = (r: Rating) => (r === "up" ? 0 : r === null ? 1 : 2);
  const sortedEntries = [...entries].sort((a, b) => rank(a.rating) - rank(b.rating));

  return (
    <div className="min-h-screen bg-fst-cream fst-noise">
      <header className="border-b-2 border-fst-black bg-fst-cream/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/")} className="text-fst-ink/50 hover:text-fst-black shrink-0" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <Logo size={32} />
            <div className="min-w-0">
              <div className="font-display text-lg leading-none truncate">{project?.name ?? "Loading…"}</div>
              <div className="text-xs text-fst-ink/60 leading-none mt-1">Splice by fst</div>
            </div>
          </div>
          <button
            onClick={handleDeleteProject}
            className="text-fst-ink/40 hover:text-fst-red shrink-0"
            aria-label="Delete board"
            title="Delete board"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <PasteLinkBar onAdd={handleAdd} />

        {project && (
          <MontagePanel
            project={project}
            selectedCount={selectedCount}
            onGenerate={handleGenerateMontage}
            generating={generatingMontage}
          />
        )}

        {entries.length === 0 ? (
          <div className="text-sm text-fst-ink/50 border-2 border-dashed border-fst-black/20 rounded-2xl p-10 text-center">
            No references yet — paste in a link above to start the board.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDelete={handleDeleteEntry}
                onSetOffset={handleSetOffset}
                onSetLength={handleSetLength}
                onRate={handleRate}
                onToggleSelected={handleToggleSelected}
                justReady={justReadyIds.has(entry.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showCameo && <MascotCameo onDismiss={() => setShowCameo(false)} />}
    </div>
  );
}
