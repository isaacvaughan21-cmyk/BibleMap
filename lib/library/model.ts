import { DEFAULT_MAP_NAME } from "@/lib/library/constants";

/**
 * The canvas registry — what the Library shelves.
 *
 * A canvas used to be `{ id, name }` in `meta["canvases"]`. It now carries the
 * organisation a reader puts on it: which shelf it sits on, what it's tagged,
 * whether it's pinned or archived. Everything ELSE the Library shows (bubble
 * counts, the books of scripture a study touches, its thumbnail) is derived
 * from the nodes table on the fly and never stored here — see lib/library/facts.
 *
 * Shelves are single-membership on purpose: a study has one home, so nothing
 * goes missing in two places at once. Tags are the many-to-many axis.
 */

export type CanvasEntry = {
  id: string;
  name: string;
  createdAt: number;
  /** Last time this canvas was opened — drives "Recent". */
  openedAt: number;
  /**
   * When any of the ORGANISATION below last changed. Not the map's own edit
   * time (that's derived); this is what cloud sync uses to resolve a conflict
   * between two devices' registries.
   */
  updatedAt: number;
  /** Shelf this canvas lives on, or null for the unshelved pile. */
  shelfId?: string | null;
  tags?: string[];
  pinned?: boolean;
  /** Set when archived — hidden everywhere but the Archive shelf. */
  archivedAt?: number;
  /** Position within a sequential shelf (a book walked chapter by chapter). */
  seriesIndex?: number;
  /**
   * Set when this study is shared with a group — it then lives under that
   * group in the Library rather than on the personal shelves.
   */
  groupId?: string;
  /**
   * True when the study started life in this reader's own library and was
   * shared INTO the group. It stays on their shelves as well as the group's,
   * and leaving the group leaves them holding their own copy.
   */
  sharedByMe?: boolean;
};

export type Shelf = {
  id: string;
  name: string;
  order: number;
  /** A shelf whose studies run in order — cards show their series number. */
  sequential?: boolean;
};

/**
 * Offered in the tag picker before a reader has invented their own. Drawn from
 * how people actually divide study material, not from software categories.
 */
export const SUGGESTED_TAGS = [
  "sermon",
  "small group",
  "devotional",
  "topical",
  "character study",
  "book study",
  "word study",
  "prayer",
  "memory work",
];

export const MAX_TAGS_PER_CANVAS = 6;

/** Widen a legacy `{ id, name }` row, or repair a partial one. */
export function normalizeEntry(
  raw: Partial<CanvasEntry> & { id: string },
  now: number,
): CanvasEntry {
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 120)
      : DEFAULT_MAP_NAME;
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.filter((t) => typeof t === "string" && t.trim()))]
        .map((t) => t.trim().slice(0, 32))
        .slice(0, MAX_TAGS_PER_CANVAS)
    : undefined;
  return {
    id: raw.id,
    name,
    createdAt: numberOr(raw.createdAt, now),
    openedAt: numberOr(raw.openedAt, numberOr(raw.createdAt, now)),
    updatedAt: numberOr(raw.updatedAt, now),
    ...(raw.shelfId ? { shelfId: raw.shelfId } : {}),
    ...(tags?.length ? { tags } : {}),
    ...(raw.pinned ? { pinned: true } : {}),
    ...(typeof raw.archivedAt === "number" && raw.archivedAt > 0
      ? { archivedAt: raw.archivedAt }
      : {}),
    ...(typeof raw.seriesIndex === "number"
      ? { seriesIndex: raw.seriesIndex }
      : {}),
    ...(typeof raw.groupId === "string" && raw.groupId
      ? { groupId: raw.groupId }
      : {}),
    ...(raw.sharedByMe ? { sharedByMe: true } : {}),
  };
}

/**
 * Read `meta["canvases"]` in any shape it has ever had. Anything unrecognisable
 * falls back to a single root canvas rather than throwing a reader into an
 * empty Library.
 */
export function normalizeCanvases(
  raw: unknown,
  fallback: { id: string; name: string },
  now = Date.now(),
): CanvasEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [normalizeEntry(fallback, now)];
  }
  const out: CanvasEntry[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<CanvasEntry> & { id?: unknown };
    if (typeof r.id !== "string" || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(normalizeEntry({ ...r, id: r.id }, now));
  }
  return out.length ? out : [normalizeEntry(fallback, now)];
}

export function normalizeShelves(raw: unknown): Shelf[] {
  if (!Array.isArray(raw)) return [];
  const out: Shelf[] = [];
  const seen = new Set<string>();
  raw.forEach((row, i) => {
    if (!row || typeof row !== "object") return;
    const r = row as Partial<Shelf> & { id?: unknown };
    if (typeof r.id !== "string" || seen.has(r.id)) return;
    if (typeof r.name !== "string" || !r.name.trim()) return;
    seen.add(r.id);
    out.push({
      id: r.id,
      name: r.name.trim().slice(0, 60),
      order: numberOr(r.order, i),
      ...(r.sequential ? { sequential: true } : {}),
    });
  });
  return out.sort((a, b) => a.order - b.order);
}

/** Newer registry entry wins, field for field — used when merging two devices. */
export function mergeEntries(a: CanvasEntry, b: CanvasEntry): CanvasEntry {
  const winner = b.updatedAt > a.updatedAt ? b : a;
  const other = winner === a ? b : a;
  return {
    ...winner,
    // Recency and birth are facts about the reader, not the registry — take the
    // most generous value from either side rather than letting one device's
    // stale row roll the other's back.
    createdAt: Math.min(a.createdAt, b.createdAt),
    openedAt: Math.max(a.openedAt, b.openedAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    ...(winner.tags?.length
      ? {}
      : other.tags?.length
        ? { tags: other.tags }
        : {}),
  };
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
