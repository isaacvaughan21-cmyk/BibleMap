"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * First-run hint bar — three quiet pointers, dismissed once, never again.
 * Light enough to preserve the "no instructions needed" feel.
 */
export default function HintBar() {
  const hintsDismissed = useCanvasStore((s) => s.hintsDismissed);
  const dismissHints = useCanvasStore((s) => s.dismissHints);
  const loaded = useCanvasStore((s) => s.loaded);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  if (!loaded || hintsDismissed) return null;

  return (
    <div className="dive-dim pointer-events-none absolute bottom-5 left-4 z-30 animate-fade-up">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-rule/80 bg-parchment/90 py-2 pl-5 pr-3 font-sans text-2xs text-ink-muted shadow-md shadow-ink/5 backdrop-blur-md">
        <span>
          <span className="text-ink-soft">Double-click</span> the canvas to
          create
        </span>
        <Dot />
        <span>
          <span className="text-ink-soft">double-click</span> a bubble to open
          its map
        </span>
        <Dot />
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-rule bg-parchment-2/70 px-1 py-0.5 text-[10px] text-ink-soft">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
          to search
        </span>
        <button
          type="button"
          onClick={dismissHints}
          aria-label="Dismiss hints"
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-parchment-2 hover:text-ink"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path
              d="M1 1l6 6M7 1L1 7"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-gold" />
  );
}
