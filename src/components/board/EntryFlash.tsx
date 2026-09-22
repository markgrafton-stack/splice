"use client";

import { Clapperboard } from "lucide-react";

/** Plays once over an entry card the moment its clip finishes rendering. */
export function EntryFlash() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-10 flex items-center justify-center"
      aria-hidden
    >
      <div className="absolute inset-0 bg-white animate-splice-flash" />
      <Clapperboard size={56} className="text-fst-red animate-splice-snap drop-shadow-lg" strokeWidth={2.5} />
    </div>
  );
}
