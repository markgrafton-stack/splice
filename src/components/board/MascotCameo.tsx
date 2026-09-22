"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const MESSAGES = [
  "That's a wrap! First montage in the can.",
  "Cut, print, that's a keeper.",
  "Look at that — spliced to perfection.",
  "One board down. Send it to the client.",
  "Fresh off the reel. Nicely cut.",
];

export function MascotCameo({ onDismiss }: { onDismiss: () => void }) {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-2 animate-cameo-in">
      <div className="relative bg-white border-2 border-fst-black rounded-2xl rounded-br-none px-4 py-3 shadow-[4px_4px_0_0_#000] max-w-[200px]">
        <button
          onClick={onDismiss}
          className="absolute -top-2 -right-2 bg-fst-black text-fst-cream rounded-full p-1 hover:bg-fst-red"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
        <p className="text-sm font-medium leading-snug">{message}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/splice-mascot.png" alt="" className="h-28 w-auto drop-shadow-lg shrink-0" />
    </div>
  );
}
