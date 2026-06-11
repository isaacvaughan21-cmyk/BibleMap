/**
 * Data for the live interactive mini-canvas on the landing page.
 * ALL canvas copy lives here (same rule as lib/demo-map-data.ts) — never
 * hardcode labels in the component.
 *
 * Verse text is Berean Standard Bible, VERBATIM, extracted from
 * public/bible/{Gen,Ps,Heb}.json — do not edit by hand without re-verifying.
 */

export type LandingNodeData = {
  text: string;
  ref?: string; // verse reference eyebrow — verse bubbles only
};

export type LandingNode = {
  id: string;
  type: "question" | "verse" | "note";
  position: { x: number; y: number };
  data: LandingNodeData;
};

export type LandingEdge = {
  id: string;
  source: string;
  target: string;
  kind: "manual" | "crossref";
};

export const LANDING_NODES: LandingNode[] = [
  {
    id: "q1",
    type: "question",
    position: { x: 0, y: 0 },
    data: { text: "Who is Melchizedek?" },
  },
  {
    id: "v1",
    type: "verse",
    position: { x: -340, y: 190 },
    data: {
      ref: "Genesis 14:18",
      text: "Then Melchizedek king of Salem brought out bread and wine—since he was priest of God Most High—",
    },
  },
  {
    id: "v2",
    type: "verse",
    position: { x: 340, y: 190 },
    data: {
      ref: "Psalm 110:4",
      text: "The LORD has sworn and will not change His mind: “You are a priest forever in the order of Melchizedek.”",
    },
  },
  {
    id: "v3",
    type: "verse",
    position: { x: 0, y: 400 },
    data: {
      ref: "Hebrews 7:3",
      text: "Without father or mother or genealogy, without beginning of days or end of life, like the Son of God, he remains a priest for all time.",
    },
  },
  {
    id: "n1",
    type: "note",
    position: { x: -390, y: -190 },
    data: {
      text: "My take: the silence about his lineage seems intentional.",
    },
  },
  {
    id: "q2",
    type: "question",
    position: { x: 420, y: -200 },
    data: { text: "What does “a priest forever” mean?" },
  },
  {
    id: "v4",
    type: "verse",
    position: { x: 760, y: 20 },
    data: {
      ref: "Hebrews 7:24",
      text: "But because Jesus lives forever, He has a permanent priesthood.",
    },
  },
  {
    id: "n2",
    type: "note",
    position: { x: -690, y: 30 },
    data: {
      text: "Bread and wine, from a priest-king — hard for me to pass by after years at the Lord’s table.",
    },
  },
];

export const LANDING_EDGES: LandingEdge[] = [
  { id: "e1", source: "q1", target: "v1", kind: "manual" },
  { id: "e2", source: "q1", target: "v3", kind: "manual" },
  { id: "e3", source: "n1", target: "q1", kind: "manual" },
  { id: "e4", source: "q1", target: "q2", kind: "manual" },
  { id: "e5", source: "q2", target: "v2", kind: "manual" },
  { id: "e6", source: "q2", target: "v4", kind: "manual" },
  { id: "e7", source: "v1", target: "n2", kind: "manual" },
  { id: "e8", source: "v1", target: "v2", kind: "crossref" },
  { id: "e9", source: "v2", target: "v3", kind: "crossref" },
];
