import type { Edge, Node } from "@xyflow/react";

/** Bubble + connection types shared across the canvas, store, and database. */

export type NodeKind = "question" | "verse" | "note" | "definition";
export type EdgeKind = "manual" | "crossref";

export type QuestionNodeData = { content: string };
/** highlights = verbatim phrases within verseText the reader marked. */
export type VerseNodeData = {
  verseRef: string;
  verseText: string;
  highlights?: string[];
  /**
   * Per-phrase highlighter colour, keyed by the phrase. The value is a
   * highlighter id (see HIGHLIGHTERS in lib/themes.ts). A phrase missing here
   * falls back to the active theme's coordinated highlight colour.
   */
  highlightColors?: Record<string, string>;
};
export type NoteNodeData = { content: string };
/** content = the word; definition = the looked-up meaning (denormalized). */
export type DefinitionNodeData = { content: string; definition?: string };

export type QuestionNodeType = Node<QuestionNodeData, "question">;
export type VerseNodeType = Node<VerseNodeData, "verse">;
export type NoteNodeType = Node<NoteNodeData, "note">;
export type DefinitionNodeType = Node<DefinitionNodeData, "definition">;

export type HodosNode =
  | QuestionNodeType
  | VerseNodeType
  | NoteNodeType
  | DefinitionNodeType;
export type HodosEdge = Edge;
