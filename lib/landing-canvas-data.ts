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
  /** A verse the visitor can double-click to open into its own map. */
  expandable?: boolean;
  /** Floating affordance copy shown on an expandable bubble ("Double-click me"). */
  cta?: string;
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
      expandable: true,
      cta: "Double-click me",
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

/**
 * Branch maps — the "a whole map inside one bubble" payoff. Double-clicking an
 * expandable verse on the root canvas opens its branch: the verse becomes the
 * hub, surrounded by a fresh cluster of questions, notes, and cross-referenced
 * verses. Keyed by the root node id it opens from.
 *
 * All verse text is Berean Standard Bible, VERBATIM, from public/bible/Heb.json.
 */
export type LandingBranch = {
  /** Heading shown on the back pill ("Hebrews 7:3"). */
  title: string;
  /** The child node that mirrors the opened bubble — held at the same scale
   *  through the dive so the pass-through is seamless (like the app's anchor). */
  anchorId: string;
  nodes: LandingNode[];
  edges: LandingEdge[];
};

export const LANDING_BRANCHES: Record<string, LandingBranch> = {
  v3: {
    title: "Hebrews 7:3",
    anchorId: "v3-hub",
    nodes: [
      {
        id: "v3-hub",
        type: "verse",
        position: { x: 0, y: 0 },
        data: {
          ref: "Hebrews 7:3",
          text: "Without father or mother or genealogy, without beginning of days or end of life, like the Son of God, he remains a priest for all time.",
        },
      },
      {
        id: "v3-q1",
        type: "question",
        position: { x: -360, y: -210 },
        data: { text: "Why is his genealogy deliberately left out?" },
      },
      {
        id: "v3-n1",
        type: "note",
        position: { x: 380, y: -200 },
        data: {
          text: "A priest who simply appears — no beginning, no end on record. The silence is the point.",
        },
      },
      {
        id: "v3-v1",
        type: "verse",
        position: { x: -420, y: 180 },
        data: {
          ref: "Hebrews 7:4",
          text: "Consider how great Melchizedek was: Even the patriarch Abraham gave him a tenth of the plunder.",
        },
      },
      {
        id: "v3-q2",
        type: "question",
        position: { x: 0, y: 320 },
        data: { text: "How is he “greater than Abraham”?" },
      },
      {
        id: "v3-v2",
        type: "verse",
        position: { x: 430, y: 170 },
        data: {
          ref: "Hebrews 7:17",
          text: "For it is testified: “You are a priest forever in the order of Melchizedek.”",
        },
      },
      {
        id: "v3-n2",
        type: "note",
        position: { x: 470, y: 380 },
        data: {
          text: "“Like the Son of God” — the type points forward to a priesthood that never ends.",
        },
      },
    ],
    edges: [
      { id: "v3e1", source: "v3-hub", target: "v3-q1", kind: "manual" },
      { id: "v3e2", source: "v3-hub", target: "v3-n1", kind: "manual" },
      { id: "v3e3", source: "v3-hub", target: "v3-v1", kind: "manual" },
      { id: "v3e4", source: "v3-hub", target: "v3-q2", kind: "manual" },
      { id: "v3e5", source: "v3-hub", target: "v3-v2", kind: "manual" },
      { id: "v3e6", source: "v3-q2", target: "v3-v1", kind: "manual" },
      { id: "v3e7", source: "v3-v2", target: "v3-n2", kind: "manual" },
      { id: "v3e8", source: "v3-v1", target: "v3-v2", kind: "crossref" },
    ],
  },
};
