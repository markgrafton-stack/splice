"use client";

import { useState } from "react";
import { Link as LinkIcon, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/Button";

export function PasteLinkBar({ onAdd }: { onAdd: (url: string) => Promise<string | null> }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onAdd(url.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setUrl("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-fst-black bg-white p-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fst-ink/40" />
          <input
            type="url"
            required
            placeholder="Paste a YouTube or Vimeo link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="fst-input pl-9"
            disabled={busy}
          />
        </div>
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
          Add to board
        </Button>
      </div>
      {error && <p className="text-xs text-fst-red mt-2">{error}</p>}
    </form>
  );
}
