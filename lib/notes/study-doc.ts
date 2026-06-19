// =============================================================================
// lib/notes/study-doc.ts — the intermediate document model for "Compile to
// notes". Pure data, zero rendering concerns, fully serializable, deterministic.
// A renderer walks a StudyDoc top to bottom. No React, no DOM, no Bible I/O at
// runtime (verseText/highlights/definition are already denormalized on nodes).
// =============================================================================

import type { HodosEdge, HodosNode } from "@/lib/types";

/** An inline run of verse text. `mark` runs are verbatim reader highlights. */
export interface TextRun {
  text: string;
  /** true => render wrapped in <mark class="verse-mark"> (emphasis). */
  mark: boolean;
}

/** A "see also" / "also relates to" pointer from one section to another node. */
export interface CrossRef {
  /** Display label: a verse's canonical ref, else its raw verseRef. */
  label: string;
  /** Target node id — lets the renderer deep-link to that section. */
  targetNodeId: string;
  /** crossref = scripture cross-reference; manual = a freeform user link. */
  via: "crossref" | "manual";
  /** True when the target ref string could not be parsed (render plainly). */
  unparseable: boolean;
}

/** Kinds an attached / themed / orphan block can take. */
export type BlockKind = "question" | "note" | "definition" | "other";

/** A non-verse bubble nested under a passage, or listed in a themed/orphan group. */
export interface AttachedBlock {
  kind: BlockKind;
  nodeId: string;
  /** Label before the block: "Question" | "Note" | "Definition" | Title-cased raw type. */
  label: string;
  /** definition only: the term/word being defined. Undefined otherwise. */
  term?: string;
  /**
   * Body text. question/note: content. definition: the looked-up meaning, or
   * "" if absent. other/unknown: best-effort string. Never trimmed to drop
   * meaningful inner whitespace; an all-whitespace value becomes "".
   */
  body: string;
  /** True when this node is the study anchor (id === primaryNodeId). */
  isAnchor: boolean;
  /** Empty-content bubbles are preserved but flagged so the view shows a placeholder. */
  isEmpty: boolean;
  /**
   * For a bubble linked to MORE THAN ONE verse: the OTHER verse(s) it relates
   * to (i.e. not the one it is nested under). Empty for the common single-link
   * case. Lets a deliberate multi-verse comparison survive without duplication.
   */
  alsoRelatesTo: CrossRef[];
}

/** One verse section — a vertebra of the spine. */
export interface VerseSection {
  type: "verse";
  nodeId: string;
  /** Canonical display ref ("James 2:17", "Hebrews 7:1–3"); raw verseRef if unparseable; "Untitled verse" if blank. */
  ref: string;
  /** Raw reference exactly as stored (never lost). */
  rawRef: string;
  /** True when verseRef could not be parsed (sorts to the spine tail). */
  unparseable: boolean;
  /** Verse text split into mark/plain runs. Empty array when verseText is blank. */
  runs: TextRun[];
  /** True iff nodeId === primaryNodeId (the study anchor — gets lead emphasis). */
  isAnchor: boolean;
  /** Non-verse bubbles owned by this verse, ordered (see ordering rules). */
  attached: AttachedBlock[];
  /** verse->verse crossref neighbours, ordered canonically, de-duped by target. */
  seeAlso: CrossRef[];
}

/**
 * A trailing themed section: one connected component of non-verse bubbles that
 * contains NO verse anywhere. One section per verse-less multi-node component.
 */
export interface ThemedSection {
  type: "themed";
  /** Deterministic id = lexicographically lowest member node id. */
  groupId: string;
  /** Generated heading from the lead block, e.g. the first question's content. */
  heading: string;
  /** True iff this component contains the anchor node. */
  isAnchor: boolean;
  blocks: AttachedBlock[];
}

/** Orphans: non-verse bubbles with no real edges. Collected at the very end. */
export interface OrphanSection {
  type: "orphans";
  /** Always "Loose notes". */
  heading: string;
  blocks: AttachedBlock[];
}

export type DocSection = VerseSection | ThemedSection | OrphanSection;

export interface StudyDocStats {
  /** Unique input node count. */
  nodeCount: number;
  /** Nodes emitted into the document — MUST equal nodeCount (preservation invariant). */
  emittedNodeCount: number;
  verseCount: number;
  themedSectionCount: number;
  orphanCount: number;
  /** De-duped undirected edge pairs used. */
  edgeCount: number;
  /** verseRefs that failed to parse (still rendered, just sorted to the tail). */
  unparseableRefs: string[];
}

export interface StudyDoc {
  /** Map name (store.mapName) used as the document <h1>. Never affects ordering. */
  title: string;
  /** Fixed emission order: verse sections (canonical), themed, then one orphan section. */
  sections: DocSection[];
  /** Diagnostics for the view + tests; never affects rendering correctness. */
  stats: StudyDocStats;
}

/** Inputs = the in-memory store arrays for ONE map, plus context. */
export interface CompileInput {
  /** From useCanvasStore().nodes (current map only). */
  nodes: HodosNode[];
  /** From useCanvasStore().edges — edges expose `.type` ("manual" | "crossref"). */
  edges: HodosEdge[];
  /** store.mapName. */
  mapName: string;
  /** Lowest id across all nodes (the study anchor), or null on an empty map. */
  primaryNodeId: string | null;
}
