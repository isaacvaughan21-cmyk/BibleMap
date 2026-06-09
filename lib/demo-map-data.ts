/**
 * Data for the scroll-driven infinite-zoom DEMO section (between Problem and
 * How It Works). Two nested depths:
 *
 *   depth 0  — an outer mind map of verses + comments around the Melchizedek
 *              question. We zoom into the FOCUS node...
 *   depth 1  — ...which "opens" into a whole new map nested inside that one
 *              bubble, demonstrating the endlessly zoomable canvas.
 *
 * Shared SVG viewBox: 0 0 1000 1000. The depth-1 cluster is authored in a tight
 * radius around the focus point so that, once the camera zooms in, it fills the
 * screen — a fractal "a map inside a comment" effect.
 *
 * Edit labels here — never hardcode copy in the component.
 */

export type NodeKind = "verse" | "comment" | "note";

export type DemoNode = {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  focus?: boolean; // the node the camera zooms into
};

export type DemoLink = { from: string; to: string };

/** The bubble the camera dives into. Depth-1 is authored around this point. */
export const FOCUS = { x: 612, y: 548 };

/** Outer map — framed whole at scroll start. */
export const OUTER_NODES: DemoNode[] = [
  { id: "q", label: "Who is Melchizedek?", kind: "comment", x: 470, y: 452 },
  { id: "gen14", label: "Genesis 14:18", kind: "verse", x: 300, y: 360 },
  { id: "psalm110", label: "Psalm 110:4", kind: "verse", x: 690, y: 352 },
  { id: "priest", label: "Priest of God Most High", kind: "comment", x: 250, y: 556 },
  { id: "noline", label: "No genealogy — eternal?", kind: "comment", x: 772, y: 540 },
  { id: "bread", label: "Bread & wine → communion?", kind: "comment", x: 372, y: 672 },
  { id: "heb7", label: "Hebrews 7:1–3", kind: "verse", x: 612, y: 548, focus: true },
  { id: "type", label: "Christ — our high priest", kind: "comment", x: 588, y: 712 },
];

export const OUTER_LINKS: DemoLink[] = [
  { from: "q", to: "gen14" },
  { from: "q", to: "psalm110" },
  { from: "q", to: "priest" },
  { from: "q", to: "noline" },
  { from: "q", to: "bread" },
  { from: "q", to: "heb7" },
  { from: "q", to: "type" },
  { from: "heb7", to: "psalm110" },
  { from: "heb7", to: "gen14" },
  { from: "heb7", to: "type" },
];

/**
 * Inner map — nested inside the "Hebrews 7:1–3" bubble. Authored within ~42
 * units of FOCUS so it scales up to fill the viewport at peak zoom.
 */
export const INNER_NODES: DemoNode[] = [
  { id: "i-hub", label: "Hebrews 7", kind: "verse", x: 612, y: 548 },
  { id: "i-v3", label: "“resembling the Son of God”", kind: "verse", x: 612, y: 522 },
  { id: "i-noparents", label: "Without father or mother", kind: "comment", x: 572, y: 540 },
  { id: "i-forever", label: "A priest forever", kind: "comment", x: 652, y: 538 },
  { id: "i-tithe", label: "Abraham gave him a tenth", kind: "comment", x: 580, y: 572 },
  { id: "i-greater", label: "Greater than Levi", kind: "comment", x: 648, y: 570 },
  { id: "i-mynote", label: "My take: the silence is intentional", kind: "note", x: 612, y: 590 },
];

export const INNER_LINKS: DemoLink[] = [
  { from: "i-hub", to: "i-v3" },
  { from: "i-hub", to: "i-noparents" },
  { from: "i-hub", to: "i-forever" },
  { from: "i-hub", to: "i-tithe" },
  { from: "i-hub", to: "i-greater" },
  { from: "i-v3", to: "i-noparents" },
  { from: "i-v3", to: "i-forever" },
  { from: "i-tithe", to: "i-greater" },
  { from: "i-hub", to: "i-mynote" },
];

/** Peak zoom scale applied at the end of the scroll. */
export const PEAK_SCALE = 9;
