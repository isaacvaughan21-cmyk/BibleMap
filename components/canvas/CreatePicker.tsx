"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NodeKind } from "@/lib/types";

/** Small picker shown on canvas double-click: Question / Verse / Note. */
export default function CreatePicker({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  onPick: (type: NodeKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The menu is taller than the click-point clamp can predict, so once it has
  // rendered we nudge it back inside its container — otherwise a double-click
  // low on the canvas leaves the last items cut off.
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const margin = 8;
    const maxLeft = parent.clientWidth - el.offsetWidth - margin;
    const maxTop = parent.clientHeight - el.offsetHeight - margin;
    setPos({
      left: Math.max(margin, Math.min(x, maxLeft)),
      top: Math.max(margin, Math.min(y, maxTop)),
    });
  }, [x, y]);

  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="absolute inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="menu"
        aria-label="Create a bubble"
        style={{ left: pos.left, top: pos.top }}
        className="absolute z-50 w-48 animate-fade-up rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
      >
        <p className="px-4 pb-1 pt-1.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
          NEW BUBBLE
        </p>
        <PickItem
          label="Question"
          hint="something you wonder"
          onClick={() => onPick("question")}
          glyph={
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-serif text-2xs text-gold">
              ?
            </span>
          }
        />
        <PickItem
          label="Verse"
          hint="a passage of scripture"
          onClick={() => onPick("verse")}
          glyph={
            <span className="flex h-5 w-5 items-center justify-center">
              <span className="h-4 w-[3px] rounded-sm bg-gold" />
            </span>
          }
        />
        <PickItem
          label="Note"
          hint="a thought of your own"
          onClick={() => onPick("note")}
          glyph={
            <span className="h-5 w-5 rounded-md border border-rule bg-parchment-2" />
          }
        />
        <PickItem
          label="Definition"
          hint="look up a word"
          onClick={() => onPick("definition")}
          glyph={
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-rule bg-parchment-2 font-serif text-2xs text-ink-soft">
              A
            </span>
          }
        />
      </div>
    </>
  );
}

function PickItem({
  label,
  hint,
  glyph,
  onClick,
}: {
  label: string;
  hint: string;
  glyph: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-parchment-2 focus-visible:bg-parchment-2"
    >
      {glyph}
      <span>
        <span className="block font-sans text-xs text-ink">{label}</span>
        <span className="block font-sans text-2xs text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}
