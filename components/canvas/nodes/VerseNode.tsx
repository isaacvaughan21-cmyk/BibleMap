"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { NodeProps } from "@xyflow/react";
import type { VerseNodeType } from "@/lib/types";
import { useCanvasStore, usePrimaryNodeId } from "@/lib/store/canvas-store";
import { getHighlighter, HIGHLIGHTERS } from "@/lib/themes";
import NodeHandles from "./NodeHandles";
import NestBadge from "./NestBadge";
import PrimaryBadge from "./PrimaryBadge";
import EditLockBadge from "./EditLockBadge";
import { floatStyle } from "./float";

const TRUNCATE_AT = 240;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render text with stored phrases wrapped in <mark> highlights. Clicking a
 * highlight (once the bubble is selected) opens a small editor to recolour or
 * remove it; right-click opens the same editor. Reading never wipes a mark.
 */
function withHighlights(
  text: string,
  highlights: string[] | undefined,
  colors: Record<string, string> | undefined,
  selected: boolean,
  onEdit: (phrase: string, el: HTMLElement) => void,
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
  return text.split(re).map((part, i) => {
    if (!phrases.includes(part)) return <span key={i}>{part}</span>;
    // A chosen highlighter sets the mark colour inline; no choice (or an
    // unknown id) falls back to the theme highlight via the CSS variables.
    const hl = getHighlighter(colors?.[part]);
    return (
      <mark
        key={i}
        onClick={(e) => {
          // Unselected: let the click select the bubble first. Selected: edit.
          if (!selected) return;
          e.stopPropagation();
          onEdit(part, e.currentTarget);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(part, e.currentTarget);
        }}
        title={selected ? "Click to recolour or remove" : undefined}
        className={`verse-mark nodrag ${selected ? "cursor-pointer" : "cursor-text"}`}
        style={
          hl
            ? ({
                "--mark": hl.color,
                "--mark-strong": hl.strong,
              } as CSSProperties)
            : undefined
        }
      >
        {part}
      </mark>
    );
  });
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
  // A stored highlight being edited (recolour / remove), with where to anchor
  // the little editor popover (offsets relative to the bubble).
  const [editingHl, setEditingHl] = useState<{
    phrase: string;
    top: number;
    left: number;
  } | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  // The first bubble (earliest uuid v7 — they sort by creation time) on this
  // map, regardless of type, is the study's anchor.
  const isPrimary = usePrimaryNodeId() === id;

  const isLong = data.verseText.length > TRUNCATE_AT;
  const shown =
    isLong && !expanded
      ? `${data.verseText.slice(0, TRUNCATE_AT).trimEnd()}…`
      : data.verseText;

  // Clicking off the bubble drops an unconfirmed selection (and its gold wash)
  // and closes any open highlight editor.
  useEffect(() => {
    if (!selected) {
      setPending(null);
      setEditingHl(null);
      if (typeof window !== "undefined")
        window.getSelection()?.removeAllRanges();
    }
  }, [selected]);

  // Dismiss the highlight editor on an outside click or Escape.
  useEffect(() => {
    if (!editingHl) return;
    const onDown = (e: MouseEvent) => {
      if (!editRef.current?.contains(e.target as Node)) setEditingHl(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingHl(null);
    };
    // Defer so the opening click itself isn't caught as "outside".
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [editingHl]);

  // Open the recolour/remove editor anchored just below the clicked highlight.
  const openHighlightEditor = (phrase: string, el: HTMLElement) => {
    setPending(null);
    setEditingHl({
      phrase,
      top: el.offsetTop + el.offsetHeight + 6,
      left: Math.max(2, Math.min(el.offsetLeft, 44)),
    });
  };

  const recolorHighlight = (phrase: string, colorId?: string) => {
    const colors = { ...(data.highlightColors ?? {}) };
    if (colorId) colors[phrase] = colorId;
    else delete colors[phrase];
    updateNodeData(id, { highlightColors: colors });
    setEditingHl(null);
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? "";
    if (t && t.length > 1 && data.verseText.includes(t)) setPending(t);
    else setPending(null);
  };

  const addHighlight = (phrase: string, colorId?: string) => {
    const next = [...(data.highlights ?? [])];
    if (!next.includes(phrase)) next.push(phrase);
    const colors = { ...(data.highlightColors ?? {}) };
    if (colorId) colors[phrase] = colorId;
    else delete colors[phrase]; // theme default — no stored colour
    updateNodeData(id, { highlights: next, highlightColors: colors });
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = (phrase: string) => {
    const colors = { ...(data.highlightColors ?? {}) };
    delete colors[phrase];
    updateNodeData(id, {
      highlights: (data.highlights ?? []).filter((p) => p !== phrase),
      highlightColors: colors,
    });
    setEditingHl(null);
  };

  return (
    <div className="relative floaty" style={floatStyle(id)}>
      <NestBadge id={id} />
      <PrimaryBadge show={isPrimary} />
      <EditLockBadge id={id} />
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
            {withHighlights(
              shown,
              data.highlights,
              data.highlightColors,
              selected,
              openHighlightEditor,
            )}
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
          <div className="nodrag mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-sans text-2xs text-ink-muted">
              Highlight:
            </span>
            {/* Theme colour (the default) */}
            <button
              type="button"
              title="Theme colour"
              aria-label="Highlight in the theme colour"
              onClick={(e) => {
                e.stopPropagation();
                addHighlight(pending);
              }}
              className="h-4 w-4 rounded-full border border-rule shadow-sm transition-transform hover:scale-110"
              style={{
                background: "var(--bubble-highlight, var(--gold-soft))",
              }}
            />
            {HIGHLIGHTERS.map((h) => (
              <button
                key={h.id}
                type="button"
                title={h.name}
                aria-label={`Highlight ${h.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  addHighlight(pending, h.id);
                }}
                className="h-4 w-4 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110"
                style={{ background: h.color }}
              />
            ))}
          </div>
        )}
        {/* Highlight editor — recolour swatches + remove, anchored to the mark */}
        {editingHl && (
          <div
            ref={editRef}
            className="nodrag nowheel absolute z-20 flex items-center gap-1 rounded-full border border-rule bg-parchment px-1.5 py-1 shadow-lg shadow-ink/15"
            style={{ top: editingHl.top, left: editingHl.left }}
          >
            <button
              type="button"
              title="Theme colour"
              aria-label="Recolour to the theme colour"
              onClick={(e) => {
                e.stopPropagation();
                recolorHighlight(editingHl.phrase);
              }}
              className="h-4 w-4 rounded-full border border-rule transition-transform hover:scale-110"
              style={{
                background: "var(--bubble-highlight, var(--gold-soft))",
              }}
            />
            {HIGHLIGHTERS.map((h) => (
              <button
                key={h.id}
                type="button"
                title={h.name}
                aria-label={`Recolour ${h.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  recolorHighlight(editingHl.phrase, h.id);
                }}
                className="h-4 w-4 rounded-full border border-black/10 transition-transform hover:scale-110"
                style={{ background: h.color }}
              />
            ))}
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-rule" />
            <button
              type="button"
              title="Remove highlight"
              aria-label="Remove highlight"
              onClick={(e) => {
                e.stopPropagation();
                removeHighlight(editingHl.phrase);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 3.5h9M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
        <NodeHandles />
      </div>
    </div>
  );
}
