import type { NodeKind } from "@/lib/types";
import type { BubbleTheme } from "@/lib/themes";

/**
 * Canvas 2D painting primitives for the share card.
 *
 * The card is *composed*, not screenshotted. Rasterizing the live DOM would
 * carry the chrome (handles, badges, halos), bake in whatever zoom the reader
 * happened to be at, and blur at export size. Redrawing from the map data
 * instead means the card is sharp at any output resolution, always framed
 * deliberately, and free to be typeset rather than merely captured.
 *
 * Everything here works in CSS pixels of the *scene*; the composition applies
 * a single transform, so type stays crisp because it's rasterized once at the
 * final size.
 */

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** Ink tokens are constant across themes (only bubble surfaces retint). */
export const INK = "#16202b";
export const INK_SOFT = "#2c3744";
export const INK_MUTED = "#5b6675";

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** `amount` of `a` blended into `b` — the sRGB equivalent of CSS color-mix. */
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const t = Math.min(1, Math.max(0, amount));
  const c = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

/** A hex colour at a given alpha. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** The bubble palette for one node type, mirroring the CSS in globals.css. */
export type NodePaint = {
  surface: string;
  accent: string;
  rule: string;
  accentSoft: string;
};

export function nodePaint(theme: BubbleTheme, kind: NodeKind): NodePaint {
  const p = theme.types[kind];
  return theme.byType
    ? {
        surface: p.surface,
        accent: p.accent,
        // Same remap the `[data-bubble-colors="type"]` rules perform.
        accentSoft: mix(p.accent, "#ffffff", 0.42),
        rule: mix(p.accent, p.surface, 0.3),
      }
    : {
        surface: p.surface,
        accent: p.accent,
        accentSoft: "#d9b871",
        rule: "#e4ddcb",
      };
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** roundRect with an arcTo fallback for older Safari. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** The bubble's soft drop shadow — set before a fill, cleared after. */
export function withBubbleShadow(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
): void {
  ctx.save();
  ctx.shadowColor = alpha(INK, 0.08);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  draw();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

export type Fonts = { serif: string; sans: string; mono: string };

/**
 * The app's fonts are loaded by next/font, which mints a hashed family name
 * (`__Fraunces_abc123`) and hands it to CSS through a custom property. Canvas
 * takes a plain family list, so read the property back off the document — that
 * way the card is set in the same faces as the canvas, with no second load.
 */
export function resolveFonts(): Fonts {
  const cs =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement)
      : null;
  const fraunces = cs?.getPropertyValue("--font-fraunces").trim();
  const inter = cs?.getPropertyValue("--font-inter").trim();
  return {
    serif: [fraunces, '"Cormorant Garamond"', "Georgia", "serif"]
      .filter(Boolean)
      .join(", "),
    sans: [inter, "system-ui", "sans-serif"].filter(Boolean).join(", "),
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  };
}

export type FontSpec = {
  family: string;
  size: number;
  weight?: number | string;
  italic?: boolean;
};

export function font(spec: FontSpec): string {
  return `${spec.italic ? "italic " : ""}${spec.weight ?? 400} ${spec.size}px ${spec.family}`;
}

/**
 * Greedy word wrap. `maxLines` truncates with an ellipsis rather than letting
 * a long note push the composition off the card.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Infinity,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  const lines = out.filter((l, i) => l !== "" || i === 0);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[kept.length - 1] = ellipsize(ctx, kept[kept.length - 1], maxWidth);
  return kept;
}

/**
 * Wrap a separated list, keeping each item whole. Plain word wrap would break
 * "1 Corinthians 13:10" across two lines, which reads as two references.
 * Returns the lines plus how many items actually fit.
 */
export function wrapJoined(
  ctx: CanvasRenderingContext2D,
  items: string[],
  separator: string,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; used: number } {
  const lines: string[] = [];
  let line = "";
  let used = 0;
  for (const item of items) {
    const next = line ? `${line}${separator}${item}` : item;
    if (line && ctx.measureText(next).width > maxWidth) {
      if (lines.length + 1 >= maxLines) break;
      lines.push(line);
      line = item;
    } else {
      line = next;
    }
    used += 1;
  }
  if (line) lines.push(line);
  return { lines, used };
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
): string {
  let s = line;
  while (s && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/**
 * Letter-spaced text. `ctx.letterSpacing` is still uneven across browsers, and
 * the eyebrows and verse references lean hard on tracking, so they're drawn a
 * glyph at a time instead.
 */
export function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return Math.max(0, w - tracking);
}

export function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "center" = "left",
): void {
  const total = trackedWidth(ctx, text, tracking);
  let cursor = align === "center" ? x - total / 2 : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prev;
}

/* ------------------------------------------------------------------ */
/* Highlighted runs                                                    */
/* ------------------------------------------------------------------ */

/** `dim` sets a run in the muted ink — used for the translation marker. */
export type TextRun = { text: string; mark?: string; dim?: boolean };
type Token = { text: string; mark?: string; dim?: boolean; space: boolean };
export type Seg = {
  text: string;
  mark?: string;
  dim?: boolean;
  x: number;
  w: number;
};
export type WrappedLine = { segs: Seg[]; width: number };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split verse text into plain and highlighted runs. Same longest-phrase-first
 * rule the bubble uses, so a card shows exactly the marks the reader made.
 */
export function toRuns(
  text: string,
  highlights: string[] | undefined,
  colors: Record<string, string> | undefined,
  penColor: (id: string | undefined) => string,
): TextRun[] {
  const phrases = [...new Set(highlights ?? [])].filter((p) =>
    text.includes(p),
  );
  if (!phrases.length) return [{ text }];
  const re = new RegExp(
    `(${phrases
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})`,
    "g",
  );
  return text
    .split(re)
    .filter(Boolean)
    .map((part) =>
      phrases.includes(part)
        ? { text: part, mark: penColor(colors?.[part]) }
        : { text: part },
    );
}

/** Wrap styled runs, keeping each highlight's colour attached to its words. */
export function wrapRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  maxWidth: number,
  maxLines = Infinity,
): WrappedLine[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      tokens.push({
        text: piece,
        mark: run.mark,
        dim: run.dim,
        space: /^\s+$/.test(piece),
      });
    }
  }

  const lines: Token[][] = [];
  let line: Token[] = [];
  let width = 0;
  for (const token of tokens) {
    const w = ctx.measureText(token.text).width;
    if (line.length && width + w > maxWidth && !token.space) {
      lines.push(line);
      line = [token];
      width = w;
    } else if (!line.length && token.space) {
      continue; // never open a line with a space
    } else {
      line.push(token);
      width += w;
    }
  }
  if (line.length) lines.push(line);

  const clipped = lines.slice(0, maxLines);
  return clipped.map((toks) => {
    // Merge neighbouring tokens that share a mark so one highlight paints as a
    // single rounded band rather than a row of touching rectangles.
    const segs: Seg[] = [];
    let x = 0;
    for (const t of toks) {
      const last = segs[segs.length - 1];
      const w = ctx.measureText(t.text).width;
      if (last && last.mark === t.mark && last.dim === t.dim) {
        last.text += t.text;
        last.w += w;
      } else {
        segs.push({ text: t.text, mark: t.mark, dim: t.dim, x, w });
      }
      x += w;
    }
    // A trailing space shouldn't extend a highlight past the last word.
    const tail = segs[segs.length - 1];
    if (tail && tail.mark && /\s$/.test(tail.text)) {
      const trimmed = tail.text.replace(/\s+$/, "");
      tail.w = ctx.measureText(trimmed).width;
      tail.text = trimmed;
    }
    return { segs, width: x };
  });
}

/** Paint one wrapped line: highlight bands first, then the glyphs on top. */
export function drawRunLine(
  ctx: CanvasRenderingContext2D,
  line: WrappedLine,
  x: number,
  baseline: number,
  fontSize: number,
  color: string,
): void {
  for (const seg of line.segs) {
    if (!seg.mark) continue;
    ctx.fillStyle = seg.mark;
    roundRect(
      ctx,
      x + seg.x - fontSize * 0.06,
      baseline - fontSize * 0.82,
      seg.w + fontSize * 0.12,
      fontSize * 1.06,
      fontSize * 0.14,
    );
    ctx.fill();
  }
  for (const seg of line.segs) {
    ctx.fillStyle = seg.dim ? alpha(INK_MUTED, 0.8) : color;
    ctx.fillText(seg.text, x + seg.x, baseline);
  }
}

/* ------------------------------------------------------------------ */
/* Paper                                                               */
/* ------------------------------------------------------------------ */

let grainPattern: CanvasPattern | null = null;

/** A 128px noise tile, built once — the card's paper tooth. */
function getGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern;
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 232 + Math.floor(Math.random() * 24);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(tile, "repeat");
  return grainPattern;
}

/**
 * The card's backdrop: the theme's paper, the app's 24px dot grid, a soft
 * vignette toward the theme's edge tone, and a whisper of grain so a flat PNG
 * still reads as paper rather than as a screenshot.
 */
export function paintPaper(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: BubbleTheme,
): void {
  const bg = theme.background;
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, w, h);

  // Dot grid — the same 24px rhythm as the canvas, scaled up with the card.
  const k = w / 540;
  const step = 24 * k;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = bg.dots;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Vignette — an ellipse matching the card's aspect, as on the canvas.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.78);
  g.addColorStop(0.55, alpha(bg.edge, 0));
  g.addColorStop(1, bg.edge);
  ctx.fillStyle = g;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();

  const grain = getGrain(ctx);
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/** The gold hairline plate frame, with its corners left open. */
export function paintFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  insetX: number,
  insetY: number,
  accent: string,
): void {
  const gap = Math.min(w, h) * 0.09; // corners breathe — a printed-plate cue
  ctx.save();
  ctx.strokeStyle = alpha(accent, 0.38);
  ctx.lineWidth = Math.max(1, w / 900);
  ctx.lineCap = "round";
  const x0 = insetX;
  const y0 = insetY;
  const x1 = w - insetX;
  const y1 = h - insetY;
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  seg(x0 + gap, y0, x1 - gap, y0);
  seg(x0 + gap, y1, x1 - gap, y1);
  seg(x0, y0 + gap, x0, y1 - gap);
  seg(x1, y0 + gap, x1, y1 - gap);
  ctx.restore();
}
