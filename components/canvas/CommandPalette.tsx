"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { fuzzyScore } from "@/lib/fuzzy";
import { getNodeRecency, useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import type { HodosNode, NodeKind } from "@/lib/types";

/**
 * Command palette — fuzzy search across every bubble (ranked by recency),
 * create actions, and jump-to-bubble.
 */

type PaletteItem =
  | { kind: "jump"; node: HodosNode; label: string; sub: string }
  | { kind: "create"; type: NodeKind; label: string };

function nodeLabel(n: HodosNode): { label: string; sub: string } {
  if (n.type === "verse") {
    return {
      label: n.data.verseRef || "Untitled verse",
      sub: n.data.verseText.slice(0, 80) || "Verse",
    };
  }
  const text =
    n.data.content || (n.type === "question" ? "New question" : "New note");
  return {
    label: text.length > 64 ? `${text.slice(0, 64)}…` : text,
    sub: n.type === "question" ? "Question" : "Note",
  };
}

const CREATE_ITEMS: { type: NodeKind; label: string }[] = [
  { type: "question", label: "Create a question bubble" },
  { type: "verse", label: "Create a verse bubble" },
  { type: "note", label: "Create a note bubble" },
];

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const nodes = useCanvasStore((s) => s.nodes);
  const createNode = useCanvasStore((s) => s.createNode);
  const selectOnly = useCanvasStore((s) => s.selectOnly);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const setVersePicker = useCanvasStore((s) => s.setVersePicker);
  const { setCenter, screenToFlowPosition, getInternalNode } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const jumps = nodes
      .map((n) => {
        const { label, sub } = nodeLabel(n);
        // Title matches outrank body-text matches.
        const score = query
          ? Math.max(fuzzyScore(query, label) * 1.5, fuzzyScore(query, sub))
          : 0;
        return { node: n, label, sub, score };
      })
      .filter((r) => (query ? r.score > 0 : true))
      .sort(
        (a, b) =>
          b.score - a.score ||
          getNodeRecency(b.node.id) - getNodeRecency(a.node.id),
      )
      .slice(0, query ? 8 : 5)
      .map(
        (r): PaletteItem => ({
          kind: "jump",
          node: r.node,
          label: r.label,
          sub: r.sub,
        }),
      );

    const creates = CREATE_ITEMS.filter(
      (c) => !query || fuzzyScore(query, c.label) > 0,
    ).map((c): PaletteItem => ({ kind: "create", ...c }));

    return [...jumps, ...creates];
  }, [nodes, query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(items.length - 1, 0)));
  }, [items.length]);

  if (!open) return null;

  const run = (item: PaletteItem) => {
    if (item.kind === "create") {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const id = createNode(item.type, center);
      if (item.type === "verse") {
        // Verses are chosen via the picker, not typed.
        setEditing(null);
        setVersePicker(id);
      }
    } else {
      const internal = getInternalNode(item.node.id);
      const w = internal?.measured?.width ?? 200;
      const h = internal?.measured?.height ?? 60;
      selectOnly(item.node.id);
      setCenter(item.node.position.x + w / 2, item.node.position.y + h / 2, {
        zoom: 1,
        duration: reducedMotion ? 0 : 600,
      });
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      run(items[active]);
    }
  };

  const jumpItems = items.filter((i) => i.kind === "jump");
  const createItems = items.filter((i) => i.kind === "create");

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close command palette"
        tabIndex={-1}
      />

      <div className="relative mx-auto mt-[14vh] w-[min(560px,calc(100%-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/20">
        <div className="flex items-center gap-3 border-b border-rule/70 px-5 py-4">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-gold"
          >
            <circle
              cx="6"
              cy="6"
              r="5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <line
              x1="9.8"
              y1="9.8"
              x2="13"
              y2="13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search your map or type a command…"
            className="w-full bg-transparent font-serif text-md text-ink placeholder:text-ink-muted/60 focus:outline-none"
            aria-label="Command palette search"
          />
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-sans text-2xs text-ink-muted">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
          {jumpItems.length > 0 && (
            <Section label={query ? "BUBBLES" : "RECENT BUBBLES"}>
              {jumpItems.map((item) => (
                <Row
                  key={item.node.id}
                  active={items[active] === item}
                  onClick={() => run(item)}
                  onHover={() => setActive(items.indexOf(item))}
                >
                  <TypeGlyph type={item.node.type as NodeKind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-sm text-ink">
                      {item.label}
                    </span>
                    <span className="block truncate font-sans text-2xs text-ink-muted">
                      {item.sub}
                    </span>
                  </span>
                  <span className="font-sans text-2xs tracking-eyebrow text-ink-muted/70">
                    JUMP
                  </span>
                </Row>
              ))}
            </Section>
          )}

          {createItems.length > 0 && (
            <Section label="ACTIONS">
              {createItems.map((item) => (
                <Row
                  key={item.kind === "create" ? item.type : ""}
                  active={items[active] === item}
                  onClick={() => run(item)}
                  onHover={() => setActive(items.indexOf(item))}
                >
                  {item.kind === "create" && <TypeGlyph type={item.type} />}
                  <span className="flex-1 font-sans text-sm text-ink">
                    {item.label}
                  </span>
                  <span className="font-sans text-2xs tracking-eyebrow text-gold/80">
                    NEW
                  </span>
                </Row>
              ))}
            </Section>
          )}

          {items.length === 0 && (
            <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
              Nothing on the map matches &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 pb-1">
      <p className="px-3 pb-1 pt-2 font-sans text-2xs tracking-eyebrow text-ink-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  active,
  onClick,
  onHover,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={onHover}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
        active ? "bg-parchment-2" : "hover:bg-parchment-2/60"
      }`}
    >
      {children}
    </button>
  );
}

function TypeGlyph({ type }: { type: NodeKind }) {
  if (type === "question") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-serif text-2xs text-gold">
        ?
      </span>
    );
  }
  if (type === "verse") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="h-4 w-[3px] rounded-sm bg-gold" />
      </span>
    );
  }
  return (
    <span className="h-5 w-5 shrink-0 rounded-md border border-rule bg-parchment-2" />
  );
}
