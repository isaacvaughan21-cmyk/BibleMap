"use client";

import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Shows who is currently editing a bubble in a group session — a small pill
 * above it, in that member's colour. Renders nothing when the bubble is free.
 * The functional block lives in the store (`setEditing` refuses a locked
 * bubble); this is the visible cue.
 */
export default function EditLockBadge({ id }: { id: string }) {
  const lock = useCanvasStore((s) => s.remoteLocks[id]);
  if (!lock) return null;
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[135%] items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-[10px] font-medium text-white shadow-sm shadow-ink/20"
      style={{ background: lock.color }}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 8.8 8.2 2.6l1.2 1.2L3.2 10l-1.6.4.4-1.6Z"
          fill="white"
          stroke="white"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      </svg>
      {lock.name}
    </span>
  );
}
