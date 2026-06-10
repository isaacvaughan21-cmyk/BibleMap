"use client";

import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Child-map badge — appears only on bubbles that already hold a map inside,
 * lit gold so you can see at a glance which thoughts contain worlds.
 * Double-click is the gesture that opens any bubble; clicking the badge
 * works too.
 */
export default function NodeOpenButton({ id }: { id: string }) {
  const requestOpen = useCanvasStore((s) => s.requestOpen);
  const hasChild = useCanvasStore((s) => s.childMapIds.has(id));

  if (!hasChild) return null;

  return (
    <button
      type="button"
      title="This bubble holds a map — double-click to enter"
      aria-label="Enter map"
      onClick={(e) => {
        e.stopPropagation();
        requestOpen(id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="node-open node-open--has nodrag absolute -right-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gold bg-parchment text-gold shadow-sm shadow-ink/10"
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
