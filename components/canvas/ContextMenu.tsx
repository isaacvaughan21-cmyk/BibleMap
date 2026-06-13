"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { parseRef } from "@/lib/bible";
import { BIBLE_VERSIONS } from "@/lib/versions";
import type { EdgeKind, NodeKind } from "@/lib/types";

export type MenuTarget =
  | { kind: "node"; id: string; nodeType: NodeKind; x: number; y: number }
  | { kind: "edge"; id: string; edgeKind: EdgeKind; x: number; y: number }
  | { kind: "selection"; count: number; x: number; y: number };

const NODE_LABELS: Record<NodeKind, string> = {
  question: "Question",
  verse: "Verse",
  note: "Note",
  definition: "Definition",
};

/** Right-click menu for nodes (delete / change type) and edges (delete / change kind). */
export default function ContextMenu({
  target,
  onChangeNodeType,
  onChangeEdgeKind,
  onChangeVerseVersion,
  onReverseEdge,
  onPickVerse,
  onDuplicate,
  onDelete,
  onClose,
}: {
  target: MenuTarget;
  onChangeNodeType: (id: string, type: NodeKind) => void;
  onChangeEdgeKind: (id: string, kind: EdgeKind) => void;
  onChangeVerseVersion: (id: string, code: string) => void;
  onReverseEdge: (id: string) => void;
  onPickVerse: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (target: MenuTarget) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const requestOpen = useCanvasStore((s) => s.requestOpen);
  const hasChildMap = useCanvasStore((s) =>
    target.kind === "node" ? s.childMapIds.has(target.id) : false,
  );
  // A verse's reference, when this is a verse bubble — drives version-switching.
  const verseRef = useCanvasStore((s) => {
    if (target.kind !== "node" || target.nodeType !== "verse") return null;
    const n = s.nodes.find((node) => node.id === target.id);
    return n && n.type === "verse" ? n.data.verseRef : null;
  });
  const canChangeVersion = !!verseRef && !!parseRef(verseRef);

  // The menu's height varies (verse menus carry a version row), so once it has
  // rendered, nudge it back inside the canvas rather than letting it run off.
  const [pos, setPos] = useState({ left: target.x, top: target.y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const margin = 8;
    setPos({
      left: Math.max(
        margin,
        Math.min(target.x, parent.clientWidth - el.offsetWidth - margin),
      ),
      top: Math.max(
        margin,
        Math.min(target.y, parent.clientHeight - el.offsetHeight - margin),
      ),
    });
  }, [target.x, target.y, canChangeVersion]);

  useEffect(() => {
    menuRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const eyebrow =
    target.kind === "node"
      ? NODE_LABELS[target.nodeType]
      : target.kind === "selection"
        ? `${target.count} bubbles`
        : target.edgeKind === "crossref"
          ? "Cross-reference"
          : "Link";

  return (
    <>
      {/* Invisible scrim — catches outside clicks */}
      <div
        className="absolute inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />

      <div
        ref={menuRef}
        role="menu"
        aria-label={`${eyebrow} actions`}
        style={{ left: pos.left, top: pos.top }}
        className="absolute z-50 w-48 animate-fade-up rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
      >
        <p className="px-4 pb-1 pt-1.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
          {eyebrow.toUpperCase()}
        </p>

        {target.kind === "node" && (
          <MenuItem
            onClick={() => {
              requestOpen(target.id);
              onClose();
            }}
          >
            {hasChildMap ? "Enter its map" : "Open into its own map"}
          </MenuItem>
        )}

        {target.kind === "node" && target.nodeType === "verse" && (
          <MenuItem onClick={() => onPickVerse(target.id)}>
            Choose verse…
          </MenuItem>
        )}

        {/* Scripture is never re-typed into a note or question — but a verse
            CAN be shown in a different translation. */}
        {target.kind === "node" && target.nodeType === "verse"
          ? canChangeVersion && (
              <>
                <p className="px-4 pb-1 pt-1.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
                  VERSION
                </p>
                <div className="flex flex-wrap gap-1.5 px-4 pb-1.5">
                  {BIBLE_VERSIONS.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      title={v.name}
                      onClick={() => onChangeVerseVersion(target.id, v.code)}
                      className="rounded-full border border-rule px-2.5 py-0.5 font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:border-gold hover:text-gold"
                    >
                      {v.code}
                    </button>
                  ))}
                </div>
              </>
            )
          : target.kind === "node" &&
            (Object.keys(NODE_LABELS) as NodeKind[])
              .filter((t) => t !== target.nodeType)
              .map((t) => (
                <MenuItem
                  key={t}
                  onClick={() => onChangeNodeType(target.id, t)}
                >
                  Change to {NODE_LABELS[t].toLowerCase()}
                </MenuItem>
              ))}

        {target.kind === "node" && (
          <MenuItem onClick={() => onDuplicate(target.id)}>Duplicate</MenuItem>
        )}

        {target.kind === "edge" && (
          <>
            <MenuItem onClick={() => onReverseEdge(target.id)}>
              Reverse direction
            </MenuItem>
            <MenuItem
              onClick={() =>
                onChangeEdgeKind(
                  target.id,
                  target.edgeKind === "manual" ? "crossref" : "manual",
                )
              }
            >
              {target.edgeKind === "manual"
                ? "Make cross-reference"
                : "Make manual link"}
            </MenuItem>
          </>
        )}

        <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />

        <MenuItem onClick={() => onDelete(target)}>
          {target.kind === "selection"
            ? `Delete ${target.count} bubbles`
            : "Delete"}
        </MenuItem>
      </div>
    </>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink focus-visible:bg-parchment-2"
    >
      {children}
    </button>
  );
}
