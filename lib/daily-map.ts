/**
 * "Map of the Day" — a small, scripture-grounded study map published daily.
 *
 * Every map is centred on a verse that prompts a question, then branches off to
 * other verses and short observations that piece together what the verse is
 * about. Maps are authored offline (by Claude, never a runtime API key),
 * verse-by-verse validated against the committed Bible corpus, and committed as
 * static JSON under `public/daily-maps/`. The app serves "today's" map by date,
 * so it advances on its own with no server, no key, and the same map for every
 * reader on a given day.
 *
 * This module is PURE (no Dexie, no fs) so it can be imported from both the
 * public server page and the client. Persisting a map into a reader's own
 * canvas lives in `lib/daily-map-import.ts`; server filesystem access lives in
 * `lib/daily-map-server.ts`.
 */

export type DailyNodeKind = "question" | "verse" | "note";
export type DailyEdgeKind = "manual" | "crossref";

export type DailyMapNode = {
  id: string;
  type: DailyNodeKind;
  position: { x: number; y: number };
  /** question / note bubbles. */
  content?: string;
  /** verse bubbles — canonical reference, e.g. "John 3:16". */
  verseRef?: string;
  /** verse bubbles — authoritative text, read from the corpus at build time. */
  verseText?: string;
};

export type DailyMapEdge = {
  id: string;
  source: string;
  target: string;
  kind: DailyEdgeKind;
};

/** A complete, self-contained daily map — renderable and importable as-is. */
export type DailyMap = {
  /** Stable id / permalink slug, e.g. "2026-06-27-the-bronze-serpent". */
  id: string;
  /** The calendar day this map is featured on, "YYYY-MM-DD". */
  date: string;
  /** Short title, e.g. "Why a bronze serpent?" */
  title: string;
  /** The centring question the verse prompts. */
  question: string;
  /** The anchor verse the study springs from, canonical form. */
  anchorRef: string;
  /** One-sentence teaser for cards, the manifest, and link previews. */
  blurb: string;
  /** Bible version the verse text was drawn from (display + credit). */
  version: string;
  nodes: DailyMapNode[];
  edges: DailyMapEdge[];
};

/** The lightweight per-map entry stored in the manifest (index.json). */
export type DailyMapMeta = {
  id: string;
  date: string;
  title: string;
  question: string;
  anchorRef: string;
  blurb: string;
};

export type DailyMapIndex = {
  generatedAt: string;
  maps: DailyMapMeta[];
};

/** A local-calendar "YYYY-MM-DD" key for the given date (defaults to now). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole-day number since the Unix epoch for a "YYYY-MM-DD" key (UTC-stable). */
function epochDay(key: string): number {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

/**
 * The map featured on `todayKey`. Maps carry an explicit `date`, so within the
 * authored window each day resolves to exactly one map. Past the window (or for
 * any gap) it falls back to a deterministic rotation through the whole pool —
 * the same for every reader — so a day is NEVER without a map.
 */
export function pickForDate(
  maps: DailyMapMeta[],
  todayKey: string = dayKey(),
): DailyMapMeta | null {
  if (!maps.length) return null;
  const exact = maps.find((m) => m.date === todayKey);
  if (exact) return exact;
  const sorted = [...maps].sort((a, b) => a.date.localeCompare(b.date));
  const i =
    ((epochDay(todayKey) % sorted.length) + sorted.length) % sorted.length;
  return sorted[i];
}

/* ----------------------------- client loaders ----------------------------- */

/** The manifest of every published map (newest authored first in the file). */
export async function fetchDailyIndex(): Promise<DailyMapIndex> {
  const res = await fetch("/daily-maps/index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`daily-maps index ${res.status}`);
  return (await res.json()) as DailyMapIndex;
}

/** A single map by id. */
export async function fetchDailyMap(id: string): Promise<DailyMap> {
  const res = await fetch(`/daily-maps/${id}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`daily-map ${id} ${res.status}`);
  return (await res.json()) as DailyMap;
}

/** The manifest plus today's full map, in one call (client). */
export async function fetchTodaysMap(
  todayKey: string = dayKey(),
): Promise<DailyMap | null> {
  const index = await fetchDailyIndex();
  const meta = pickForDate(index.maps, todayKey);
  if (!meta) return null;
  return fetchDailyMap(meta.id);
}
