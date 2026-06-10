"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReactFlow, useViewport } from "@xyflow/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

type TopBarProps = {
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenPalette: () => void;
};

/** Fixed, translucent canvas top bar — same chrome language as the landing nav. */
export default function TopBar({
  railOpen,
  onToggleRail,
  onOpenPalette,
}: TopBarProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-rule/60 bg-parchment/70 backdrop-blur-md">
      <div className="relative flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: wordmark */}
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-md text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </Link>

        {/* Center: map name placeholder */}
        <p
          className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 font-serif text-sm italic text-ink-muted sm:block"
          aria-label="Map name"
        >
          Untitled map
        </p>

        {/* Right: palette, zoom, feedback, rail toggle */}
        <div className="flex items-center gap-3">
          <PaletteButton onOpen={onOpenPalette} />
          <ZoomBadge />

          <span aria-hidden="true" className="h-4 w-px bg-rule" />

          <button
            type="button"
            className="group relative hidden font-sans text-2xs tracking-eyebrow text-gold transition-colors hover:text-ink md:block"
            aria-label="Send feedback (arrives in a later milestone)"
          >
            SEND FEEDBACK
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full"
            />
          </button>

          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-rule md:block"
          />

          <button
            type="button"
            onClick={onToggleRail}
            aria-pressed={railOpen}
            aria-label={railOpen ? "Close study panel" : "Open study panel"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              railOpen
                ? "border-gold text-gold"
                : "border-rule text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="0.75"
                y="0.75"
                width="12.5"
                height="12.5"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <line
                x1="9"
                y1="1"
                x2="9"
                y2="13"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/** Live zoom readout — click to reset to 100%. */
function ZoomBadge() {
  const { zoom } = useViewport();
  const { zoomTo } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();
  const pct = Math.round(zoom * 100);
  return (
    <button
      type="button"
      onClick={() => zoomTo(1, { duration: reducedMotion ? 0 : 400 })}
      aria-label={`Zoom ${pct} percent — click to reset to 100 percent`}
      className="rounded-full px-2 py-1 font-sans text-2xs tabular-nums text-ink-muted transition-colors hover:bg-parchment-2 hover:text-ink"
    >
      {pct}%
    </button>
  );
}

/** Command-palette affordance with platform-aware shortcut hint. */
function PaletteButton({ onOpen }: { onOpen: () => void }) {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      className="flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="5" cy="5" r="4.2" stroke="currentColor" strokeWidth="1.3" />
        <line
          x1="8.2"
          y1="8.2"
          x2="11.2"
          y2="11.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <span className="tabular-nums">{isMac ? "⌘" : "Ctrl"} K</span>
    </button>
  );
}
