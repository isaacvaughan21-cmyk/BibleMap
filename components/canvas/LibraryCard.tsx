"use client";

import { useEffect, useRef, useState } from "react";
import { THUMB_BOX, type CanvasFacts } from "@/lib/library/facts";
import type { CanvasEntry, Shelf } from "@/lib/library/model";
import type { BubbleTheme } from "@/lib/themes";
import type { NodeKind } from "@/lib/types";

/**
 * One study, as a plate in the atlas.
 *
 * The face of the card is the map's own shape — bubbles as dots, connections as
 * hairlines, drawn from the positions already in the database. No screenshot,
 * no stored image, nothing to invalidate: a study always shows what it actually
 * looks like. Under it sits the one line worth reading months later — the books
 * of scripture it touches.
 */

/** Same scheme as the minimap, so a card and its overview agree. */
function dotColor(kind: NodeKind, theme: BubbleTheme): string {
  if (theme.byType) return theme.types[kind].accent;
  switch (kind) {
    case "verse":
      return "var(--gold)";
    case "question":
      return "var(--ink-muted)";
    case "definition":
      return "var(--ink-soft)";
    default:
      return "var(--rule)";
  }
}

function MapThumb({
  facts,
  theme,
}: {
  facts: CanvasFacts;
  theme: BubbleTheme;
}) {
  if (!facts.thumb.length) {
    return (
      <span className="flex aspect-[5/2] items-center justify-center border-b border-rule bg-parchment-2/50 font-serif text-2xs italic text-ink-muted/70">
        Nothing placed yet
      </span>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${THUMB_BOX.w} ${THUMB_BOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="aspect-[5/2] w-full border-b border-rule bg-gradient-to-br from-parchment to-parchment-2"
    >
      {facts.thumbEdges.map(([a, b], i) => (
        <line
          key={i}
          x1={facts.thumb[a].x}
          y1={facts.thumb[a].y}
          x2={facts.thumb[b].x}
          y2={facts.thumb[b].y}
          stroke="var(--rule)"
          strokeWidth={0.5}
        />
      ))}
      {facts.thumb.map((p, i) => {
        const color = dotColor(p.kind, theme);
        // The first bubble placed is the anchor of a study — same emphasis the
        // canvas gives it.
        const r = i === 0 ? 1.9 : 1.35;
        return p.kind === "definition" ? (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={0.7}
          />
        ) : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={color}
            opacity={p.kind === "note" ? 0.6 : 0.92}
          />
        );
      })}
    </svg>
  );
}

/** "3 days ago" — coarse on purpose; nobody needs the minute. */
export function relativeTime(at: number): string {
  if (!at) return "never opened";
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? "last week" : `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  return months < 2 ? "last month" : `${months} months ago`;
}

export default function LibraryCard({
  entry,
  facts,
  theme,
  shelf,
  isActive,
  isGroup,
  searchExcerpt,
  startRename,
  onOpen,
  onRename,
  onTogglePin,
  onMenu,
  onDragStart,
  onDragEnd,
}: {
  entry: CanvasEntry;
  facts: CanvasFacts;
  theme: BubbleTheme;
  shelf: Shelf | null;
  isActive: boolean;
  isGroup: boolean;
  /** Set when the card is showing because its CONTENTS matched a search. */
  searchExcerpt?: { text: string; count: number; fromScripture: boolean };
  /** Set when "Rename…" was chosen from the card's own menu. */
  startRename?: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onTogglePin: () => void;
  onMenu: (anchor: DOMRect) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  useEffect(() => {
    if (!startRename) return;
    setDraft(entry.name);
    setRenaming(true);
  }, [startRename, entry.name]);
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  const commit = () => {
    onRename(draft);
    setRenaming(false);
  };

  // Same deal the canvas strikes on a bubble: one click does the ordinary
  // thing, two do the other one — so the open is held back long enough for a
  // double-click to claim the title for renaming instead.
  const beginRename = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setDraft(entry.name);
    setRenaming(true);
  };
  const openAfterPause = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onOpen();
    }, 240);
  };

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers refuse a drag with no payload.
        e.dataTransfer.setData("text/plain", entry.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-parchment text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-soft hover:shadow-lg hover:shadow-ink/10 ${
        isActive ? "border-gold shadow-md shadow-gold/10" : "border-rule"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${entry.name}`}
        className="block w-full text-left"
      >
        <MapThumb facts={facts} theme={theme} />
      </button>

      {/* Pin lives on the thumbnail — it's a state of the study, not a menu item */}
      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed={!!entry.pinned}
        aria-label={
          entry.pinned
            ? "Remove from currently studying"
            : "Mark as currently studying"
        }
        title={
          entry.pinned ? "Currently studying" : "Mark as currently studying"
        }
        className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all ${
          entry.pinned
            ? "bg-parchment/90 text-gold opacity-100"
            : "bg-parchment/80 text-ink-muted/60 opacity-0 hover:text-gold focus-visible:opacity-100 group-hover:opacity-100"
        }`}
      >
        ✦
      </button>

      {entry.seriesIndex !== undefined && shelf?.sequential && (
        <span className="absolute left-1.5 top-1.5 rounded-full border border-rule bg-parchment/90 px-1.5 py-px font-sans text-[10px] tabular-nums text-ink-muted">
          {entry.seriesIndex}
        </span>
      )}

      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") {
                setDraft(entry.name);
                setRenaming(false);
              }
            }}
            className="w-full rounded border border-gold bg-parchment px-1 py-0.5 font-sans text-xs font-medium text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={beginRename}
            onClick={openAfterPause}
            title="Double-click to rename"
            className="text-left font-sans text-xs font-medium leading-snug text-ink"
          >
            {entry.name}
          </button>
        )}

        {facts.refLabel && (
          <p className="font-serif text-2xs italic leading-snug text-gold">
            {facts.refLabel}
          </p>
        )}

        {searchExcerpt && (
          <p className="line-clamp-2 border-l-2 border-gold-soft/60 pl-1.5 font-sans text-[11px] leading-snug text-ink-muted">
            {searchExcerpt.text}
            {searchExcerpt.count > 1 && (
              <span className="text-ink-muted/60">
                {" "}
                +{searchExcerpt.count - 1} more
              </span>
            )}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-0.5 font-sans text-[11px] tabular-nums text-ink-muted">
          <span>
            {facts.bubbleCount} {facts.bubbleCount === 1 ? "bubble" : "bubbles"}
          </span>
          <span
            aria-hidden="true"
            className="h-0.5 w-0.5 rounded-full bg-ink-muted/50"
          />
          <span>{relativeTime(entry.openedAt)}</span>
          {isGroup && (
            <span
              title="Shared with a group"
              className="ml-auto text-gold"
              aria-label="Shared with a group"
            >
              ◈
            </span>
          )}
        </div>

        {(entry.tags?.length || entry.archivedAt) && (
          <div className="flex flex-wrap gap-1">
            {entry.archivedAt && (
              <span className="rounded-full border border-rule bg-parchment-2/70 px-1.5 py-px font-sans text-[10px] text-ink-muted">
                archived
              </span>
            )}
            {entry.tags?.map((t) => (
              <span
                key={t}
                className="rounded-full border border-rule bg-parchment-2/60 px-1.5 py-px font-sans text-[10px] text-ink-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        ref={menuBtnRef}
        type="button"
        aria-label={`Options for ${entry.name}`}
        onClick={() => {
          const rect = menuBtnRef.current?.getBoundingClientRect();
          if (rect) onMenu(rect);
        }}
        className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-muted/60 opacity-0 transition-opacity hover:bg-parchment-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg width="12" height="3" viewBox="0 0 12 3" aria-hidden="true">
          <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="6" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="10.5" cy="1.5" r="1.2" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
