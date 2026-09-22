"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Plus, Clock, Film, Image as ImageIcon, X } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  clientTag: string | null;
  updatedAt: number;
  montageStatus: "idle" | "processing" | "ready" | "error";
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeClient, setActiveClient] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects);
  }

  useEffect(() => {
    refresh();
  }, []);

  const clientTags = useMemo(() => {
    const seen = new Map<string, string>();
    (projects ?? []).forEach((p) => {
      const tag = p.clientTag?.trim();
      if (!tag) return;
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (!projects) return projects;
    if (!activeClient) return projects;
    return projects.filter((p) => p.clientTag?.toLowerCase() === activeClient.toLowerCase());
  }, [projects, activeClient]);

  async function handleCreate(name: string, clientTag: string) {
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), clientTag: clientTag.trim() || undefined }),
    });
    const data = await res.json();
    router.push(`/project/${data.project.id}`);
  }

  return (
    <div className="min-h-screen bg-fst-cream fst-noise">
      <header className="border-b-2 border-fst-black bg-fst-cream/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <div className="font-display text-lg leading-none">splice</div>
              <div className="text-xs text-fst-ink/60 leading-none mt-1">by fst</div>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} disabled={creating}>
            <Plus size={16} strokeWidth={3} />
            New board
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl">Reference boards</h1>
          <p className="text-fst-ink/60 mt-2 max-w-xl">
            Paste in the films, ads and edits that capture a client&apos;s look, then cut a GIF montage of the
            collection to send along or drop in a deck.
          </p>
        </div>

        {clientTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs uppercase tracking-wide text-fst-ink/50 mr-1">Client</span>
            {clientTags.map((tag) => {
              const active = activeClient?.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setActiveClient(active ? null : tag)}
                  className={`px-3 py-1.5 rounded-full text-xs border-2 transition-colors ${
                    active ? "border-fst-black bg-fst-black text-fst-cream" : "border-fst-black/20 hover:border-fst-black/50"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {projects === null ? (
          <div className="text-fst-ink/50">Loading…</div>
        ) : visibleProjects && visibleProjects.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} filtered={Boolean(activeClient)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleProjects?.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateBoardModal
          creating={creating}
          onCancel={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function CreateBoardModal({
  creating,
  onCancel,
  onCreate,
}: {
  creating: boolean;
  onCancel: () => void;
  onCreate: (name: string, clientTag: string) => void;
}) {
  const [name, setName] = useState("");
  const [clientTag, setClientTag] = useState("");

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-6" onClick={onCancel}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name, clientTag);
        }}
        className="bg-fst-cream rounded-2xl border-2 border-fst-black p-6 w-full max-w-sm relative"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-fst-ink/40 hover:text-fst-black"
          aria-label="Cancel"
        >
          <X size={18} />
        </button>
        <h2 className="font-display text-xl mb-4">New board</h2>
        <label className="block text-xs uppercase tracking-wide text-fst-ink/50 mb-1">Board name</label>
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Q3 pitch"
          className="fst-input mb-4"
        />
        <label className="block text-xs uppercase tracking-wide text-fst-ink/50 mb-1">Client (optional)</label>
        <input
          value={clientTag}
          onChange={(e) => setClientTag(e.target.value)}
          placeholder="e.g. Acme"
          className="fst-input mb-5"
        />
        <Button type="submit" className="w-full justify-center" disabled={creating || !name.trim()}>
          <Plus size={16} strokeWidth={3} />
          Create board
        </Button>
      </form>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <a
      href={`/project/${project.id}`}
      className="group block rounded-2xl border-2 border-fst-black bg-white p-5 hover:shadow-[6px_6px_0_0_#000] transition-all hover:-translate-y-0.5 hover:-translate-x-0.5"
    >
      <div className="flex items-center gap-2 text-fst-ink/50">
        {project.montageStatus === "ready" ? <Film size={16} /> : <ImageIcon size={16} />}
        <span className="text-xs uppercase tracking-wide">
          {project.montageStatus === "ready" ? "montage ready" : "collecting"}
        </span>
      </div>
      <h3 className="font-display text-xl mt-3 truncate">{project.name}</h3>
      {project.clientTag && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] bg-fst-red/10 text-fst-red font-medium">
          {project.clientTag}
        </span>
      )}
      <div className="flex items-center gap-1 mt-4 text-xs text-fst-ink/50">
        <Clock size={12} /> {new Date(project.updatedAt).toLocaleDateString()}
      </div>
    </a>
  );
}

function EmptyState({ onCreate, filtered }: { onCreate: () => void; filtered: boolean }) {
  if (filtered) {
    return (
      <div className="text-sm text-fst-ink/50 border-2 border-dashed border-fst-black/20 rounded-2xl p-8 text-center">
        No boards for that client yet.
      </div>
    );
  }
  return (
    <div className="border-2 border-dashed border-fst-black/30 rounded-3xl py-24 px-6 text-center">
      <h2 className="font-display text-2xl md:text-3xl">Nothing collected yet</h2>
      <p className="text-fst-ink/60 mt-3 max-w-md mx-auto">
        Start a board, paste in a few reference links, and build up the moodboard for the pitch.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus size={16} strokeWidth={3} />
        Start a board
      </Button>
    </div>
  );
}
