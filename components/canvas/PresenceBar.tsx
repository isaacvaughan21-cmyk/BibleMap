"use client";

import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * "Who's here" roster for the active group canvas — a row of coloured initials
 * top-centre. Renders nothing outside a group session.
 */
export default function PresenceBar() {
  const session = useCanvasStore((s) => s.groupSession);
  const members = useCanvasStore((s) => s.groupMembersOnline);
  if (!session) return null;

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-2">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-rule bg-parchment/80 px-2.5 py-1 shadow-sm shadow-ink/5 backdrop-blur-md">
        <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          {session.name}
        </span>
        <span aria-hidden="true" className="h-3 w-px bg-rule" />
        <div className="flex -space-x-1.5">
          {shown.map((m) => (
            <span
              key={m.userId}
              title={m.name}
              className="grid h-5 w-5 place-items-center rounded-full border border-parchment font-sans text-[10px] font-semibold text-white"
              style={{ background: m.color }}
            >
              {initial(m.name)}
            </span>
          ))}
          {extra > 0 && (
            <span className="grid h-5 w-5 place-items-center rounded-full border border-parchment bg-ink-muted font-sans text-[10px] font-semibold text-white">
              +{extra}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
