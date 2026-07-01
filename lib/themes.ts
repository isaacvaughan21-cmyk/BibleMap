import type { CSSProperties } from "react";
import type { NodeKind } from "@/lib/types";

/**
 * Bubble colour themes.
 *
 * By default every bubble shares the parchment/gold look ("Classic"). A theme
 * with `byType: true` instead gives each bubble type its own colour. The trick
 * (see app/globals.css) is that nodes never hard-code hex — they reference the
 * brand tokens (`--gold`, `--parchment`…). A theme drops the `--btype-*` and
 * `--bubble-highlight*` custom properties on the canvas wrapper, and the CSS
 * remaps each node type's tokens to its slice of the palette, so every existing
 * gold/parchment reference inside that bubble retints automatically.
 *
 * Each theme also carries a coordinated verse-highlight colour, so marking a
 * phrase always matches the chosen palette.
 */

export type TypePalette = {
  /** Bubble surface (remaps --parchment / --parchment-2 for this type). */
  surface: string;
  /** Accent: borders, the verse reference, the question glyph, the halo. */
  accent: string;
};

/**
 * Connector colours for the lines/arrows between bubbles. Edges render in their
 * own SVG layer (outside the nodes), so they never pick up a node's themed
 * tokens — they need their own theme-coordinated colours, chosen to contrast
 * with the canvas background so the arrows stay clearly visible on every theme.
 */
export type EdgePalette = {
  /** Standard hand-drawn connection — calm, but with clear contrast. */
  line: string;
  /** Cross-references + the hover/selected state — the signature accent. */
  accent: string;
};

/** Canvas backdrop that coordinates with a theme's bubble palette. */
export type ThemeBackground = {
  /** The flat canvas colour. */
  base: string;
  /** The slightly deeper tone the vignette + minimap fade toward. */
  edge: string;
  /** The dot-grid colour. */
  dots: string;
};

export type BubbleTheme = {
  id: string;
  name: string;
  /** A one-line description shown under the picker. */
  blurb: string;
  /** false = the uniform parchment/gold look; true = colour each type. */
  byType: boolean;
  types: Record<NodeKind, TypePalette>;
  /** The coordinated canvas backdrop. */
  background: ThemeBackground;
  /** The coordinated connector (line + arrow) colours. */
  edge: EdgePalette;
  /** Verse highlight background and its stronger hover/print variant. */
  highlight: string;
  highlightStrong: string;
};

export const DEFAULT_THEME = "classic";

const TYPES: NodeKind[] = ["question", "verse", "note", "definition"];

/** Classic gold accent on parchment — the historical look. */
const GOLD: TypePalette = { surface: "#f4efe6", accent: "#b98a3a" };

export const BUBBLE_THEMES: BubbleTheme[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "The original — parchment and gold for every bubble.",
    byType: false,
    types: {
      question: GOLD,
      verse: GOLD,
      note: { surface: "#efe9dc", accent: "#b98a3a" },
      definition: GOLD,
    },
    background: { base: "#f4efe6", edge: "#efe9dc", dots: "#e4ddcb" },
    edge: { line: "#8a774d", accent: "#a0732a" },
    highlight: "#d9b871",
    highlightStrong: "#c79a4a",
  },
  {
    id: "pastel",
    name: "Pastel",
    blurb: "Soft, easy on the eyes — a colour for each type.",
    byType: true,
    types: {
      question: { surface: "#d9e8f6", accent: "#4f83b8" },
      verse: { surface: "#f9e0cf", accent: "#cf7c4f" },
      note: { surface: "#d9eedc", accent: "#559668" },
      definition: { surface: "#eaddf4", accent: "#8763b3" },
    },
    background: { base: "#e8e8ec", edge: "#dfdfe4", dots: "#cdcdd5" },
    edge: { line: "#6e7484", accent: "#4f78b0" },
    highlight: "#f7df8c",
    highlightStrong: "#efcd60",
  },
  {
    id: "meadow",
    name: "Meadow",
    blurb: "Fresh greens and warm wheat.",
    byType: true,
    types: {
      question: { surface: "#d9ebdc", accent: "#3c875a" },
      verse: { surface: "#f4ead0", accent: "#a5762a" },
      note: { surface: "#e9f0cf", accent: "#6d8d33" },
      definition: { surface: "#daece5", accent: "#3c7b6a" },
    },
    background: { base: "#e3e8d3", edge: "#d9e0c6", dots: "#c7d1ad" },
    edge: { line: "#6c7a4f", accent: "#3c875a" },
    highlight: "#cde79a",
    highlightStrong: "#b4d873",
  },
  {
    id: "ocean",
    name: "Ocean",
    blurb: "Cool blues, teal and slate.",
    byType: true,
    types: {
      question: { surface: "#d3e5f6", accent: "#2c659d" },
      verse: { surface: "#d0ecea", accent: "#1c7d7d" },
      note: { surface: "#dae5ee", accent: "#476a86" },
      definition: { surface: "#dee1f4", accent: "#565cab" },
    },
    background: { base: "#d9e2ef", edge: "#ccd8e9", dots: "#b8c8de" },
    edge: { line: "#567790", accent: "#1f6f8b" },
    highlight: "#a6dcd7",
    highlightStrong: "#80ccc5",
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "Warm coral, amber, rose and plum.",
    byType: true,
    types: {
      question: { surface: "#fbe0d4", accent: "#cb5d40" },
      verse: { surface: "#fbe6c6", accent: "#bf8330" },
      note: { surface: "#fbdde4", accent: "#c05d79" },
      definition: { surface: "#f2dcef", accent: "#965290" },
    },
    background: { base: "#f2e2d3", edge: "#ebd5c2", dots: "#e3c4ab" },
    edge: { line: "#9e6549", accent: "#be5235" },
    highlight: "#f8c886",
    highlightStrong: "#f2b162",
  },
  {
    id: "berry",
    name: "Berry",
    blurb: "Muted jewel tones — plum, wine and teal.",
    byType: true,
    types: {
      question: { surface: "#e8daee", accent: "#7c4789" },
      verse: { surface: "#f0d9df", accent: "#9b3d56" },
      note: { surface: "#d3ebe6", accent: "#2d8378" },
      definition: { surface: "#dde0f1", accent: "#4b58a5" },
    },
    background: { base: "#e7e0eb", edge: "#ddd3e3", dots: "#ccbed5" },
    edge: { line: "#736884", accent: "#7c4789" },
    highlight: "#e6b1d9",
    highlightStrong: "#d795c8",
  },
];

/**
 * Highlighter pens for verse phrases — a fixed palette the reader picks from
 * when marking text (stored per phrase in `highlightColors`). A phrase with no
 * entry falls back to the active theme's coordinated highlight colour.
 */
export type Highlighter = {
  id: string;
  name: string;
  /** Mark background. */
  color: string;
  /** Slightly deeper variant for hover. */
  strong: string;
};

export const HIGHLIGHTERS: Highlighter[] = [
  { id: "lemon", name: "Lemon", color: "#f6e06a", strong: "#eed24a" },
  { id: "lime", name: "Lime", color: "#c2e389", strong: "#abd866" },
  { id: "sky", name: "Sky", color: "#9fd2ee", strong: "#7cc1e6" },
  { id: "rose", name: "Rose", color: "#f3afbe", strong: "#ed94a7" },
  { id: "violet", name: "Violet", color: "#cdb6ea", strong: "#bb9fe1" },
  { id: "tangerine", name: "Tangerine", color: "#f8c489", strong: "#f3ad63" },
];

export function getHighlighter(
  id: string | undefined,
): Highlighter | undefined {
  return id ? HIGHLIGHTERS.find((h) => h.id === id) : undefined;
}

export function getTheme(id: string | undefined): BubbleTheme {
  return BUBBLE_THEMES.find((t) => t.id === id) ?? BUBBLE_THEMES[0];
}

/**
 * The CSS custom properties a theme drops on the canvas wrapper. Consumed by
 * the `[data-bubble-colors="type"]` rules and `mark.verse-mark` in globals.css.
 */
export function themeStyle(theme: BubbleTheme): CSSProperties {
  const vars: Record<string, string> = {
    "--bubble-highlight": theme.highlight,
    "--bubble-highlight-strong": theme.highlightStrong,
    "--canvas-bg": theme.background.base,
    "--canvas-bg-2": theme.background.edge,
    "--canvas-dots": theme.background.dots,
    "--edge-line": theme.edge.line,
    "--edge-accent": theme.edge.accent,
  };
  for (const t of TYPES) {
    vars[`--btype-${t}-surface`] = theme.types[t].surface;
    vars[`--btype-${t}-accent`] = theme.types[t].accent;
  }
  return vars as CSSProperties;
}
