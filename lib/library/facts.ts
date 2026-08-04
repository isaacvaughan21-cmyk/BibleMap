import * as repo from "@/lib/db/repo";
import type { DbEdge, DbNode } from "@/lib/db/schema";
import type { NodeKind } from "@/lib/types";
import { BOOK_ORDER, refLocation, scriptureLabel } from "./canon";

/**
 * Everything the Library shows about a canvas that ISN'T stored on the canvas.
 *
 * Bubble counts, edit times, the books of scripture a study reaches into, and
 * the thumbnail are all read out of the nodes table on demand. Nothing here is
 * persisted, so there is no second copy to fall out of date, and a map edited
 * on another device shows its true shape the moment its rows arrive.
 *
 * Counts and books walk the WHOLE study, nested maps included — a bubble you
 * dived into is still part of the work. The thumbnail deliberately doesn't: it
 * draws the top level only, because that's the face you'd recognise.
 */

export type ThumbPoint = { x: number; y: number; kind: NodeKind };

export type CanvasFacts = {
  /** Bubbles across the canvas and every map nested inside it. */
  bubbleCount: number;
  /** Most recent edit anywhere in the study, or 0 for an empty one. */
  editedAt: number;
  /** Book codes touched, in canonical order. */
  books: string[];
  /** "Heb 5–7 · Gen 14 · Ps 110", or "" when no verse has been placed yet. */
  refLabel: string;
  /** Top-level layout, normalised into the {@link THUMB_BOX}. */
  thumb: ThumbPoint[];
  /** Index pairs into `thumb`. */
  thumbEdges: [number, number][];
};

export type SearchHit = {
  canvasId: string;
  /** How many bubbles in this study matched. */
  count: number;
  /** The first matching bubble's text, trimmed for display. */
  excerpt: string;
  /** Whether the match came from a verse reference rather than the reader's words. */
  fromScripture: boolean;
};

export type LibraryIndex = {
  facts: Map<string, CanvasFacts>;
  /** Canvases that touch a given book code. */
  canvasesByBook: Map<string, Set<string>>;
  search(query: string): SearchHit[];
};

const EMPTY_FACTS: CanvasFacts = {
  bubbleCount: 0,
  editedAt: 0,
  books: [],
  refLabel: "",
  thumb: [],
  thumbEdges: [],
};

export function emptyFacts(): CanvasFacts {
  return EMPTY_FACTS;
}

/** Cap on thumbnail dots — a dense map reads the same at 60 as at 600. */
const THUMB_LIMIT = 60;

/**
 * The thumbnail's coordinate space. Its proportions match the strip a card
 * gives it, so a normalised map fills the plate instead of being letterboxed
 * into the middle of it.
 */
export const THUMB_BOX = { w: 100, h: 40, pad: 7 };

/**
 * Read every live row once, then attribute each map to the canvas that owns it.
 * A nested map's id is the id of the bubble it hangs off, so ownership is a
 * walk down from each canvas root rather than a lookup.
 */
export async function buildLibraryIndex(
  canvasIds: string[],
): Promise<LibraryIndex> {
  const { nodes, edges } = await repo.loadAll();

  const nodesByMap = new Map<string, DbNode[]>();
  for (const n of nodes) {
    const list = nodesByMap.get(n.mapId);
    if (list) list.push(n);
    else nodesByMap.set(n.mapId, [n]);
  }
  const edgesByMap = new Map<string, DbEdge[]>();
  for (const e of edges) {
    const list = edgesByMap.get(e.mapId);
    if (list) list.push(e);
    else edgesByMap.set(e.mapId, [e]);
  }

  const facts = new Map<string, CanvasFacts>();
  const canvasesByBook = new Map<string, Set<string>>();
  /** node id → the canvas its map belongs to, for search attribution. */
  const canvasOfNode = new Map<string, string>();

  for (const canvasId of canvasIds) {
    const chaptersByBook = new Map<string, Set<number>>();
    let bubbleCount = 0;
    let editedAt = 0;

    // Breadth-first through the canvas and everything dived into it.
    const seen = new Set<string>();
    const queue = [canvasId];
    while (queue.length) {
      const mapId = queue.shift() as string;
      if (seen.has(mapId)) continue;
      seen.add(mapId);
      const rows = nodesByMap.get(mapId);
      if (!rows) continue;
      for (const n of rows) {
        if (n.deletedAt) continue;
        bubbleCount++;
        if (n.updatedAt > editedAt) editedAt = n.updatedAt;
        canvasOfNode.set(n.id, canvasId);
        const loc = refLocation(n.verseRef);
        if (loc) {
          const set = chaptersByBook.get(loc.code) ?? new Set<number>();
          for (const c of loc.chapters) set.add(c);
          chaptersByBook.set(loc.code, set);
        }
        queue.push(n.id); // this bubble may host a map of its own
      }
    }

    const books = [...chaptersByBook.keys()].sort(
      (a, b) => (BOOK_ORDER[a] ?? 999) - (BOOK_ORDER[b] ?? 999),
    );
    for (const code of books) {
      const set = canvasesByBook.get(code) ?? new Set<string>();
      set.add(canvasId);
      canvasesByBook.set(code, set);
    }

    const { thumb, thumbEdges } = buildThumb(
      (nodesByMap.get(canvasId) ?? []).filter((n) => !n.deletedAt),
      (edgesByMap.get(canvasId) ?? []).filter((e) => !e.deletedAt),
    );

    facts.set(canvasId, {
      bubbleCount,
      editedAt,
      books,
      refLabel: scriptureLabel(chaptersByBook),
      thumb,
      thumbEdges,
    });
  }

  return {
    facts,
    canvasesByBook,
    search: (query: string) => searchNodes(nodes, canvasOfNode, query),
  };
}

/**
 * Normalise a map's real layout into the thumbnail box. Positions are already
 * stored, so a card can draw the actual shape of a study — a hub-and-spoke word
 * study looks nothing like a chained narrative walk, and after a month a shelf
 * reads like a row of book spines.
 *
 * The fit is uniform (one scale for both axes), so a wide map stays wide and a
 * tall one stays tall — distorting to fill would make every study look alike,
 * which is the one thing the thumbnail exists to prevent.
 */
function buildThumb(
  rows: DbNode[],
  edgeRows: DbEdge[],
): { thumb: ThumbPoint[]; thumbEdges: [number, number][] } {
  if (!rows.length) return { thumb: [], thumbEdges: [] };

  // Keep the earliest bubbles — uuid v7 sorts by creation, so this is the
  // opening of the study rather than an arbitrary slice of it.
  const kept =
    rows.length > THUMB_LIMIT
      ? [...rows].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, THUMB_LIMIT)
      : rows;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of kept) {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y);
  }
  // A single bubble (or a perfectly straight row) has no extent on one axis —
  // fall back to a nominal span so it lands in the middle instead of at 0/0.
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const { w, h, pad } = THUMB_BOX;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offsetX = (w - spanX * scale) / 2;
  const offsetY = (h - spanY * scale) / 2;

  const indexById = new Map<string, number>();
  const thumb: ThumbPoint[] = kept.map((n, i) => {
    indexById.set(n.id, i);
    return {
      x: offsetX + (n.position.x - minX) * scale,
      y: offsetY + (n.position.y - minY) * scale,
      kind: n.type,
    };
  });

  const thumbEdges: [number, number][] = [];
  for (const e of edgeRows) {
    const a = indexById.get(e.source);
    const b = indexById.get(e.target);
    if (a !== undefined && b !== undefined) thumbEdges.push([a, b]);
  }
  return { thumb, thumbEdges };
}

/**
 * Search every bubble in every canvas at once.
 *
 * Nobody remembers what they called a canvas; they remember a phrase they wrote
 * and a verse they pinned. So this reads the reader's own words — note and
 * question text, definitions — as well as verse references and verse text, and
 * reports which study each hit landed in.
 */
function searchNodes(
  nodes: DbNode[],
  canvasOfNode: Map<string, string>,
  query: string,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const byCanvas = new Map<string, SearchHit>();

  for (const n of nodes) {
    if (n.deletedAt) continue;
    const canvasId = canvasOfNode.get(n.id);
    if (!canvasId) continue;

    const ref = (n.verseRef ?? "").toLowerCase();
    const own = [n.content, n.definition].filter(Boolean).join(" ");
    const scripture = n.verseText ?? "";
    const inRef = ref.includes(q);
    const inOwn = own.toLowerCase().includes(q);
    const inScripture = scripture.toLowerCase().includes(q);
    if (!inRef && !inOwn && !inScripture) continue;

    const existing = byCanvas.get(canvasId);
    if (existing) {
      existing.count++;
      continue;
    }
    // Prefer the reader's own words in the excerpt — that's what they're
    // hunting for; scripture is the same everywhere.
    const source = inOwn ? own : inRef ? (n.verseRef ?? "") : scripture;
    byCanvas.set(canvasId, {
      canvasId,
      count: 1,
      excerpt: excerptAround(source, q),
      fromScripture: !inOwn,
    });
  }

  return [...byCanvas.values()].sort((a, b) => b.count - a.count);
}

/** A short window of text around the match, so a hit shows its context. */
function excerptAround(text: string, q: string, width = 78): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= width) return clean;
  const at = clean.toLowerCase().indexOf(q);
  if (at < 0) return `${clean.slice(0, width)}…`;
  const start = Math.max(0, at - Math.floor((width - q.length) / 2));
  const head = start > 0 ? "…" : "";
  const tail = start + width < clean.length ? "…" : "";
  return `${head}${clean.slice(start, start + width).trim()}${tail}`;
}
