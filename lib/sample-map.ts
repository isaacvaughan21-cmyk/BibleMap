import type { Edge, Node } from "@xyflow/react";

/**
 * Hard-coded development layout so /app is never blank while the canvas is
 * being built. Mirrors the Melchizedek arc from the landing-page hero so the
 * app immediately feels like the same product.
 *
 * All verse text is Berean Standard Bible (public domain), verified
 * word-for-word against BibleHub on 2026-06-09. Do not edit verse text
 * without re-verifying.
 */

export type QuestionNodeData = { content: string };
export type VerseNodeData = { verseRef: string; verseText: string };
export type NoteNodeData = { content: string };

export type QuestionNodeType = Node<QuestionNodeData, "question">;
export type VerseNodeType = Node<VerseNodeData, "verse">;
export type NoteNodeType = Node<NoteNodeData, "note">;

export type HodosNode = QuestionNodeType | VerseNodeType | NoteNodeType;

export const SAMPLE_NODES: HodosNode[] = [
  {
    id: "q-melchizedek",
    type: "question",
    position: { x: 360, y: 290 },
    data: { content: "Who is Melchizedek?" },
  },
  {
    id: "v-gen-14-18",
    type: "verse",
    position: { x: 30, y: 40 },
    data: {
      verseRef: "Genesis 14:18",
      verseText:
        "Then Melchizedek king of Salem brought out bread and wine—since he was priest of God Most High—",
    },
  },
  {
    id: "v-psa-110-4",
    type: "verse",
    position: { x: 660, y: 30 },
    data: {
      verseRef: "Psalm 110:4",
      verseText:
        "The LORD has sworn and will not change His mind: “You are a priest forever in the order of Melchizedek.”",
    },
  },
  {
    id: "v-heb-7-3",
    type: "verse",
    position: { x: 700, y: 440 },
    data: {
      verseRef: "Hebrews 7:3",
      verseText:
        "Without father or mother or genealogy, without beginning of days or end of life, like the Son of God, he remains a priest for all time.",
    },
  },
  {
    id: "n-silence",
    type: "note",
    position: { x: 90, y: 480 },
    data: { content: "My take: the silence is intentional." },
  },
];

export const SAMPLE_EDGES: Edge[] = [
  {
    id: "e-q-gen",
    source: "q-melchizedek",
    target: "v-gen-14-18",
    sourceHandle: "s-t",
    targetHandle: "t-b",
    type: "manual",
  },
  {
    id: "e-q-psa",
    source: "q-melchizedek",
    target: "v-psa-110-4",
    sourceHandle: "s-t",
    targetHandle: "t-b",
    type: "manual",
  },
  {
    id: "e-q-note",
    source: "q-melchizedek",
    target: "n-silence",
    sourceHandle: "s-b",
    targetHandle: "t-t",
    type: "manual",
  },
  {
    id: "e-psa-heb",
    source: "v-psa-110-4",
    target: "v-heb-7-3",
    sourceHandle: "s-b",
    targetHandle: "t-t",
    type: "crossref",
  },
];
