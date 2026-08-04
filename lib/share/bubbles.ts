import type { HodosEdge, HodosNode, NodeKind } from "@/lib/types";
import { getHighlighter, type BubbleTheme } from "@/lib/themes";
import {
  alpha,
  drawRunLine,
  drawTracked,
  font,
  INK,
  INK_MUTED,
  INK_SOFT,
  nodePaint,
  roundRect,
  toRuns,
  trackedWidth,
  withBubbleShadow,
  wrapRuns,
  wrapText,
  type Fonts,
} from "./paint";

/**
 * Bubble and connector painters for the share card — the canvas bubbles redrawn
 * in Canvas 2D, at the same metrics the DOM uses so a card keeps the exact
 * composition the reader arranged. Interface furniture (handles, nest badges,
 * lock badges, selection halos, the truncate/expand affordance) is deliberately
 * absent: a card should look like the study, not like the tool.
 */

/**
 * How much of each bubble to set. A sprawling map has to shrink to fit a
 * feed-sized frame, and body copy at 20% is mud — so past a threshold the card
 * switches to `compact`, showing each bubble's headline only. The map then
 * reads as a constellation of passages instead of unreadable grey blocks.
 */
export type Detail = "full" | "compact";

export type BubbleLayout = {
  w: number;
  h: number;
  paint: (ctx: CanvasRenderingContext2D) => void;
};

type Opts = {
  fonts: Fonts;
  theme: BubbleTheme;
  detail: Detail;
  isPrimary: boolean;
};

/* Metrics lifted from the node components' Tailwind classes. */
const SERIF_BASE = 16; // text-base
const SERIF_SM = 14; // text-xs (0.875rem)
const LH_RELAXED = 1.625;
const LH_SNUG = 1.375;
const LH_BASE = 1.6;
const EYEBROW_TRACK = 0.22;
const REF_TRACK = 0.14;

export function layoutBubble(
  ctx: CanvasRenderingContext2D,
  node: HodosNode,
  opts: Opts,
): BubbleLayout {
  switch (node.type) {
    case "question":
      return layoutQuestion(ctx, node.data.content, opts);
    case "verse":
      return layoutVerse(ctx, node.data, opts);
    case "note":
      return layoutNote(ctx, node.data.content, opts);
    default:
      return layoutDefinition(ctx, node.data, opts);
  }
}

/** The anchor bubble's persistent gold glow — the study's starting point. */
function paintPrimaryGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
  accent: string,
): void {
  ctx.save();
  ctx.shadowColor = alpha(accent, 0.3);
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 5;
  ctx.strokeStyle = alpha(accent, 0.55);
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Question — a pill with the gold ?-glyph                             */
/* ------------------------------------------------------------------ */

function layoutQuestion(
  ctx: CanvasRenderingContext2D,
  content: string,
  { fonts, theme, detail, isPrimary }: Opts,
): BubbleLayout {
  const p = nodePaint(theme, "question");
  const textFont = font({ family: fonts.serif, size: SERIF_BASE });
  const glyph = 28;
  const padL = 12;
  const padR = 24;
  const padY = 10;
  const gap = 12;
  const maxText =
    (detail === "compact" ? 260 : 320) - padL - glyph - gap - padR - 2;
  const lh = SERIF_BASE * LH_SNUG;

  ctx.font = textFont;
  const text = content || "A question";
  const lines = wrapText(ctx, text, maxText, detail === "compact" ? 2 : 6);
  const textW = Math.min(
    maxText,
    Math.max(...lines.map((l) => ctx.measureText(l).width)),
  );

  const w = padL + glyph + gap + textW + padR + 2;
  const h = Math.max(glyph, lines.length * lh) + padY * 2 + 2;
  const r = h / 2;

  return {
    w,
    h,
    paint: (c) => {
      if (isPrimary) paintPrimaryGlow(c, w, h, r, p.accent);
      withBubbleShadow(c, () => {
        c.fillStyle = p.surface;
        roundRect(c, 0, 0, w, h, r);
        c.fill();
      });
      c.strokeStyle = p.rule;
      c.lineWidth = 1;
      roundRect(c, 0.5, 0.5, w - 1, h - 1, r);
      c.stroke();

      // ?-glyph in its tinted ring
      const gx = padL + 1 + glyph / 2;
      const gy = h / 2;
      c.beginPath();
      c.arc(gx, gy, glyph / 2, 0, Math.PI * 2);
      c.fillStyle = alpha(p.accent, 0.1);
      c.fill();
      c.strokeStyle = alpha(p.accent, 0.4);
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = p.accent;
      c.font = font({ family: fonts.serif, size: SERIF_SM });
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("?", gx, gy + 0.5);
      c.textAlign = "left";
      c.textBaseline = "alphabetic";

      c.font = textFont;
      c.fillStyle = content ? INK : alpha(INK_MUTED, 0.6);
      const top = (h - lines.length * lh) / 2;
      lines.forEach((line, i) => {
        c.fillText(line, padL + glyph + gap + 1, top + lh * (i + 0.75));
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Verse — gold left rule, tracked reference, serif scripture          */
/* ------------------------------------------------------------------ */

function layoutVerse(
  ctx: CanvasRenderingContext2D,
  data: {
    verseRef: string;
    verseText: string;
    highlights?: string[];
    highlightColors?: Record<string, string>;
  },
  { fonts, theme, detail, isPrimary }: Opts,
): BubbleLayout {
  const p = nodePaint(theme, "verse");
  const padX = 16;
  const padY = 12;
  const leftRule = 3;
  const refSize = 12;
  const refLh = refSize * 1.4;
  const bodyLh = SERIF_SM * LH_RELAXED;

  const ref = (data.verseRef || "Choose a verse").toUpperCase();
  const showBody = detail === "full" && !!data.verseText;

  // Compact bubbles shrink to their reference, so a big map reads as a
  // constellation of passages instead of a wall of unreadable body copy.
  ctx.font = font({ family: fonts.mono, size: refSize, weight: 500 });
  const w = showBody
    ? 256
    : Math.min(
        256,
        Math.max(
          130,
          leftRule + padX * 2 + 1 + trackedWidth(ctx, ref, refSize * REF_TRACK),
        ),
      );
  const inner = w - leftRule - 1 - padX * 2;

  ctx.font = font({ family: fonts.serif, size: SERIF_SM });
  const runs = showBody
    ? toRuns(
        data.verseText,
        data.highlights,
        data.highlightColors,
        (id) => getHighlighter(id)?.color ?? theme.highlight,
      )
    : [];
  const lines = showBody ? wrapRuns(ctx, runs, inner, 24) : [];

  const h =
    padY * 2 + 2 + refLh + (lines.length ? 6 + lines.length * bodyLh : 0);

  return {
    w,
    h,
    paint: (c) => {
      if (isPrimary) paintPrimaryGlow(c, w, h, 12, p.accent);
      withBubbleShadow(c, () => {
        c.fillStyle = p.surface;
        roundRect(c, 0, 0, w, h, 12);
        c.fill();
      });
      c.strokeStyle = p.rule;
      c.lineWidth = 1;
      roundRect(c, 0.5, 0.5, w - 1, h - 1, 12);
      c.stroke();

      // The signature gold left rule, clipped to the bubble's rounded corner.
      c.save();
      roundRect(c, 0, 0, w, h, 12);
      c.clip();
      c.fillStyle = p.accent;
      c.fillRect(0, 0, leftRule, h);
      c.restore();

      const x = leftRule + padX;
      c.font = font({ family: fonts.mono, size: refSize, weight: 500 });
      c.fillStyle = data.verseRef ? p.accent : alpha(p.accent, 0.5);
      drawTracked(c, ref, x, padY + refLh * 0.75, refSize * REF_TRACK);

      if (!lines.length) return;
      c.font = font({ family: fonts.serif, size: SERIF_SM });
      const top = padY + refLh + 6;
      lines.forEach((line, i) => {
        drawRunLine(c, line, x, top + bodyLh * (i + 0.75), SERIF_SM, INK_SOFT);
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Note — borderless, quieter, italic                                  */
/* ------------------------------------------------------------------ */

function layoutNote(
  ctx: CanvasRenderingContext2D,
  content: string,
  { fonts, theme, detail, isPrimary }: Opts,
): BubbleLayout {
  const p = nodePaint(theme, "note");
  const padX = 16;
  const padY = 12;
  const maxInner = (detail === "compact" ? 200 : 240) - padX * 2 - 2;
  const lh = SERIF_SM * LH_RELAXED;

  ctx.font = font({ family: fonts.serif, size: SERIF_SM, italic: true });
  const lines = wrapText(
    ctx,
    content || "A thought of your own",
    maxInner,
    detail === "compact" ? 2 : 12,
  );
  const textW = Math.min(
    maxInner,
    Math.max(...lines.map((l) => ctx.measureText(l).width)),
  );
  const w = textW + padX * 2 + 2;
  const h = lines.length * lh + padY * 2 + 2;

  return {
    w,
    h,
    paint: (c) => {
      if (isPrimary) paintPrimaryGlow(c, w, h, 12, p.accent);
      withBubbleShadow(c, () => {
        // Notes sit on the alternate surface with no border — the quiet voice.
        c.fillStyle = theme.byType ? p.surface : "#efe9dc";
        roundRect(c, 0, 0, w, h, 12);
        c.fill();
      });
      c.font = font({ family: fonts.serif, size: SERIF_SM, italic: true });
      c.fillStyle = content ? INK_SOFT : alpha(INK_MUTED, 0.6);
      lines.forEach((line, i) => {
        c.fillText(line, padX + 1, padY + lh * (i + 0.75));
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Definition — ink left rule, eyebrow label, the word, its meaning    */
/* ------------------------------------------------------------------ */

function layoutDefinition(
  ctx: CanvasRenderingContext2D,
  data: { content: string; definition?: string },
  { fonts, theme, detail, isPrimary }: Opts,
): BubbleLayout {
  const p = nodePaint(theme, "definition");
  const padX = 16;
  const padY = 12;
  const leftRule = 3;
  const labelSize = 12;
  const labelLh = labelSize * 1.4;
  const wordLh = SERIF_BASE * LH_BASE;
  const defLh = SERIF_SM * LH_RELAXED;
  // In by-type themes the left rule takes the type accent; classic keeps ink.
  const ruleColor = theme.byType ? p.accent : INK_SOFT;

  const full = detail === "full" && !!data.definition;
  let w = 240;
  if (!full) {
    // Headline only — the eyebrow and the word set the width.
    ctx.font = font({ family: fonts.sans, size: labelSize });
    const labelW = trackedWidth(ctx, "DEFINITION", labelSize * EYEBROW_TRACK);
    ctx.font = font({ family: fonts.serif, size: SERIF_BASE, weight: 500 });
    const wordW = ctx.measureText(data.content || "A word…").width;
    w = Math.min(
      240,
      Math.max(120, leftRule + padX * 2 + 1 + Math.max(labelW, wordW)),
    );
  }
  const inner = w - leftRule - 1 - padX * 2;

  ctx.font = font({ family: fonts.serif, size: SERIF_SM });
  const defLines = full ? wrapText(ctx, data.definition ?? "", inner, 8) : [];

  const h =
    padY * 2 +
    2 +
    labelLh +
    4 +
    wordLh +
    (defLines.length ? 6 + defLines.length * defLh : 0);

  return {
    w,
    h,
    paint: (c) => {
      if (isPrimary) paintPrimaryGlow(c, w, h, 12, p.accent);
      withBubbleShadow(c, () => {
        c.fillStyle = p.surface;
        roundRect(c, 0, 0, w, h, 12);
        c.fill();
      });
      c.strokeStyle = p.rule;
      c.lineWidth = 1;
      roundRect(c, 0.5, 0.5, w - 1, h - 1, 12);
      c.stroke();

      c.save();
      roundRect(c, 0, 0, w, h, 12);
      c.clip();
      c.fillStyle = ruleColor;
      c.fillRect(0, 0, leftRule, h);
      c.restore();

      const x = leftRule + padX;
      c.font = font({ family: fonts.sans, size: labelSize });
      c.fillStyle = INK_MUTED;
      drawTracked(
        c,
        "DEFINITION",
        x,
        padY + labelLh * 0.75,
        labelSize * EYEBROW_TRACK,
      );

      c.font = font({ family: fonts.serif, size: SERIF_BASE, weight: 500 });
      c.fillStyle = data.content ? INK : alpha(INK_MUTED, 0.6);
      c.fillText(
        data.content || "A word…",
        x,
        padY + labelLh + 4 + wordLh * 0.75,
      );

      if (!defLines.length) return;
      c.font = font({ family: fonts.serif, size: SERIF_SM });
      c.fillStyle = INK_SOFT;
      const top = padY + labelLh + 4 + wordLh + 6;
      defLines.forEach((line, i) => {
        c.fillText(line, x, top + defLh * (i + 0.75));
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Connectors                                                          */
/* ------------------------------------------------------------------ */

export type Rect = { x: number; y: number; w: number; h: number };

type Side = "top" | "right" | "bottom" | "left";
const NORMAL: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** The straight run into the arrowhead — mirrors ARROW_RUN in edge-routing. */
const ARROW_RUN = 16;
const ARROW_LEN = 11.2; // marker geometry from edges/EdgeMarkers.tsx
const ARROW_HALF = 5.6;

function anchor(r: Rect, side: Side): { x: number; y: number } {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (side) {
    case "top":
      return { x: cx, y: r.y };
    case "bottom":
      return { x: cx, y: r.y + r.h };
    case "left":
      return { x: r.x, y: cy };
    default:
      return { x: r.x + r.w, y: cy };
  }
}

/**
 * The floating-edge curve, reproduced from lib/edge-routing.ts: each end
 * attaches to the side nearest the other bubble and leaves along that side's
 * outward normal, with a short straight run so the arrow lands square.
 */
export function paintEdge(
  ctx: CanvasRenderingContext2D,
  source: Rect,
  target: Rect,
  kind: string,
  theme: BubbleTheme,
): void {
  const scx = source.x + source.w / 2;
  const scy = source.y + source.h / 2;
  const tcx = target.x + target.w / 2;
  const tcy = target.y + target.h / 2;
  const dx = tcx - scx;
  const dy = tcy - scy;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const sSide: Side = horizontal
    ? dx > 0
      ? "right"
      : "left"
    : dy > 0
      ? "bottom"
      : "top";
  const tSide: Side = horizontal
    ? dx > 0
      ? "left"
      : "right"
    : dy > 0
      ? "top"
      : "bottom";

  const s = anchor(source, sSide);
  const t = anchor(target, tSide);
  const sn = NORMAL[sSide];
  const tn = NORMAL[tSide];
  const dist = Math.hypot(t.x - s.x, t.y - s.y) || 1;
  const bow = Math.min(Math.max(dist * 0.4, 30), 140);
  const ex = t.x + tn.x * ARROW_RUN;
  const ey = t.y + tn.y * ARROW_RUN;

  const crossref = kind === "crossref";
  const color = crossref ? theme.edge.accent : theme.edge.line;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  if (crossref) {
    ctx.setLineDash([7, 5]);
    ctx.globalAlpha = 0.95;
  }
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.bezierCurveTo(
    s.x + sn.x * bow,
    s.y + sn.y * bow,
    ex + tn.x * bow,
    ey + tn.y * bow,
    ex,
    ey,
  );
  ctx.lineTo(t.x, t.y);
  ctx.stroke();
  ctx.restore();

  // Arrowhead — tip on the bubble's side, running in along the normal.
  const dirX = -tn.x;
  const dirY = -tn.y;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = crossref ? 0.95 : 1;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(
    t.x - dirX * ARROW_LEN - dirY * ARROW_HALF,
    t.y - dirY * ARROW_LEN + dirX * ARROW_HALF,
  );
  ctx.lineTo(
    t.x - dirX * ARROW_LEN + dirY * ARROW_HALF,
    t.y - dirY * ARROW_LEN - dirX * ARROW_HALF,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bubbles a share card should skip — empty placeholders add nothing. */
export function isRenderable(node: HodosNode): boolean {
  switch (node.type) {
    case "verse":
      return !!node.data.verseRef;
    case "question":
    case "note":
      return !!node.data.content.trim();
    default:
      return !!node.data.content.trim();
  }
}

/** Passage references on a map, in placement order — used for the caption. */
export function verseRefs(nodes: HodosNode[]): string[] {
  const refs = nodes
    .filter((n) => n.type === "verse" && n.data.verseRef)
    .map((n) => (n as { data: { verseRef: string } }).data.verseRef);
  return [...new Set(refs)];
}

export function countKinds(nodes: HodosNode[]): Record<NodeKind, number> {
  const counts: Record<NodeKind, number> = {
    question: 0,
    verse: 0,
    note: 0,
    definition: 0,
  };
  for (const n of nodes) counts[n.type as NodeKind] += 1;
  return counts;
}

/** Bubbles joined to `id` by any connection, in either direction. */
export function neighbours(
  id: string,
  nodes: HodosNode[],
  edges: HodosEdge[],
): HodosNode[] {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.source === id) ids.add(e.target);
    else if (e.target === id) ids.add(e.source);
  }
  return nodes.filter((n) => ids.has(n.id));
}

export { trackedWidth };
