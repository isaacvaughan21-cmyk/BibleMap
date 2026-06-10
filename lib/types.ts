import type { Edge, Node } from "@xyflow/react";

/** Bubble + connection types shared across the canvas, store, and database. */

export type NodeKind = "question" | "verse" | "note";
export type EdgeKind = "manual" | "crossref";

export type QuestionNodeData = { content: string };
export type VerseNodeData = { verseRef: string; verseText: string };
export type NoteNodeData = { content: string };

export type QuestionNodeType = Node<QuestionNodeData, "question">;
export type VerseNodeType = Node<VerseNodeData, "verse">;
export type NoteNodeType = Node<NoteNodeData, "note">;

export type HodosNode = QuestionNodeType | VerseNodeType | NoteNodeType;
export type HodosEdge = Edge;
