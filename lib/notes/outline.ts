// lib/notes/outline.ts — pure data, fully serializable, deterministic.
// The rooted forest the AI writes study notes from. Hierarchy comes ONLY from
// the graph: a top-level bubble is a section; bubbles branching out of it are
// nested sub-points (recursively). Crossref edges are lateral references, not
// parent/child. Every input node appears EXACTLY ONCE across roots + orphans.

import type { HodosEdge, HodosNode } from "@/lib/types";

export type OutlineNodeKind =
  | "question"
  | "verse"
  | "note"
  | "definition"
  | "other";

/**
 * The referenced node's verbatim content, denormalized onto the cross-ref so the
 * reading view can render the linked passage inline (grouped under the topic)
 * instead of as a jump link. Leaf only — never its children or its own refs.
 */
export interface OutlineCrossRefTarget {
  kind: OutlineNodeKind;
  title?: string; // verse: canonical ref; definition: the term
  text?: string; // verse: verseText; question/note: content; definition: meaning
  highlights?: string[]; // verse only: reader's marked phrases
}

/** A lateral (non-tree) link from this node to another node, by id. */
export interface OutlineCrossRef {
  /** Target node id — always present in this OutlineGraph. */
  targetId: string;
  /**
   * crossref = scripture cross-reference (usually verse↔verse);
   * manual = a manual edge demoted from a tree edge (cycle back-edge / 2nd parent).
   */
  via: "crossref" | "manual";
  /** Short human label for the target (verse ref or clipped content snippet). */
  targetLabel: string;
  /** The target's content, so the reading view can show it inline. */
  target: OutlineCrossRefTarget;
}

/** One bubble, with its verbatim payload and its children (branches). */
export interface OutlineNode {
  id: string; // uuid v7 of the canvas node — STABLE round-trip key
  kind: OutlineNodeKind;
  rawType: string; // original type string verbatim (e.g. "lexicon")
  // ---- verbatim content (NEVER paraphrased; AI explanation lives elsewhere) ----
  title?: string; // verse: canonical ref; definition: the term; else omitted
  text?: string; // verse: verseText; question/note: content; definition: meaning. Omitted when blank
  highlights?: string[]; // verse only: reader's verbatim marked phrases (deduped, in text order)
  rawRef?: string; // verse only: raw verseRef exactly as stored
  refUnparseable?: boolean; // verse only: true when verseRef could not be parsed
  isEmpty: boolean; // no meaningful content -> model should "flag, don't fill"
  isAnchor: boolean; // id === primaryNodeId
  children: OutlineNode[]; // branches, deterministically ordered (spatial -> kind -> id)
  crossRefs: OutlineCrossRef[]; // lateral links from THIS node
  depth: number; // roots = 0, their branches = 1, …
}

export interface OutlineStats {
  nodeCount: number; // unique input nodes
  emittedNodeCount: number; // MUST equal nodeCount (preservation invariant)
  rootCount: number; // = sections
  orphanCount: number;
  maxDepth: number;
  edgeCount: number; // de-duped directed edges considered
  cyclesBroken: number; // back-edges demoted to crossRefs
  unparseableRefs: string[];
}

export interface OutlineGraph {
  title: string; // store.mapName — the document title
  roots: OutlineNode[]; // top-level sections, ordered
  orphans: OutlineNode[]; // bubbles with NO edges at all -> triage bucket
  stats: OutlineStats;
}

export interface BuildOutlineInput {
  nodes: HodosNode[]; // current map only
  edges: HodosEdge[]; // edges expose .type ("manual" | "crossref")
  mapName: string;
  primaryNodeId: string | null; // lowest node id, the anchor
}
