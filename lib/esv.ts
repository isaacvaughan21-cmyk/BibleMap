import "server-only";
import { BOOKS } from "./bible-books";

/**
 * Crossway ESV API (api.esv.org) — live, server-side verse fetch.
 *
 * Like NLT (lib/nlt.ts), ESV text is never stored as a dataset: it is relayed
 * one chapter at a time and only ephemerally cached. Crossway's published API
 * terms are stricter than Tyndale's, and each one is enforced here:
 *
 *  - "You may request up to 500 verses per query, or half a book, whichever is
 *    less."  A chapter is always < 500 verses (Ps 119, at 176, is the longest),
 *    but in a one- or two-chapter book a single chapter can be more than half
 *    the book — so those chapters are fetched as two half-sized queries. See
 *    {@link SPLIT_MIDPOINTS}.
 *  - "You can cache up to 500 verses. We encourage you to periodically clear
 *    out your cache."  {@link VERSE_CACHE_LIMIT} + {@link CACHE_TTL_MS}.
 *  - "You may only perform 5,000 queries per day, with no more than 1,000
 *    requests in an hour and no more than 60 requests per minute."
 *    {@link RATE_LIMITS}, checked before every outbound call.
 *  - "Each page on which you use the text must include a link to www.esv.org."
 *    Handled in the UI — see `ESV_CREDIT` / `creditLink` in lib/versions.ts.
 *  - The text may not be modified. We strip Crossway's own presentation markup
 *    (headings, footnotes, verse numbers) but never alter a word of the verse.
 *
 * The key is read from `process.env.ESV_API_KEY` and must NEVER reach the
 * client bundle — this module is `server-only` and is reached through the
 * /api/esv route handler.
 */

const API_BASE = "https://api.esv.org/v3/passage/html/";

/**
 * The HTML endpoint (rather than the plain-text one) because it marks headings
 * structurally. Psalm superscriptions ("A Psalm of David."), Psalm 119's
 * acrostic titles ("Aleph") and Song of Solomon's speaker labels ("She") are
 * all emitted as `<h4>` regardless of `include-headings`, and in plain text
 * they are indistinguishable from verse content.
 */
const QUERY_PARAMS = {
  "include-passage-references": "false",
  "include-headings": "false",
  "include-footnotes": "false",
  "include-footnote-body": "false",
  "include-audio-link": "false",
  "include-chapter-numbers": "false",
  "include-short-copyright": "false",
  "include-copyright": "false",
  "include-css-link": "false",
  "include-book-titles": "false",
  "include-subheadings": "false",
} as const;

/**
 * Chapters that are more than half their book, keyed `code:chapter` and valued
 * with the verse to split at (⌊verses / 2⌋). These are fetched as two queries —
 * `1-mid` then `mid+1-999` — so no single query asks for more than half a book.
 *
 * Only one- and two-chapter books can trip the rule: in every book of three or
 * more chapters the longest chapter is well under half the total. Verse counts
 * verified against the live ESV API.
 */
const SPLIT_MIDPOINTS: Record<string, number> = {
  "Obad:1": 10, // 21 verses
  "Phlm:1": 12, // 25
  "2John:1": 6, // 13
  "3John:1": 7, // 15
  "Jude:1": 12, // 25
  "Hag:1": 7, // 15
  "Hag:2": 11, // 23
};

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

/** Crossway's published ceilings, most restrictive window first. */
const RATE_LIMITS = [
  { windowMs: 60_000, max: 60, label: "minute" },
  { windowMs: 3_600_000, max: 1_000, label: "hour" },
  { windowMs: 86_400_000, max: 5_000, label: "day" },
] as const;

/**
 * Timestamps of outbound queries, ascending. Per-process, so on a multi-
 * instance deploy this throttles each instance rather than the account as a
 * whole — a safety valve that keeps a runaway loop from burning the daily
 * budget, not a distributed quota.
 */
const queryTimes: number[] = [];

export class EsvRateLimitError extends Error {}

/** Reserve `n` outbound queries, or throw if any window is already full. */
function reserveQueries(n: number): void {
  const now = Date.now();
  const oldest = now - RATE_LIMITS[RATE_LIMITS.length - 1].windowMs;
  while (queryTimes.length && queryTimes[0] < oldest) queryTimes.shift();

  for (const { windowMs, max, label } of RATE_LIMITS) {
    const since = now - windowMs;
    let used = 0;
    for (let i = queryTimes.length - 1; i >= 0 && queryTimes[i] >= since; i--) {
      used++;
    }
    if (used + n > max) {
      throw new EsvRateLimitError(`ESV rate limit reached (${label})`);
    }
  }
  for (let i = 0; i < n; i++) queryTimes.push(now);
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

/** "You can cache up to 500 verses." */
const VERSE_CACHE_LIMIT = 500;
/** "We encourage you to periodically clear out your cache." */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// Insertion-ordered, so the first key is always the oldest chapter.
const memCache = new Map<string, string[]>();
let cachedVerses = 0;
let cacheFilledAt = Date.now();

function readCache(key: string): string[] | undefined {
  if (Date.now() - cacheFilledAt > CACHE_TTL_MS) {
    memCache.clear();
    cachedVerses = 0;
    cacheFilledAt = Date.now();
    return undefined;
  }
  return memCache.get(key);
}

function writeCache(key: string, verses: string[]): void {
  memCache.set(key, verses);
  cachedVerses += verses.length;
  // Evict oldest-first until we're back inside the 500-verse allowance.
  for (const [k, v] of memCache) {
    if (cachedVerses <= VERSE_CACHE_LIMIT) break;
    if (k === key) continue; // never evict what we just fetched
    memCache.delete(k);
    cachedVerses -= v.length;
  }
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => {
      const hit = NAMED_ENTITIES[name.toLowerCase()];
      return hit ?? m;
    });
}

/**
 * Strip Crossway's presentation markup from one verse's HTML, leaving the
 * verse text exactly as published. Headings are removed by the caller (they
 * sit between verses); here we drop footnote callouts, audio links, and the
 * remaining tags, and upper-case the small-caps divine name to match how the
 * bundled translations render it.
 */
function cleanVerseHtml(html: string): string {
  let s = html;
  s = s.replace(
    /<sup[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/sup>/gi,
    "",
  );
  s = s.replace(
    /<a[^>]*class="[^"]*(?:footnote|mp3link)[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    "",
  );
  s = s.replace(
    /<span[^>]*class="[^"]*(?:small-caps|divine-name)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, t: string) => t.toUpperCase(),
  );
  s = s.replace(/<[^>]+>/g, "");
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

const VERSE_NUM_RE = /<b[^>]*class="[^"]*verse-num[^"]*"[^>]*>\s*(\d+)/gi;

/**
 * Parse one passage's HTML into `verses[verseNumber] = text`. Sparse on
 * purpose — the caller merges the halves of a split fetch and densifies.
 */
function parsePassage(html: string, into: string[]): void {
  // Headings (`psalm-title`, `psalm-acrostic-title`, `speaker`, section
  // headings) are not verse text and would otherwise bleed into the preceding
  // verse. They are always well-formed and never nested.
  const body = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");

  const marks: { num: number; start: number; end: number }[] = [];
  VERSE_NUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VERSE_NUM_RE.exec(body))) {
    marks.push({
      num: Number(m[1]),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (let i = 0; i < marks.length; i++) {
    const from = body.indexOf(">", marks[i].end);
    const slice = body.slice(
      from === -1 ? marks[i].end : from + 1,
      i + 1 < marks.length ? marks[i + 1].start : body.length,
    );
    into[marks[i].num] = cleanVerseHtml(slice);
  }
}

/* -------------------------------------------------------------------------- */
/* Fetch                                                                      */
/* -------------------------------------------------------------------------- */

async function requestPassage(ref: string, key: string): Promise<string> {
  const params = new URLSearchParams({ q: ref, ...QUERY_PARAMS });
  const res = await fetch(`${API_BASE}?${params}`, {
    headers: { Authorization: `Token ${key}` },
    // `no-store`: don't let Next persist copyrighted text to its on-disk data
    // cache. Caching is confined to the bounded in-process cache above.
    cache: "no-store",
  });
  if (res.status === 429) throw new EsvRateLimitError("ESV API 429");
  if (!res.ok) throw new Error(`ESV API ${res.status}`);
  const data = (await res.json()) as { passages?: string[] };
  return data.passages?.join("\n") ?? "";
}

/** The one or two queries a chapter needs to stay within "half a book". */
function refsFor(name: string, chapter: number, code: string): string[] {
  const mid = SPLIT_MIDPOINTS[`${code}:${chapter}`];
  if (mid) {
    return [`${name} ${chapter}:1-${mid}`, `${name} ${chapter}:${mid + 1}-999`];
  }
  return [`${name} ${chapter}`];
}

// Concurrent requests for the same chapter share one upstream fetch, so a
// burst of readers costs a single query against the daily allowance.
const inflight = new Map<string, Promise<string[]>>();

/**
 * Fetch one chapter of the ESV and return its verses as `string[]` (index =
 * verse number − 1). Throws on a missing key (503-worthy), a local or upstream
 * rate limit (429-worthy), or any other upstream failure (502-worthy).
 */
export async function fetchEsvChapter(
  code: string,
  chapter: number,
): Promise<string[]> {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new Error("ESV_API_KEY not configured");

  const book = BOOKS.find((b) => b.code === code);
  if (!book) throw new Error(`Unknown book ${code}`);

  const cacheKey = `${code}:${chapter}`;
  const hit = readCache(cacheKey);
  if (hit) return hit;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const run = (async () => {
    const refs = refsFor(book.name, chapter, code);
    reserveQueries(refs.length);

    const byNumber: string[] = [];
    for (const ref of refs) {
      parsePassage(await requestPassage(ref, key), byNumber);
    }

    // `byNumber` is 1-indexed and sparse (ESV omits verses such as Matt 17:21
    // that rest on later manuscripts). Densify to a 0-indexed verse array.
    const verses: string[] = [];
    for (let n = 1; n < byNumber.length; n++) verses[n - 1] = byNumber[n] ?? "";

    writeCache(cacheKey, verses);
    return verses;
  })();

  inflight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    inflight.delete(cacheKey);
  }
}
