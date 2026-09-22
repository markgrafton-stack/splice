"use client";

import { useEffect, useState } from "react";

export const SPLICE_STATUS_LINES = [
  "Threading the film…",
  "Winding the reel…",
  "Splicing the frames…",
  "Cueing the projector…",
  "Snipping the good bits…",
  "Syncing sound and picture…",
  "Finding the money shot…",
  "Taping the edit together…",
  "Rolling camera…",
  "Cutting a fine line…",
];

/** Cycles through a pool of on-brand status lines while `active` is true.
 * Starts at a random line so parallel instances don't all say the same thing. */
export function useRotatingStatus(active: boolean, intervalMs = 1800): string {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SPLICE_STATUS_LINES.length));

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SPLICE_STATUS_LINES.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return SPLICE_STATUS_LINES[index];
}
