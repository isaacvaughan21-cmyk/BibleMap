"use client";

import { useState } from "react";
import Link from "next/link";
import { getCompiledDoc } from "@/lib/notes/compiled-doc";
import AIStudyDocView from "./AIStudyDocView";

/**
 * The /notes screen. Reads the StudyDoc the canvas stashed before navigating,
 * renders it, and offers "Export PDF" (the browser's native Save-as-PDF). The
 * doc lives in module state for the SPA session; a hard refresh / deep link
 * loses it, so we show a friendly empty state pointing back to the canvas.
 */
export default function NotesScreen() {
  // Peek once on mount — survives React strict-mode's double render.
  const [doc] = useState(() => getCompiledDoc());

  if (!doc || doc.meta.nodeCount === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-parchment px-8 text-center">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </div>
        <p className="max-w-md font-serif text-md text-ink-soft">
          {doc ? "This map is empty." : "Nothing to compile yet."}
        </p>
        <p className="max-w-md font-sans text-xs text-ink-muted">
          Open a map and choose &ldquo;Compile to notes&rdquo; to turn your
          bubbles into a structured, printable study document.
        </p>
        <Link
          href="/app"
          className="mt-2 rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
        >
          Back to the canvas
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-parchment">
      {/* Sticky action bar — excluded from print via .no-print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-rule/60 bg-parchment/80 px-gutter py-3 backdrop-blur-md md:px-gutter-lg">
        <Link
          href="/app"
          className="flex items-center gap-1.5 font-sans text-xs text-ink-muted transition-colors hover:text-gold"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M7.5 2.5 4 6l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to canvas
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-gold px-4 py-1.5 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
        >
          Export PDF
        </button>
      </div>

      <AIStudyDocView doc={doc} />

      <p className="no-print mx-auto max-w-content px-gutter pb-12 font-sans text-2xs text-ink-muted/70 md:px-gutter-lg">
        Tip: in the print dialog choose &ldquo;Save as PDF&rdquo; as the
        destination.
      </p>
    </main>
  );
}
