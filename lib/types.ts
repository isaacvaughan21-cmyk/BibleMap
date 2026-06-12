import type { Edge, Node } from "@xyflow/react";

/** Bubble + connection types shared across the canvas, store, and database. */

export type NodeKind = "question" | "verse" | "note" | "definition";
export type EdgeKind = "manual" | "crossref";

export type QuestionNodeData = { content: string };
export type VerseNodeData = { verseRef: string; verseText: string };
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
