"use client";

import { useEffect, useRef } from "react";

/**
 * Command palette shell — opens with Cmd/Ctrl-K. Search, create, and jump
 * commands arrive in a later milestone.
 */
export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Scrim */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close command palette"
        tabIndex={-1}
      />

      {/* Panel */}
      <div className="relative mx-auto mt-[16vh] w-[min(560px,calc(100%-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/20">
        <div className="flex items-center gap-3 border-b border-rule/70 px-5 py-4">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-gold"
          >
            <circle
              cx="6"
              cy="6"
              r="5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <line
              x1="9.8"
              y1="9.8"
              x2="13"
              y2="13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search your map or type a command…"
            className="w-full bg-transparent font-serif text-md text-ink placeholder:text-ink-muted/60 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            aria-label="Command palette search"
          />
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-sans text-2xs text-ink-muted">
            esc
          </kbd>
        </div>

        <div className="px-5 py-8 text-center">
          <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
            COMMANDS ARRIVE SOON
          </p>
          <p className="mt-2 font-serif text-sm italic text-ink-muted">
            Search, create, and jump — all from here.
          </p>
        </div>
      </div>
    </div>
  );
}
