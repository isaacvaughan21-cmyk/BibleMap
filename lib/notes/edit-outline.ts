// lib/notes/edit-outline.ts — immutable, view-side edits to a compiled
// OutlineGraph. These power the /notes screen's reorder (drag-and-drop) and
// add-item actions. They never touch the canvas store; reordering is purely a
// reading-order change, and adding inserts the node the store already created.

import type { OutlineGraph, OutlineNode, OutlineNodeKind } from "./outline";

/** Identifies a sibling list within the graph: the roots, the orphans, or a
 *  node's children (by that node's id). Drag reorder is scoped to one group so
 *  it can't move a point between topics (which would imply a canvas change). */
export type GroupId = "roots" | "orphans" | { childrenOf: string };

const clone = <T>(g: T): T => structuredClone(g);

/** Find a node anywhere in the forest (roots + orphans, recursively). */
function findNode(graph: OutlineGraph, id: string): OutlineNode | null {
  const stack: OutlineNode[] = [...graph.roots, ...graph.orphans];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    for (const c of n.children) stack.push(c);
  }
  return null;
}

/** Resolve a group id to its (mutable) sibling array within `graph`. */
function groupArray(graph: OutlineGraph, group: GroupId): OutlineNode[] | null {
  if (group === "roots") return graph.roots;
  if (group === "orphans") return graph.orphans;
  return findNode(graph, group.childrenOf)?.children ?? null;
}

/**
 * Insert `draggedId` just `position` (before/after) `targetId`, within one
 * group — so a drop lands in the gap the indicator showed, not on top of a row.
 * Returns a new graph (or the same reference when it's a no-op).
 */
export function reorderWithinGroup(
  graph: OutlineGraph,
  group: GroupId,
  draggedId: string,
  targetId: string,
  position: "before" | "after" = "before",
): OutlineGraph {
  if (draggedId === targetId) return graph;
  const next = clone(graph);
  const arr = groupArray(next, group);
  if (!arr) return graph;
  const from = arr.findIndex((n) => n.id === draggedId);
  if (from < 0) return graph;
  const [moved] = arr.splice(from, 1); // remove first, then index the target
  const to = arr.findIndex((n) => n.id === targetId);
  if (to < 0) return graph;
  arr.splice(position === "after" ? to + 1 : to, 0, moved);
  return next;
}

/** Build a fresh OutlineNode for a just-created bubble. */
export function makeOutlineNode(
  id: string,
  kind: OutlineNodeKind,
  fields: { title?: string; text?: string },
  depth = 0,
): OutlineNode {
  const title = fields.title?.trim() || undefined;
  const text = fields.text?.trim() || undefined;
  return {
    id,
    kind,
    rawType: kind,
    title,
    text,
    isEmpty: !title && !text,
    isAnchor: false,
    children: [],
    crossRefs: [],
    depth,
  };
}

/**
 * Insert `node` into the graph: as a child of `parentId` (a new sub-point) or,
 * when `parentId` is null, as a new top-level section. Returns a new graph.
 */
export function insertOutlineNode(
  graph: OutlineGraph,
  parentId: string | null,
  node: OutlineNode,
): OutlineGraph {
  const next = clone(graph);
  if (parentId == null) {
    next.roots.push({ ...node, depth: 0 });
  } else {
    const parent = findNode(next, parentId);
    if (parent) parent.children.push({ ...node, depth: parent.depth + 1 });
    else next.roots.push({ ...node, depth: 0 });
  }
  next.stats = {
    ...next.stats,
    nodeCount: next.stats.nodeCount + 1,
    emittedNodeCount: next.stats.emittedNodeCount + 1,
    rootCount: next.roots.length,
    orphanCount: next.orphans.length,
  };
  return next;
}
