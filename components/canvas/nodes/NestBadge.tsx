"use client";

import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * A small gold marker on bubbles that contain a nested map of their own —
 * a quiet hint that double-clicking will dive into it.
 */
export default function NestBadge({ id }: { id: string }) {
  const hasChildMap = useCanvasStore((s) => s.childMapIds.has(id));
  if (!hasChildMap) return null;
  return (
    <span
      title="Opens into its own map — double-click to dive in"
      aria-label="Has a nested map"
      className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 bg-parchment text-gold shadow-sm shadow-gold/20"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="1.5"
          y="3.5"
          width="6.5"
          height="6.5"
          rx="1.4"
          fill="var(--parchment)"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <rect
          x="4"
          y="1"
          width="6.5"
          height="6.5"
          rx="1.4"
          fill="var(--parchment)"
          stroke="currentColor"
          strokeWidth="1.1"
        />
      </svg>
    </span>
  );
}
