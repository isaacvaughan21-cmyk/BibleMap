"use client";

import { useState, type ReactNode } from "react";
import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import NodeHandles from "./NodeHandles";
import NestBadge from "./NestBadge";
import { floatStyle } from "./float";

const TRUNCATE_AT = 240;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Render text with stored phrases wrapped in clickable <mark> highlights. */
function withHighlights(
  text: string,
  highlights: string[] | undefined,
  onRemove: (phrase: string) => void,
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
        onClick={(e) => {
          e.stopPropagation();
          onRemove(part);
        }}
        title="Click to remove highlight"
        className="nodrag cursor-pointer rounded-sm bg-gold/25 px-0.5 text-ink decoration-gold/40 hover:bg-gold/35"
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
 * Long passages truncate at 240 chars with an expand affordance. Selecting
 * text inside the verse offers to highlight it. The first verse placed on a
 * canvas is emphasised so the study's anchor stands out.
 */
export default function VerseNode({
  id,
  data,
  selected,
}: NodeProps<VerseNodeType>) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  // The first verse (earliest uuid v7 — they sort by creation time) on this map.
  const isPrimary = useCanvasStore((s) => {
    let firstId: string | null = null;
    for (const n of s.nodes)
      if (n.type === "verse" && (firstId === null || n.id < firstId))
        firstId = n.id;
    return firstId === id;
  });

  const isLong = data.verseText.length > TRUNCATE_AT;
  const shown =
    isLong && !expanded
      ? `${data.verseText.slice(0, TRUNCATE_AT).trimEnd()}…`
      : data.verseText;

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
  };

  return (
    <div className="relative floaty" style={floatStyle(id)}>
      <NestBadge id={id} />
      <div
        className={`bubble w-64 rounded-xl border border-l-[3px] border-l-gold bg-parchment px-4 py-3 ${
          selected ? "bubble-selected border-gold" : "border-rule"
        } ${isPrimary ? "verse-primary" : ""} ${
          data.verseRef ? "" : "cursor-pointer hover:border-gold/60"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className={`font-mono text-2xs font-medium uppercase tracking-[0.14em] ${
              data.verseRef ? "text-gold" : "text-gold/50"
            }`}
          >
            {data.verseRef || "Choose a verse…"}
          </p>
          {isPrimary && data.verseRef && (
            <span
              title="The first verse on this canvas"
              aria-label="Anchor verse"
              className="shrink-0 text-2xs text-gold"
            >
              ✦
            </span>
          )}
        </div>
        {data.verseText && (
          <p
            onMouseUp={captureSelection}
            className="nodrag mt-1.5 select-text font-serif text-sm leading-relaxed text-ink-soft"
          >
            {withHighlights(shown, data.highlights, removeHighlight)}
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
        <NodeHandles />
      </div>
    </div>
  );
}
