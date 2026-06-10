"use client";

import type { HodosExport } from "@/lib/db/repo";

/** Confirm dialog for importing a .hodos.json — merge or replace. */
export default function ImportDialog({
  data,
  onMerge,
  onReplace,
  onCancel,
}: {
  data: HodosExport;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const liveNodes = data.nodes.filter((n) => !n.deletedAt).length;
  const liveEdges = data.edges.filter((e) => !e.deletedAt).length;

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Import map"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-label="Cancel import"
        tabIndex={-1}
      />

      <div className="relative mx-auto mt-[22vh] w-[min(420px,calc(100%-2rem))] animate-fade-up rounded-2xl border border-rule bg-parchment px-6 py-5 text-center shadow-2xl shadow-ink/20">
        <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          IMPORT MAP
        </p>
        <p className="mt-3 font-serif text-md text-ink">
          {liveNodes} bubble{liveNodes === 1 ? "" : "s"}, {liveEdges} connection
          {liveEdges === 1 ? "" : "s"}
        </p>
        <p className="mt-1 font-sans text-xs text-ink-muted">
          Merge with your current map, or replace it entirely?
        </p>
        <p className="mt-1 font-sans text-2xs text-ink-muted/80">
          Replacing discards your current map.
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-full border border-rule px-4 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}
