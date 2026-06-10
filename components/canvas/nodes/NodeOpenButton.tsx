"use client";

import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * "Open into its own map" affordance — every bubble can contain a whole map.
 * Appears on hover; stays lit (gold) when the bubble already holds a sub-map.
 */
export default function NodeOpenButton({ id }: { id: string }) {
  const requestOpen = useCanvasStore((s) => s.requestOpen);
  const hasChild = useCanvasStore((s) => s.childMapIds.has(id));

  return (
    <button
      type="button"
      title={
        hasChild
          ? "Enter this bubble's map"
          : "Open this bubble into its own map"
      }
      aria-label={hasChild ? "Enter map" : "Open bubble into its own map"}
      onClick={(e) => {
        e.stopPropagation();
        requestOpen(id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`node-open nodrag absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-parchment shadow-sm shadow-ink/10 ${
        hasChild
          ? "node-open--has border-gold text-gold"
          : "border-rule text-ink-muted hover:border-gold hover:text-gold"
      }`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 2.5H2.5V5M7 2.5H9.5V5M5 9.5H2.5V7M7 9.5H9.5V7"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="6" r="1.1" fill="currentColor" />
      </svg>
    </button>
  );
}
