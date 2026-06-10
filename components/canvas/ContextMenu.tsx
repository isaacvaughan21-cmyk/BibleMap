"use client";

import { useEffect, useRef } from "react";
import type { EdgeKind, NodeKind } from "@/lib/types";

export type MenuTarget =
  | { kind: "node"; id: string; nodeType: NodeKind; x: number; y: number }
  | { kind: "edge"; id: string; edgeKind: EdgeKind; x: number; y: number }
  | { kind: "selection"; count: number; x: number; y: number };

const NODE_LABELS: Record<NodeKind, string> = {
  question: "Question",
  verse: "Verse",
  note: "Note",
};

/** Right-click menu for nodes (delete / change type) and edges (delete / change kind). */
export default function ContextMenu({
  target,
  onChangeNodeType,
  onChangeEdgeKind,
  onPickVerse,
  onDuplicate,
  onDelete,
  onClose,
}: {
  target: MenuTarget;
  onChangeNodeType: (id: string, type: NodeKind) => void;
  onChangeEdgeKind: (id: string, kind: EdgeKind) => void;
  onPickVerse: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (target: MenuTarget) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

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
        style={{ left: target.x, top: target.y }}
        className="absolute z-50 w-48 animate-fade-up rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
      >
        <p className="px-4 pb-1 pt-1.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
          {eyebrow.toUpperCase()}
        </p>

        {target.kind === "node" && target.nodeType === "verse" && (
          <MenuItem onClick={() => onPickVerse(target.id)}>
            Choose verse…
          </MenuItem>
        )}

        {target.kind === "node" &&
          (Object.keys(NODE_LABELS) as NodeKind[])
            .filter((t) => t !== target.nodeType)
            .map((t) => (
              <MenuItem key={t} onClick={() => onChangeNodeType(target.id, t)}>
                Change to {NODE_LABELS[t].toLowerCase()}
              </MenuItem>
            ))}

        {target.kind === "node" && (
          <MenuItem onClick={() => onDuplicate(target.id)}>Duplicate</MenuItem>
        )}

        {target.kind === "edge" && (
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
