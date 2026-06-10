"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

type TopBarProps = {
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenPalette: () => void;
  onFeedback: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onHelp: () => void;
};

/** Fixed, translucent canvas top bar — same chrome language as the landing nav. */
export default function TopBar({
  railOpen,
  onToggleRail,
  onOpenPalette,
  onFeedback,
  onExport,
  onImportFile,
  onHelp,
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

        {/* Right: save state, palette, zoom, feedback, rail toggle */}
        <div className="flex items-center gap-3">
          <SaveBadge />
          <PaletteButton onOpen={onOpenPalette} />
          <ZoomBadge />

          <span aria-hidden="true" className="h-4 w-px bg-rule" />

          <button
            type="button"
            onClick={onFeedback}
            className="group relative hidden font-sans text-2xs tracking-eyebrow text-gold transition-colors hover:text-ink md:block"
            aria-label="Send feedback"
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

          <OverflowMenu
            onExport={onExport}
            onImportFile={onImportFile}
            onHelp={onHelp}
          />
        </div>
      </div>
    </header>
  );
}

/** "…" menu — export, import, shortcuts. */
function OverflowMenu({
  onExport,
  onImportFile,
  onHelp,
}: {
  onExport: () => void;
  onImportFile: (file: File) => void;
  onHelp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="More options"
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
          open
            ? "border-gold text-gold"
            : "border-rule text-ink-muted hover:border-gold hover:text-gold"
        }`}
      >
        <svg width="12" height="3" viewBox="0 0 12 3" aria-hidden="true">
          <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="6" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="10.5" cy="1.5" r="1.2" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label="Map options"
            className="absolute right-0 top-10 z-50 w-52 animate-fade-up rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
          >
            <MenuButton
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            >
              Export map (.hodos.json)
            </MenuButton>
            <MenuButton onClick={() => fileRef.current?.click()}>
              Import map…
            </MenuButton>
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            <MenuButton
              onClick={() => {
                onHelp();
                setOpen(false);
              }}
            >
              Keyboard shortcuts
            </MenuButton>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
              setOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink focus-visible:bg-parchment-2"
    >
      {children}
    </button>
  );
}

/** Subtle auto-save indicator — "Saving…" then a gold "Saved" that fades. */
function SaveBadge() {
  const saveState = useCanvasStore((s) => s.saveState);
  return (
    <span
      aria-live="polite"
      className={`flex items-center gap-1 font-sans text-2xs transition-opacity duration-500 ${
        saveState === "idle" ? "opacity-0" : "opacity-100"
      } ${saveState === "saved" ? "text-gold" : "text-ink-muted"}`}
    >
      {saveState === "saved" && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1.5 5.5L4 8L8.5 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {saveState === "saving" ? "Saving…" : "Saved"}
    </span>
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
