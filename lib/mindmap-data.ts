/**
 * Mind-map data for the scroll-driven zoom canvas.
 *
 * This is the ONE file to edit when tweaking node labels or the camera path.
 * Keep all canvas copy here — never hardcode labels inside MindMapCanvas.tsx.
 *
 * Coordinate system: a single shared SVG viewBox of 0 0 1000 1000.
 * Each depth's map is authored AROUND its camera target, so when the root <g>
 * scales up and translates that target to the viewport center, the next depth's
 * map fills the screen — a fractal "falling deeper into the map" effect.
 *
 * Scale jumps ~7x per depth. Camera {x,y} is the point (in viewBox units) that
 * should sit at the center of the viewport for that section.
 */

export type MindMapNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Optional emphasis — the node we zoom INTO becomes the next depth's origin. */
  focus?: boolean;
};

export type MindMapLink = {
  from: string;
  to: string;
};

export type MindMapDepth = {
  /** 0 = hero, 1 = problem, 2 = how, 3 = features, 4 = cta */
  depth: number;
  sectionId: "hero" | "problem" | "how" | "features" | "cta";
  nodes: MindMapNode[];
  links: MindMapLink[];
  /** Camera target in viewBox units + scale applied at this section's peak. */
  camera: { x: number; y: number; scale: number };
};

/**
 * Each depth is laid out in a small local cluster centered on the previous
 * depth's focus node, shrinking geometrically. We keep clusters tight so the
 * zoom reads as "into this node" rather than a pan.
 */
export const MIND_MAP: MindMapDepth[] = [
  // ---------------------------------------------------------------- depth 0
  // Hero — the Melchizedek inquiry. We zoom into "Hebrews 7:1".
  {
    depth: 0,
    sectionId: "hero",
    camera: { x: 500, y: 500, scale: 1 },
    nodes: [
      { id: "who", label: "Who is Melchizedek?", x: 500, y: 430, focus: false },
      { id: "priest", label: "Priest & King", x: 320, y: 330 },
      { id: "psalm110", label: "Psalm 110:4", x: 690, y: 320 },
      { id: "bread", label: "Bread & Wine", x: 250, y: 560 },
      { id: "geneal", label: "Without genealogy", x: 760, y: 540 },
      { id: "gen14", label: "Genesis 14", x: 380, y: 690 },
      { id: "heb7", label: "Hebrews 7:1", x: 610, y: 660, focus: true },
    ],
    links: [
      { from: "who", to: "priest" },
      { from: "who", to: "psalm110" },
      { from: "who", to: "bread" },
      { from: "who", to: "geneal" },
      { from: "who", to: "gen14" },
      { from: "who", to: "heb7" },
      { from: "heb7", to: "gen14" },
      { from: "psalm110", to: "priest" },
    ],
  },

  // ---------------------------------------------------------------- depth 1
  // Problem — nested inside hero's "Hebrews 7:1" (610, 660).
  {
    depth: 1,
    sectionId: "problem",
    camera: { x: 610, y: 660, scale: 7 },
    nodes: [
      { id: "p-name", label: "A name you've seen before", x: 610, y: 636 },
      { id: "p-question", label: "A real question", x: 565, y: 668, focus: true },
      { id: "p-skim", label: "Skim past it", x: 658, y: 652 },
      { id: "p-tabs", label: "A rabbit hole of tabs", x: 642, y: 692 },
      { id: "p-lost", label: "The insight slips away", x: 585, y: 700 },
    ],
    links: [
      { from: "p-name", to: "p-question" },
      { from: "p-question", to: "p-skim" },
      { from: "p-question", to: "p-tabs" },
      { from: "p-skim", to: "p-lost" },
      { from: "p-tabs", to: "p-lost" },
    ],
  },

  // ---------------------------------------------------------------- depth 2
  // How it works — nested inside problem's "A real question" (565, 668).
  {
    depth: 2,
    sectionId: "how",
    camera: { x: 565, y: 668, scale: 49 },
    nodes: [
      { id: "h-capture", label: "01 — Capture", x: 565, y: 661 },
      { id: "h-connect", label: "02 — Connect", x: 572, y: 668, focus: true },
      { id: "h-expand", label: "03 — Expand", x: 560, y: 675 },
      { id: "h-bubble", label: "Drop a bubble", x: 558, y: 655 },
      { id: "h-cross", label: "Cross-references", x: 579, y: 663 },
      { id: "h-web", label: "A living web", x: 567, y: 681 },
    ],
    links: [
      { from: "h-capture", to: "h-connect" },
      { from: "h-connect", to: "h-expand" },
      { from: "h-capture", to: "h-bubble" },
      { from: "h-connect", to: "h-cross" },
      { from: "h-expand", to: "h-web" },
    ],
  },

  // ---------------------------------------------------------------- depth 3
  // Features — nested inside how's "02 — Connect" (572, 668).
  {
    depth: 3,
    sectionId: "features",
    camera: { x: 572, y: 668, scale: 343 },
    nodes: [
      { id: "f-canvas", label: "Infinite canvas", x: 571, y: 667, focus: true },
      { id: "f-cross", label: "Auto cross-refs", x: 573.4, y: 667.2 },
      { id: "f-place", label: "All in one place", x: 571, y: 669.2 },
      { id: "f-compound", label: "A map that compounds", x: 573.2, y: 669 },
    ],
    links: [
      { from: "f-canvas", to: "f-cross" },
      { from: "f-canvas", to: "f-place" },
      { from: "f-cross", to: "f-compound" },
      { from: "f-place", to: "f-compound" },
    ],
  },

  // ---------------------------------------------------------------- depth 4
  // CTA — nested inside features' "Infinite canvas" (571, 667).
  {
    depth: 4,
    sectionId: "cta",
    camera: { x: 571, y: 667, scale: 2401 },
    nodes: [
      { id: "c-go", label: "Go deep", x: 571, y: 667, focus: true },
      { id: "c-path", label: "Walk the path", x: 570.6, y: 667.6 },
      { id: "c-join", label: "Join the waitlist", x: 571.5, y: 667.5 },
    ],
    links: [
      { from: "c-go", to: "c-path" },
      { from: "c-go", to: "c-join" },
    ],
  },
];

/** Convenience: camera keyframes in section order, for useTransform inputs. */
export const CAMERA_KEYFRAMES = MIND_MAP.map((d) => d.camera);

/** Section ids in scroll order. */
export const SECTION_IDS = MIND_MAP.map((d) => d.sectionId);
