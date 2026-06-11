"use client";

import type { VerseNodeType } from "@/lib/types";
import CrossRefPanel from "./CrossRefPanel";

/**
 * Collapsible 320px study panel. Shows TSK cross-references when a verse
 * bubble is selected; otherwise a quiet hint.
 */
export default function RightRail({
  open,
  selectedVerse,
}: {
  open: boolean;
  selectedVerse: VerseNodeType | null;
}) {
  return (
    <aside
      aria-label="Study panel"
      aria-hidden={!open}
      className={`dive-dim absolute bottom-0 right-0 top-14 z-30 w-80 transform border-l border-rule/70 bg-parchment-2/85 backdrop-blur-md ${
        open
          ? "visible translate-x-0 [transition:transform_300ms_ease-out,visibility_0s]"
          : "invisible translate-x-full [transition:transform_300ms_ease-out,visibility_0s_300ms]"
      }`}
    >
      <div className="flex h-12 items-center border-b border-rule/70 px-5">
        <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          STUDY PANEL
        </p>
      </div>

      <div className="h-[calc(100%-3rem)]">
        {selectedVerse && selectedVerse.data.verseRef ? (
          <CrossRefPanel key={selectedVerse.id} node={selectedVerse} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
            {/* Tiny map glyph — two bubbles joined by an arc */}
            <svg
              width="56"
              height="40"
              viewBox="0 0 56 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 30 Q 28 6 46 22"
                stroke="var(--rule)"
                strokeWidth="1"
                fill="none"
              />
              <circle
                cx="10"
                cy="30"
                r="3.5"
                fill="var(--parchment)"
                stroke="var(--gold)"
              />
              <circle cx="46" cy="22" r="3.5" fill="var(--gold)" />
            </svg>
            <p className="font-serif text-sm italic leading-relaxed text-ink-muted">
              Select a verse bubble to see its cross-references here.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
