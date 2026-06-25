"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getCompiledDoc } from "@/lib/notes/compiled-doc";
import {
  insertOutlineNode,
  makeOutlineNode,
  reorderWithinGroup,
  type GroupId,
} from "@/lib/notes/edit-outline";
import type { OutlineGraph, OutlineNode } from "@/lib/notes/outline";
import { useCanvasStore } from "@/lib/store/canvas-store";
import OutlineView, { type DropPos, type GroupKey } from "./OutlineView";
import AddNoteDialog, { type AddNoteResult } from "./AddNoteDialog";

/**
 * The /notes screen. Reads the outline the canvas stashed before navigating and
 * renders it as an editable reading document:
 *  - reorder rows by dragging (reading-order only — never the canvas);
 *  - add a verse/note/question/definition, which also drops a matching bubble
 *    on the canvas (linked under its topic, or free-floating at the top level).
 *
 * The graph lives in component state for the SPA session; a hard refresh / deep
 * link loses it, so we show a friendly empty state pointing back to the canvas.
 */
export default function NotesScreen() {
  // Peek once on mount — survives React strict-mode's double render.
  const [graph, setGraph] = useState<OutlineGraph | null>(() =>
    getCompiledDoc(),
  );
  const addNoteNode = useCanvasStore((s) => s.addNoteNode);

  // --- drag-to-reorder (pointer-based; native HTML5 DnD proved unreliable) ---
  // `drag` drives the render (dimmed source row + gold insertion line). The
  // immutable "what's being dragged" and the live drop target live in refs so
  // the window pointer listeners never read stale state.
  const [drag, setDrag] = useState<{
    id: string;
    overId: string | null;
    pos: DropPos;
  } | null>(null);
  const dragInfoRef = useRef<{ group: GroupKey; id: string } | null>(null);
  const dropRef = useRef<{ id: string; pos: DropPos } | null>(null);

  // --- add composer ---
  const [composerParent, setComposerParent] = useState<{
    parentId: string | null;
  } | null>(null);

  const toGroupId = (key: GroupKey): GroupId =>
    key === "roots"
      ? "roots"
      : key === "orphans"
        ? "orphans"
        : { childrenOf: key.slice("child:".length) };

  const controls = useMemo(
    () =>
      graph
        ? {
            draggingId: drag?.id ?? null,
            overId: drag?.overId ?? null,
            dropPos: drag?.pos ?? null,
            onHandleDown: (group: GroupKey, id: string) => {
              dragInfoRef.current = { group, id };
              dropRef.current = null;
              setDrag({ id, overId: null, pos: "before" });
            },
            onAdd: (parentId: string | null) => setComposerParent({ parentId }),
          }
        : undefined,
    [graph, drag],
  );

  // The whole drag lifecycle runs from window listeners while a drag is active.
  // Keyed on whether a drag exists (not the drag object) so it isn't re-attached
  // each time the drop target updates.
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    const EDGE = 90; // px from a viewport edge where auto-scroll kicks in
    const MAX_SPEED = 18; // px per frame at the very edge
    let raf = 0;
    let active = true;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    // Find the row under (x,y); update the drop target + indicator side. Scoped
    // to the dragged item's own group so a point can't jump between topics.
    const updateTarget = (x: number, y: number) => {
      const info = dragInfoRef.current;
      if (!info) return;
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const row = el?.closest<HTMLElement>("[data-drag-row]");
      if (
        row &&
        row.getAttribute("data-drag-group") === info.group &&
        row.getAttribute("data-drag-row") !== info.id
      ) {
        const overId = row.getAttribute("data-drag-row")!;
        const rect = row.getBoundingClientRect();
        const pos: DropPos =
          y - rect.top < rect.height / 2 ? "before" : "after";
        const cur = dropRef.current;
        if (!cur || cur.id !== overId || cur.pos !== pos) {
          dropRef.current = { id: overId, pos };
          setDrag((d) => (d ? { ...d, overId, pos } : d));
        }
      } else if (dropRef.current) {
        dropRef.current = null;
        setDrag((d) => (d ? { ...d, overId: null } : d));
      }
    };

    const onMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      updateTarget(e.clientX, e.clientY);
    };
    const finish = (commit: boolean) => {
      const info = dragInfoRef.current;
      const dt = dropRef.current;
      if (commit && info && dt)
        setGraph((g) =>
          g
            ? reorderWithinGroup(
                g,
                toGroupId(info.group),
                info.id,
                dt.id,
                dt.pos,
              )
            : g,
        );
      dragInfoRef.current = null;
      dropRef.current = null;
      setDrag(null);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

    const tick = () => {
      if (!active) return;
      const h = window.innerHeight;
      let dy = 0;
      if (pointerY < EDGE) dy = -MAX_SPEED * (1 - pointerY / EDGE);
      else if (pointerY > h - EDGE)
        dy = MAX_SPEED * (1 - (h - pointerY) / EDGE);
      if (dy) {
        window.scrollBy(0, dy);
        // Content moves under a stationary pointer — re-evaluate the target.
        updateTarget(pointerX, pointerY);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isDragging]);

  const handleAdd = (result: AddNoteResult) => {
    if (!graph || !composerParent) return;
    const parentId = composerParent.parentId;
    const id = addNoteNode({ type: result.type, data: result.data, parentId });
    const node = makeOutlineNode(id, result.type, {
      title: result.title,
      text: result.text,
    });
    setGraph((g) => (g ? insertOutlineNode(g, parentId, node) : g));
    setComposerParent(null);
  };

  if (!graph || graph.stats.nodeCount === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-parchment px-8 text-center">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </div>
        <p className="max-w-md font-serif text-md text-ink-soft">
          {graph ? "This map is empty." : "Nothing to compile yet."}
        </p>
        <p className="max-w-md font-sans text-xs text-ink-muted">
          Open a map and choose &ldquo;Compile to notes&rdquo; to turn your
          bubbles into a structured, printable study document.
        </p>
        <Link
          href="/app"
          className="mt-2 rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
        >
          Back to the canvas
        </Link>
      </main>
    );
  }

  const parentLabel = composerParent?.parentId
    ? labelOf(findNode(graph, composerParent.parentId))
    : null;

  return (
    <main className="relative min-h-dvh bg-parchment">
      {/* Sticky action bar — excluded from print via .no-print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-rule/60 bg-parchment/80 px-gutter py-3 backdrop-blur-md md:px-gutter-lg">
        <Link
          href="/app"
          className="flex items-center gap-1.5 font-sans text-xs text-ink-muted transition-colors hover:text-gold"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M7.5 2.5 4 6l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to canvas
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-gold px-4 py-1.5 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
        >
          Export PDF
        </button>
      </div>

      <OutlineView graph={graph} controls={controls} />

      <p className="no-print mx-auto max-w-content px-gutter pb-12 font-sans text-2xs text-ink-muted/70 md:px-gutter-lg">
        Drag the handle to reorder (this only changes the document, not your
        canvas). Use &ldquo;Add point / section&rdquo; to add a bubble — it
        appears on your canvas too. Tip: in the print dialog choose &ldquo;Save
        as PDF&rdquo; as the destination.
      </p>

      {composerParent && (
        <AddNoteDialog
          parentLabel={parentLabel}
          onSubmit={handleAdd}
          onClose={() => setComposerParent(null)}
        />
      )}
    </main>
  );
}

/** Find a node anywhere in the forest. */
function findNode(graph: OutlineGraph, id: string): OutlineNode | null {
  const stack: OutlineNode[] = [...graph.roots, ...graph.orphans];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    for (const c of n.children) stack.push(c);
  }
  return null;
}

/** A short human label for a node (verse ref / term / clipped content). */
function labelOf(node: OutlineNode | null): string | null {
  if (!node) return null;
  const raw = (node.title || node.text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "(untitled)";
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
}
