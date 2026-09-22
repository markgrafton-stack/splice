"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { PasteLinkBar } from "@/components/board/PasteLinkBar";
import { EntryCard } from "@/components/board/EntryCard";
import { MontagePanel } from "@/components/board/MontagePanel";
import type { Project, Entry } from "@/lib/db";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [generatingMontage, setGeneratingMontage] = useState(false);
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
      setEntries(data.entries);
    } finally {
      inFlight.current = false;
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while anything is still in flight — an entry resolving/downloading,
  // or the montage rendering.
  useEffect(() => {
    const anyEntryPending = entries.some((e) => e.status === "queued" || e.status === "downloading");
    const montagePending = project?.montageStatus === "processing";
    if (!anyEntryPending && !montagePending) return;

    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [entries, project?.montageStatus, refresh]);

  async function handleAdd(url: string, snippetLengthSeconds: number): Promise<string | null> {
    const res = await fetch(`/api/projects/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, snippetLengthSeconds }),
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

  async function handleRegenerate(entryId: string, startSeconds: number) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: "downloading" } : e)));
    await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startSeconds }),
    });
    refresh();
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

  const readyCount = entries.filter((e) => e.status === "ready").length;

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
            readyCount={readyCount}
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
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onDelete={handleDeleteEntry} onRegenerate={handleRegenerate} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
