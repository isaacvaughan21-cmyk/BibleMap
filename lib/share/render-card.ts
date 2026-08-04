import type { HodosEdge, HodosNode } from "@/lib/types";
import { getHighlighter, type BubbleTheme } from "@/lib/themes";
import { versionCredit, versionCreditLink } from "@/lib/versions";
import type { ShareFormat } from "./formats";
import {
  countKinds,
  isRenderable,
  layoutBubble,
  neighbours,
  paintEdge,
  verseRefs,
  type Detail,
  type Rect,
} from "./bubbles";
import {
  alpha,
  drawRunLine,
  drawTracked,
  font,
  INK,
  INK_MUTED,
  INK_SOFT,
  paintFrame,
  paintPaper,
  resolveFonts,
  toRuns,
  trackedWidth,
  wrapJoined,
  wrapRuns,
  wrapText,
  type Fonts,
} from "./paint";

/**
 * The share card — a study, typeset for a feed.
 *
 * Two things a canvas screenshot can't be: framed (a map is wide, a feed is
 * tall) and legible (a map at 1:1 doesn't fit, and shrunk it turns to mush).
 * So the card is laid out like a printed plate — masthead, plate, colophon —
 * and the map inside it is redrawn at whatever scale actually fits, dropping to
 * headline-only bubbles when full body copy would be too small to read.
 */

export type ShareMode = "map" | "verse";

export type ShareCardInput = {
  mode: ShareMode;
  format: ShareFormat;
  /** The map's name — the card's title. */
  title: string;
  nodes: HodosNode[];
  edges: HodosEdge[];
  theme: BubbleTheme;
  /** Bible version code, for the meta line and the licence credit. */
  version: string;
  /** Which verse the "one verse" card is built around. */
  verseNodeId?: string | null;
  /** Fixed date for the masthead; defaults to today. */
  date?: Date;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hodosbiblemap.com")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

/** Below this fitted scale, body copy is unreadable — show headlines only. */
const COMPACT_BELOW = 0.42;
/** Below this, even headlines are too small — the map becomes a backdrop. */
const GHOST_BELOW = 0.58;
const SCENE_PAD = 28;

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

/** next/font swaps faces in asynchronously; a card drawn early gets Georgia. */
export async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const { serif, sans } = resolveFonts();
  try {
    await Promise.all([
      document.fonts.load(`italic 400 48px ${serif}`),
      document.fonts.load(`400 16px ${sans}`),
    ]);
  } catch {
    // A failed preload just means the fallback stack is used — still draws.
  }
  await document.fonts.ready;
}

export function renderShareCard(
  canvas: HTMLCanvasElement,
  input: ShareCardInput,
): void {
  const { width, height } = input.format;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  paint(ctx, input);
}

export async function shareCardBlob(input: ShareCardInput): Promise<Blob> {
  await waitForFonts();
  const canvas = document.createElement("canvas");
  renderShareCard(canvas, input);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't encode the card.")),
      "image/png",
    );
  });
}

export function shareFilename(input: ShareCardInput): string {
  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "hodos-map";
  return `${slug}-${input.format.id}.png`;
}

/**
 * The verse a "one verse" card should feature: the reader's selection if they
 * have one, otherwise the study's anchor (lowest id — the same rule the canvas
 * uses), otherwise the first verse placed.
 */
export function pickVerseNodeId(nodes: HodosNode[]): string | null {
  const verses = nodes.filter((n) => n.type === "verse" && n.data.verseRef);
  if (!verses.length) return null;
  const selected = verses.find((n) => n.selected);
  if (selected) return selected.id;
  return verses.reduce((a, b) => (a.id <= b.id ? a : b)).id;
}

/** A ready-to-paste post caption — the other half of actually sharing. */
export function shareCaption(input: ShareCardInput): string {
  const credit = versionCredit(input.version);
  const tail = [
    `Mapped in Hodos — an infinite mind map for Bible study.`,
    SITE,
    ``,
    `#BibleStudy #Scripture #Hodos`,
  ];

  if (input.mode === "verse") {
    const node = input.nodes.find((n) => n.id === input.verseNodeId);
    const data =
      node?.type === "verse" ? node.data : { verseRef: "", verseText: "" };
    return [
      `${data.verseRef} (${input.version})`,
      ``,
      `“${data.verseText}”`,
      ``,
      ...tail,
      ...(credit ? ["", credit] : []),
    ]
      .join("\n")
      .trim();
  }

  const refs = verseRefs(input.nodes);
  const shown = refs.slice(0, 8).join(" · ");
  const more = refs.length > 8 ? ` +${refs.length - 8} more` : "";
  return [
    `“${input.title}”`,
    ``,
    ...(refs.length ? [`${shown}${more}`, ``] : []),
    ...tail,
    ...(credit ? ["", credit] : []),
  ]
    .join("\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

type Frame = {
  ctx: CanvasRenderingContext2D;
  fonts: Fonts;
  W: number;
  H: number;
  /** Horizontal margin. */
  MX: number;
  /** Vertical margin. */
  MY: number;
  /**
   * The typographic unit. Type sized off the width alone would give a 1600×900
   * card a poster-sized masthead that swallows the plate, so the unit also
   * answers to the height — landscape cards get proportionally quieter type.
   */
  U: number;
  theme: BubbleTheme;
  accent: string;
};

function paint(ctx: CanvasRenderingContext2D, input: ShareCardInput): void {
  const { width: W, height: H } = input.format;
  const theme = input.theme;
  const fonts = resolveFonts();
  // The masthead and colophon sit on the paper, outside any bubble, so they
  // take the theme's verse accent — its most "Hodos" colour in every palette.
  const accent = theme.types.verse.accent;
  const U = Math.min(W, H * 0.8);
  const MX = Math.round(W * 0.075);
  const MY = Math.round(U * 0.075);
  const frame: Frame = { ctx, fonts, W, H, MX, MY, U, theme, accent };

  paintPaper(ctx, W, H, theme);
  paintFrame(ctx, W, H, Math.round(MX * 0.52), Math.round(MY * 0.52), accent);

  const footerTop = paintColophon(frame, input);
  const gap = U * 0.03;
  const topY = Math.round(MY * 1.12);

  if (input.mode === "verse") {
    const bottom = paintVerseMasthead(frame, input, topY);
    const plate: Rect = {
      x: MX,
      y: bottom + gap,
      w: W - MX * 2,
      h: footerTop - gap - (bottom + gap),
    };
    if (plate.h > 0) paintVersePlate(frame, input, plate);
    return;
  }

  // A wide map in a tall frame leaves the plate mostly empty, so the masthead
  // and the map are placed as ONE block, optically centred in the band between
  // the frame and the colophon — rather than the masthead pinned to the top
  // with a lake of paper beneath it.
  const head = mapMasthead(frame, input);
  const band = footerTop - topY;
  const maxPlateH = band - head.height - gap * 2;
  const fit = fitMapScene(frame, input, {
    x: MX,
    y: 0,
    w: W - MX * 2,
    h: maxPlateH,
  });

  // A study too large to set legibly becomes its own backdrop: the map is
  // ghosted across the plate and the passages it gathers are set over it, so
  // the card still says something to someone scrolling past.
  const ghost = !!fit && fit.scale < GHOST_BELOW;
  const plateH = ghost ? maxPlateH : (fit?.height ?? maxPlateH);
  const contentH = head.height + gap * 2 + plateH;
  const start = topY + Math.max(0, (band - contentH) * 0.38);
  head.draw(start);

  const plate: Rect = {
    x: MX,
    y: start + head.height + gap * 2,
    w: W - MX * 2,
    h: plateH,
  };
  if (!fit) {
    paintEmptyPlate(frame, plate);
    return;
  }
  paintMapScene(frame, input, fit, plate, ghost ? 0.3 : 1);
  if (ghost) paintPassageIndex(frame, input, plate);
}

/** Passages named on the card when the map itself is only a backdrop. */
function paintPassageIndex(
  frame: Frame,
  input: ShareCardInput,
  plate: Rect,
): void {
  const { ctx, fonts, U, accent } = frame;
  const refs = verseRefs(input.nodes);
  if (!refs.length) return;

  const eyebrowSize = Math.round(U * 0.0135);
  const size = Math.round(U * 0.027);
  const lh = size * 1.7;
  const maxW = plate.w * 0.82;
  const x = plate.x + plate.w / 2;

  ctx.font = font({ family: fonts.serif, size });
  const maxLines = Math.max(1, Math.floor((plate.h * 0.8 - lh) / lh));
  const SEP = "  ·  ";
  let { lines, used } = wrapJoined(ctx, refs, SEP, maxW, maxLines);
  // A truncated list should say so rather than simply stop.
  if (used < refs.length) {
    ({ lines } = wrapJoined(
      ctx,
      [
        ...refs.slice(0, Math.max(1, used - 1)),
        `+${refs.length - used + 1} more`,
      ],
      SEP,
      maxW,
      maxLines,
    ));
  }

  const blockH = eyebrowSize + lh * 0.9 + lines.length * lh;
  let y = plate.y + (plate.h - blockH) / 2 + eyebrowSize;

  ctx.font = font({ family: fonts.sans, size: eyebrowSize, weight: 500 });
  ctx.fillStyle = accent;
  drawTracked(
    ctx,
    "PASSAGES IN THIS STUDY",
    x,
    y,
    eyebrowSize * 0.22,
    "center",
  );
  y += lh * 0.9;

  ctx.font = font({ family: fonts.serif, size });
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  lines.forEach((line, i) => ctx.fillText(line, x, y + lh * (i + 0.78)));
  ctx.textAlign = "left";
}

/* ---------------------------- masthead ---------------------------- */

type Masthead = { height: number; draw: (top: number) => void };

/**
 * The map masthead — date, title, rule, and what's on the card. Measured first
 * and drawn second, so the composition can decide where the block belongs.
 * `top` is the eyebrow's baseline.
 */
function mapMasthead(frame: Frame, input: ShareCardInput): Masthead {
  const { ctx, fonts, W, MX, U, accent } = frame;
  const eyebrowSize = Math.round(U * 0.0135);
  const eyebrow = formatDate(input.date).toUpperCase();
  const afterEyebrow = Math.round(U * 0.036);

  // Title — shrink until it settles into two lines at most.
  const maxW = W - MX * 2;
  let size = Math.round(U * 0.056);
  let lines: string[] = [];
  for (; size > U * 0.03; size -= 2) {
    ctx.font = font({ family: fonts.serif, size, italic: true });
    lines = wrapText(ctx, input.title || "Untitled map", maxW);
    if (lines.length <= 2) break;
  }
  if (lines.length > 2) lines = wrapText(ctx, input.title, maxW, 2);
  const titleLh = size * 1.15;

  const counts = countKinds(input.nodes.filter(isRenderable));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const meta = [
    `${total} bubble${total === 1 ? "" : "s"}`,
    counts.verse
      ? `${counts.verse} passage${counts.verse === 1 ? "" : "s"}`
      : null,
    input.version,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const metaSize = Math.round(U * 0.0145);

  const height =
    afterEyebrow + titleLh * lines.length + U * 0.022 + U * 0.028 + U * 0.012;

  return {
    height,
    draw: (top) => {
      let y = top;
      ctx.font = font({ family: fonts.sans, size: eyebrowSize, weight: 500 });
      ctx.fillStyle = accent;
      drawTracked(ctx, eyebrow, W / 2, y, eyebrowSize * 0.22, "center");
      y += afterEyebrow;

      ctx.font = font({ family: fonts.serif, size, italic: true });
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      lines.forEach((line, i) =>
        ctx.fillText(line, W / 2, y + titleLh * (i + 0.8)),
      );
      ctx.textAlign = "left";
      y += titleLh * lines.length + U * 0.022;

      ctx.strokeStyle = alpha(accent, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2 - U * 0.042, y);
      ctx.lineTo(W / 2 + U * 0.042, y);
      ctx.stroke();
      y += U * 0.028;

      ctx.font = font({ family: fonts.sans, size: metaSize });
      ctx.fillStyle = INK_MUTED;
      ctx.textAlign = "center";
      ctx.fillText(meta, W / 2, y);
      ctx.textAlign = "left";
    },
  };
}

function paintVerseMasthead(
  frame: Frame,
  input: ShareCardInput,
  y: number,
): number {
  const { ctx, fonts, W, MX, U, accent } = frame;
  const size = Math.round(U * 0.0135);
  ctx.font = font({ family: fonts.sans, size, weight: 500 });
  ctx.fillStyle = alpha(accent, 0.85);
  const label = (input.title || "A study in Hodos").toUpperCase();
  const tracking = size * 0.22;
  // Long map names would collide with the frame — trim to the plate width.
  let text = label;
  while (text.length > 4 && trackedWidth(ctx, text, tracking) > W - MX * 2) {
    text = text.slice(0, -2);
  }
  drawTracked(
    ctx,
    text === label ? text : `${text.trimEnd()}…`,
    W / 2,
    y,
    tracking,
    "center",
  );
  return y + U * 0.012;
}

/* ---------------------------- colophon ---------------------------- */

/** Wordmark, site, and any licence-required credit. Returns its top edge. */
function paintColophon(frame: Frame, input: ShareCardInput): number {
  const { ctx, fonts, W, H, MX, MY, U, accent } = frame;
  const baseline = H - Math.round(MY * 0.85);

  const markSize = Math.round(U * 0.028);
  ctx.font = font({ family: fonts.serif, size: markSize });
  ctx.fillStyle = INK;
  ctx.fillText("Hodos", MX, baseline);
  const markW = ctx.measureText("Hodos").width;

  const greekSize = Math.round(U * 0.0125);
  ctx.font = font({ family: fonts.sans, size: greekSize, weight: 500 });
  ctx.fillStyle = accent;
  drawTracked(ctx, "ΟΔΟΣ", MX + markW + U * 0.016, baseline, greekSize * 0.5);

  const siteSize = Math.round(U * 0.015);
  ctx.font = font({ family: fonts.sans, size: siteSize });
  ctx.fillStyle = INK_MUTED;
  ctx.textAlign = "right";
  ctx.fillText(SITE, W - MX, baseline);
  ctx.textAlign = "left";

  const top = baseline - markSize;

  // Hairline above the whole colophon block.
  const ruleY = Math.round(top - U * 0.022);
  ctx.strokeStyle = alpha(accent, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MX, ruleY);
  ctx.lineTo(W - MX, ruleY);
  ctx.stroke();

  return ruleY;
}

/* ---------------------------- map plate --------------------------- */

type Placed = {
  rect: Rect;
  paint: (ctx: CanvasRenderingContext2D) => void;
};

function layoutScene(
  frame: Frame,
  nodes: HodosNode[],
  detail: Detail,
  primaryId: string | null,
): { placed: Map<string, Placed>; bounds: Rect } {
  const { ctx, fonts, theme } = frame;
  const placed = new Map<string, Placed>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const {
      w,
      h,
      paint: draw,
    } = layoutBubble(ctx, node, {
      fonts,
      theme,
      detail,
      isPrimary: node.id === primaryId,
    });
    const rect: Rect = { x: node.position.x, y: node.position.y, w, h };
    placed.set(node.id, { rect, paint: draw });
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + w);
    maxY = Math.max(maxY, rect.y + h);
  }

  return {
    placed,
    bounds: {
      x: minX - SCENE_PAD,
      y: minY - SCENE_PAD,
      w: maxX - minX + SCENE_PAD * 2,
      h: maxY - minY + SCENE_PAD * 2,
    },
  };
}

type MapFit = {
  scene: { placed: Map<string, Placed>; bounds: Rect };
  nodes: HodosNode[];
  scale: number;
  /** The scene's height once scaled — what the plate actually needs. */
  height: number;
};

/** Lay the map out and work out how much room it wants inside `plate`. */
function fitMapScene(
  frame: Frame,
  input: ShareCardInput,
  plate: Rect,
): MapFit | null {
  const nodes = input.nodes.filter(isRenderable);
  if (!nodes.length || plate.h <= 0) return null;

  const primaryId = nodes.reduce((a, b) => (a.id <= b.id ? a : b)).id;
  let scene = layoutScene(frame, nodes, "full", primaryId);
  let scale = fitScale(scene.bounds, plate);

  // Too small to read? Re-set the map with headline-only bubbles — a smaller
  // scene, which then fits at a larger scale. Keep whichever reads better.
  if (scale < COMPACT_BELOW) {
    const compact = layoutScene(frame, nodes, "compact", primaryId);
    const compactScale = fitScale(compact.bounds, plate);
    if (compactScale > scale) {
      scene = compact;
      scale = compactScale;
    }
  }

  return { scene, nodes, scale, height: scene.bounds.h * scale };
}

function paintMapScene(
  frame: Frame,
  input: ShareCardInput,
  { scene, nodes, scale }: MapFit,
  plate: Rect,
  opacity = 1,
): void {
  const { ctx } = frame;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.rect(plate.x, plate.y, plate.w, plate.h);
  ctx.clip();
  ctx.translate(
    plate.x + plate.w / 2 - (scene.bounds.x + scene.bounds.w / 2) * scale,
    plate.y + plate.h / 2 - (scene.bounds.y + scene.bounds.h / 2) * scale,
  );
  ctx.scale(scale, scale);

  for (const edge of input.edges) {
    const s = scene.placed.get(edge.source);
    const t = scene.placed.get(edge.target);
    if (s && t)
      paintEdge(ctx, s.rect, t.rect, edge.type ?? "manual", frame.theme);
  }
  for (const node of nodes) {
    const p = scene.placed.get(node.id);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.rect.x, p.rect.y);
    p.paint(ctx);
    ctx.restore();
  }
  ctx.restore();
}

function fitScale(bounds: Rect, plate: Rect): number {
  const raw = Math.min(plate.w / bounds.w, plate.h / bounds.h);
  // A two-bubble map shouldn't blow up to poster type; a hundred-bubble one
  // shouldn't vanish. Both ends are clamped.
  return Math.min(1.55, Math.max(0.1, raw));
}

function paintEmptyPlate(frame: Frame, plate: Rect): void {
  const { ctx, fonts, U } = frame;
  ctx.font = font({ family: fonts.serif, size: U * 0.026, italic: true });
  ctx.fillStyle = alpha(INK_MUTED, 0.7);
  ctx.textAlign = "center";
  ctx.fillText(
    "Place a bubble or two, then share your map.",
    plate.x + plate.w / 2,
    plate.y + plate.h / 2,
  );
  ctx.textAlign = "left";
}

/* --------------------------- verse plate -------------------------- */

function paintVersePlate(
  frame: Frame,
  input: ShareCardInput,
  plate: Rect,
): void {
  const { ctx, fonts, U, theme, accent } = frame;
  const node = input.nodes.find((n) => n.id === input.verseNodeId);
  if (!node || node.type !== "verse") {
    paintEmptyPlate(frame, plate);
    return;
  }

  const linked = neighbours(node.id, input.nodes, input.edges);
  const question = linked.find(
    (n) => n.type === "question" && bodyOf(n).trim(),
  );
  const note = linked.find((n) => n.type === "note" && bodyOf(n).trim());

  const maxW = plate.w * 0.88;
  const x = plate.x + plate.w / 2;
  const runs = toRuns(
    node.data.verseText,
    node.data.highlights,
    node.data.highlightColors,
    (id) => getHighlighter(id)?.color ?? theme.highlight,
  );

  // Set the scripture as large as the plate will take — a short verse gets to
  // be a poster, a long one steps down gracefully rather than overflowing.
  const refSize = Math.round(U * 0.022);
  const questionSize = Math.round(U * 0.03);
  const noteSize = Math.round(U * 0.024);
  const gap = U * 0.035;

  const questionLines = (() => {
    if (!question) return [];
    ctx.font = font({ family: fonts.serif, size: questionSize, italic: true });
    return wrapText(ctx, bodyOf(question), maxW, 3);
  })();
  const noteLines = (() => {
    if (!note) return [];
    ctx.font = font({ family: fonts.serif, size: noteSize, italic: true });
    return wrapText(ctx, bodyOf(note), maxW * 0.9, 3);
  })();

  const fixed =
    (questionLines.length
      ? questionLines.length * questionSize * 1.35 + gap
      : 0) +
    refSize * 1.4 +
    gap * 0.7 +
    (noteLines.length ? noteLines.length * noteSize * 1.5 + gap : 0);

  let verseSize = Math.round(Math.min(U * 0.07, plate.h * 0.26));
  let verseLines = wrapRuns(ctx, runs, maxW, 40);
  for (; verseSize > U * 0.022; verseSize -= 2) {
    ctx.font = font({ family: fonts.serif, size: verseSize });
    verseLines = wrapRuns(ctx, runs, maxW, 40);
    if (fixed + verseLines.length * verseSize * 1.42 <= plate.h) break;
  }
  ctx.font = font({ family: fonts.serif, size: verseSize });
  verseLines = wrapRuns(
    ctx,
    runs,
    maxW,
    Math.floor(plate.h / (verseSize * 1.42)),
  );
  const verseLh = verseSize * 1.42;

  const blockH = fixed + verseLines.length * verseLh;
  let y = plate.y + Math.max(0, (plate.h - blockH) / 2);

  if (questionLines.length) {
    ctx.font = font({ family: fonts.serif, size: questionSize, italic: true });
    ctx.fillStyle = alpha(INK_MUTED, 0.95);
    ctx.textAlign = "center";
    const lh = questionSize * 1.35;
    questionLines.forEach((line, i) =>
      ctx.fillText(line, x, y + lh * (i + 0.8)),
    );
    ctx.textAlign = "left";
    y += questionLines.length * lh + gap;
  }

  ctx.font = font({ family: fonts.mono, size: refSize, weight: 500 });
  ctx.fillStyle = accent;
  drawTracked(
    ctx,
    node.data.verseRef.toUpperCase(),
    x,
    y + refSize,
    refSize * 0.14,
    "center",
  );
  y += refSize * 1.4 + gap * 0.7;

  ctx.font = font({ family: fonts.serif, size: verseSize });
  verseLines.forEach((line, i) => {
    drawRunLine(
      ctx,
      line,
      x - line.width / 2,
      y + verseLh * (i + 0.78),
      verseSize,
      INK,
    );
  });
  y += verseLines.length * verseLh;

  if (noteLines.length) {
    y += gap * 0.5;
    ctx.strokeStyle = alpha(accent, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - U * 0.03, y);
    ctx.lineTo(x + U * 0.03, y);
    ctx.stroke();
    y += gap * 0.5;
    ctx.font = font({ family: fonts.serif, size: noteSize, italic: true });
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = "center";
    const lh = noteSize * 1.5;
    noteLines.forEach((line, i) => ctx.fillText(line, x, y + lh * (i + 0.8)));
    ctx.textAlign = "left";
  }
}

/* ------------------------------------------------------------------ */

/** The typed body of any non-verse bubble (question, note, definition word). */
function bodyOf(node: HodosNode): string {
  return node.type === "verse"
    ? ""
    : ((node.data as { content?: string }).content ?? "");
}

function formatDate(date: Date | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date ?? new Date());
}
