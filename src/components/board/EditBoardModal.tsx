"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/Button";
import type { Project } from "@/lib/db";

export function EditBoardModal({
  project,
  saving,
  onCancel,
  onSave,
}: {
  project: Project;
  saving: boolean;
  onCancel: () => void;
  onSave: (fields: { name: string; clientTag: string; description: string }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [clientTag, setClientTag] = useState(project.clientTag ?? "");
  const [description, setDescription] = useState(project.description ?? "");

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-6" onClick={onCancel}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name, clientTag, description });
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
        <h2 className="font-display text-xl mb-4">Board details</h2>

        <label className="block text-xs uppercase tracking-wide text-fst-ink/50 mb-1">Board name</label>
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="fst-input mb-4" />

        <label className="block text-xs uppercase tracking-wide text-fst-ink/50 mb-1">Client (optional)</label>
        <input
          value={clientTag}
          onChange={(e) => setClientTag(e.target.value)}
          placeholder="e.g. Acme"
          className="fst-input mb-4"
        />

        <label className="block text-xs uppercase tracking-wide text-fst-ink/50 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this board for — the pitch, the brief, anything worth a teammate knowing at a glance."
          rows={3}
          className="fst-input mb-5 resize-none"
        />

        <Button type="submit" className="w-full justify-center" disabled={saving || !name.trim()}>
          <Check size={16} strokeWidth={3} />
          Save
        </Button>
      </form>
    </div>
  );
}
