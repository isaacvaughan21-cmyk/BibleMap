"use client";

import { useViewport } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Live cursors of other group members, drawn over the canvas. Mounts INSIDE
 * the React Flow provider so it can read the viewport transform and place each
 * cursor at the right flow point as the map pans and zooms. Renders nothing
 * outside a group session.
 */
export default function RemoteCursors() {
  const session = useCanvasStore((s) => s.groupSession);
  const cursors = useCanvasStore((s) => s.remoteCursors);
  const members = useCanvasStore((s) => s.groupMembersOnline);
  const { x, y, zoom } = useViewport();

  if (!session) return null;
  const online = new Set(members.map((m) => m.userId));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {Object.values(cursors).map((c) => {
        if (!online.has(c.userId)) return null; // dropped peer — stop drawing
        const left = c.x * zoom + x;
        const top = c.y * zoom + y;
        return (
          <div
            key={c.userId}
            className="absolute -translate-y-0.5 will-change-transform"
            style={{ transform: `translate(${left}px, ${top}px)` }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
            >
              <path
                d="M2 2l5.2 13 2.2-5.4L15 7.4 2 2z"
                fill={c.color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-3 inline-block max-w-[16ch] truncate rounded-full px-1.5 py-0.5 font-sans text-[10px] font-medium text-white"
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
