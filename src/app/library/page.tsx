"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ExternalLink, ThumbsUp, ThumbsDown, FolderInput, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { LibraryEntry } from "@/lib/db";

interface ProjectOption {
  id: string;
  name: string;
  clientTag: string | null;
}

export default function LibraryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return entries;
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.title, e.projectName, e.projectClientTag].filter(Boolean).some((s) => s!.toLowerCase().includes(q))
    );
  }, [entries, query]);

  return (
    <div className="min-h-screen bg-fst-cream fst-noise">
      <header className="border-b-2 border-fst-black bg-fst-cream/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-fst-ink/50 hover:text-fst-black shrink-0" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <Logo size={32} />
          <div>
            <div className="font-display text-lg leading-none">Library</div>
            <div className="text-xs text-fst-ink/60 leading-none mt-1">every reference collected, across every board</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fst-ink/40" />
          <input
            type="text"
            placeholder="Search by title, client, or board…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="fst-input pl-9"
          />
        </div>

        {entries === null ? (
          <div className="text-fst-ink/50">Loading…</div>
        ) : filtered && filtered.length === 0 ? (
          <div className="text-sm text-fst-ink/50 border-2 border-dashed border-fst-black/20 rounded-2xl p-10 text-center">
            {entries.length === 0 ? "Nothing collected yet — references show up here once a board has some." : "No matches."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered?.map((entry) => (
              <LibraryCard key={entry.id} entry={entry} projects={projects} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function LibraryCard({ entry, projects }: { entry: LibraryEntry; projects: ProjectOption[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anywhere but the board this reference already lives on.
  const targets = projects.filter((p) => p.id !== entry.projectId);

  async function handleAdd(targetProjectId: string) {
    if (!targetProjectId) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/library/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceEntryId: entry.id, targetProjectId }),
    });
    setAdding(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Couldn't add that.");
      return;
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  }

  return (
    <div className="rounded-2xl border-2 border-fst-black bg-white overflow-hidden flex flex-col">
      <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="relative aspect-video bg-fst-ink/5 block">
        {entry.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.thumbnailUrl} alt={entry.title ?? entry.sourceUrl} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fst-ink/30 text-xs">no preview</div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
          <ExternalLink size={13} />
        </div>
        {entry.rating && (
          <div className="absolute bottom-2 left-2 bg-white rounded-full p-1.5 shadow">
            {entry.rating === "up" ? (
              <ThumbsUp size={13} className="text-fst-black" />
            ) : (
              <ThumbsDown size={13} className="text-fst-red" />
            )}
          </div>
        )}
      </a>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="text-sm font-medium leading-snug line-clamp-2">{entry.title ?? entry.sourceUrl}</p>

        <button
          onClick={() => router.push(`/project/${entry.projectId}`)}
          className="self-start text-[11px] uppercase tracking-wide text-fst-ink/40 hover:text-fst-black truncate max-w-full"
          title="Open this board"
        >
          from {entry.projectName}
          {entry.projectClientTag ? ` · ${entry.projectClientTag}` : ""}
        </button>

        <div className="mt-auto pt-1">
          {justAdded ? (
            <div className="flex items-center gap-1.5 text-xs text-fst-black font-medium">
              <Check size={13} strokeWidth={3} />
              Added
            </div>
          ) : targets.length === 0 ? (
            <p className="text-xs text-fst-ink/40">Create another board to copy this into</p>
          ) : (
            <div className="relative">
              <select
                value=""
                disabled={adding}
                onChange={(e) => handleAdd(e.target.value)}
                className="fst-input py-1.5 pl-7 text-xs appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="" disabled>
                  Add to board…
                </option>
                {targets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.clientTag ? ` (${p.clientTag})` : ""}
                  </option>
                ))}
              </select>
              <FolderInput size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fst-ink/40 pointer-events-none" />
            </div>
          )}
          {error && <p className="text-xs text-fst-red mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
