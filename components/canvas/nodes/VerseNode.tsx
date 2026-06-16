"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/types";
import { useCanvasStore, usePrimaryNodeId } from "@/lib/store/canvas-store";
import NodeHandles from "./NodeHandles";
import NestBadge from "./NestBadge";
import PrimaryBadge from "./PrimaryBadge";
import { floatStyle } from "./float";

const TRUNCATE_AT = 240;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render text with stored phrases wrapped in <mark> highlights. A left-click
 * does nothing (so reading a highlighted phrase doesn't wipe it); a right-click
 * asks to remove it.
 */
function withHighlights(
  text: string,
  highlights: string[] | undefined,
  onRequestRemove: (phrase: string) => void,
): ReactNode {
  const phrases = [...new Set(highlights ?? [])].filter((p) =>
    text.includes(p),
  );
  if (!phrases.length) return text;
  // Longest-first so a phrase isn't split by a shorter overlapping one.
  const re = new RegExp(
    `(${phrases
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})`,
    "g",
  );
  return text.split(re).map((part, i) =>
    phrases.includes(part) ? (
      <mark
        key={i}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRequestRemove(part);
        }}
        title="Right-click to remove highlight"
        className="verse-mark nodrag cursor-text"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * A scripture bubble — gold left border, mono reference, serif verse text.
 * Clicking an empty verse bubble opens the verse picker (wired in Canvas).
 * Long passages truncate at 240 chars with an expand affordance.
 *
 * Highlighting: the verse text is only selectable once the bubble is selected,
 * so a first drag MOVES the bubble instead of selecting text. Once selected,
 * drag across a phrase to highlight it; clicking away before confirming drops
 * the pending highlight. The first verse placed on a canvas is emphasised so
 * the study's anchor stands out.
 */
export default function VerseNode({
  id,
  data,
  selected,
}: NodeProps<VerseNodeType>) {
  const [expanded, setExpanded] = useState(false);
  // A selection awaiting confirmation into a stored highlight.
  const [pending, setPending] = useState<string | null>(null);
  // A stored highlight a right-click has offered to remove.
  const [removing, setRemoving] = useState<string | null>(null);
  const removeRef = useRef<HTMLDivElement>(null);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  // The first bubble (earliest uuid v7 — they sort by creation time) on this
  // map, regardless of type, is the study's anchor.
  const isPrimary = usePrimaryNodeId() === id;

  const isLong = data.verseText.length > TRUNCATE_AT;
  const shown =
    isLong && !expanded
      ? `${data.verseText.slice(0, TRUNCATE_AT).trimEnd()}…`
      : data.verseText;

  // Clicking off the bubble drops an unconfirmed selection (and its gold wash).
  useEffect(() => {
    if (!selected) {
      setPending(null);
      if (typeof window !== "undefined")
        window.getSelection()?.removeAllRanges();
    }
  }, [selected]);

  // Dismiss the remove prompt on an outside click or Escape.
  useEffect(() => {
    if (!removing) return;
    const onDown = (e: MouseEvent) => {
      if (!removeRef.current?.contains(e.target as Node)) setRemoving(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRemoving(null);
    };
    // Defer so the opening right-click itself isn't caught as "outside".
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [removing]);

  const captureSelection = () => {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? "";
    if (t && t.length > 1 && data.verseText.includes(t)) setPending(t);
    else setPending(null);
  };

  const addHighlight = (phrase: string) => {
    const next = [...(data.highlights ?? [])];
    if (!next.includes(phrase)) next.push(phrase);
    updateNodeData(id, { highlights: next });
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = (phrase: string) => {
    updateNodeData(id, {
      highlights: (data.highlights ?? []).filter((p) => p !== phrase),
    });
    setRemoving(null);
  };

  return (
    <div className="relative floaty" style={floatStyle(id)}>
      <NestBadge id={id} />
      <PrimaryBadge show={isPrimary} />
      <div
        className={`bubble w-64 rounded-xl border border-l-[3px] border-l-gold bg-parchment px-4 py-3 ${
          selected ? "bubble-selected border-gold" : "border-rule"
        } ${isPrimary ? "node-primary" : ""} ${
          data.verseRef ? "" : "cursor-pointer hover:border-gold/60"
        }`}
      >
        <p
          className={`font-mono text-2xs font-medium uppercase tracking-[0.14em] ${
            data.verseRef ? "text-gold" : "text-gold/50"
          }`}
        >
          {data.verseRef || "Choose a verse…"}
        </p>
        {data.verseText && (
          <p
            onMouseUp={selected ? captureSelection : undefined}
            className={`mt-1.5 font-serif text-sm leading-relaxed text-ink-soft ${
              selected ? "nodrag select-text" : "select-none"
            }`}
          >
            {withHighlights(shown, data.highlights, setRemoving)}
            {isLong && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((x) => !x);
                  }}
                  className="nodrag font-sans text-2xs tracking-wide text-gold transition-colors hover:text-ink"
                >
                  {expanded ? "collapse" : "expand"}
                </button>
              </>
            )}
          </p>
        )}
        {pending && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addHighlight(pending);
            }}
            className="nodrag mt-2 inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 font-sans text-2xs text-gold transition-colors hover:bg-gold/20"
          >
            Highlight “
            {pending.length > 18 ? pending.slice(0, 18) + "…" : pending}”
          </button>
        )}
        {removing && (
          <div
            ref={removeRef}
            className="nodrag mt-2 flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeHighlight(removing);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-danger/50 bg-danger/10 px-2.5 py-0.5 font-sans text-2xs text-danger transition-colors hover:bg-danger/20"
            >
              Remove highlight
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRemoving(null);
              }}
              className="font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
            >
              cancel
            </button>
          </div>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
