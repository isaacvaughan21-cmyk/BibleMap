import "server-only";

/**
 * Tyndale NLT API (api.nlt.to) — live, server-side verse fetch.
 *
 * NLT is copyrighted. Our licence permits *quoting* (up to 500 verses, no more
 * than 25% of a work, and never a complete book) — not redistribution. So,
 * unlike the bundled public-domain versions that ship as static JSON, NLT text
 * is never stored as a dataset: it is relayed one chapter at a time, on demand,
 * from Tyndale's API and only lightly/ephemerally cached (in-process memory +
 * CDN edge headers). The required credit line lives in lib/versions.ts
 * (`NLT_CREDIT`) and is rendered wherever NLT text appears.
 *
 * The key is read from `process.env.NLT_API_KEY` and must NEVER reach the
 * client bundle — this module is `server-only` and is reached through the
 * /api/nlt route handler.
 */

const API_BASE = "https://api.nlt.to/api/passages";

/**
 * Our OSIS book codes mostly pass straight to the NLT ref parser. These five
 * "smushed" forms don't resolve there, so map them to abbreviations the API
 * accepts (verified against the live API).
 */
const NLT_REF_OVERRIDES: Record<string, string> = {
  "1Thess": "1Th",
  "2Thess": "2Th",
  "1John": "1Jn",
  "2John": "2Jn",
  "3John": "3Jn",
};

function nltRefToken(code: string): string {
  return NLT_REF_OVERRIDES[code] ?? code;
}

/** Decode the handful of HTML entities the NLT API emits. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * Remove an entire `<span class="cls">…</span>` region, INCLUDING nested spans.
 * The footnote span (class="tn") wraps further spans/<em>, so a non-greedy
 * regex would stop at the first inner `</span>` and leak the rest — this
 * depth-tracking scan removes the whole balanced block.
 */
function stripSpanClass(html: string, cls: string): string {
  const open = `<span class="${cls}">`;
  let out = "";
  let i = 0;
  for (;;) {
    const start = html.indexOf(open, i);
    if (start === -1) {
      out += html.slice(i);
      return out;
    }
    out += html.slice(i, start);
    let depth = 0;
    let j = start;
    while (j < html.length) {
      if (html.startsWith("<span", j)) {
        depth++;
        const close = html.indexOf(">", j);
        j = close === -1 ? html.length : close + 1;
      } else if (html.startsWith("</span>", j)) {
        depth--;
        j += "</span>".length;
        if (depth === 0) break;
      } else {
        j++;
      }
    }
    i = j;
  }
}

/**
 * Turn one `<verse_export>` block's inner HTML into clean verse text: drop
 * footnotes and their anchors, verse numbers, and chapter/section headings,
 * upper-case the divine-name small-caps (matching the bundled translations),
 * then strip remaining tags and normalise whitespace.
 */
function cleanVerseHtml(html: string): string {
  let s = html;
  // Footnotes (balanced — may contain nested spans / <em>) and their anchors.
  s = stripSpanClass(s, "tn");
  s = s.replace(/<a class="a-tn">[\s\S]*?<\/a>/g, "");
  // Chapter-number + section sub-headings are not verse text.
  s = s.replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/g, "");
  // Verse-number markers.
  s = s.replace(/<span class="vn">[\s\S]*?<\/span>/g, "");
  // Small-caps (the divine name): keep the word, upper-cased.
  s = s.replace(/<span class="sc">([\s\S]*?)<\/span>/g, (_, t: string) =>
    t.toUpperCase(),
  );
  // Anything else: drop the tag, keep inner text.
  s = s.replace(/<[^>]+>/g, "");
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

/** Parse a chapter's HTML into a verse array (index = verse number − 1). */
function parseChapter(html: string): string[] {
  const verses: string[] = [];
  const re =
    /<verse_export\b[^>]*\bvn="(\d+)"[^>]*>([\s\S]*?)<\/verse_export>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = Number(m[1]);
    verses[n - 1] = cleanVerseHtml(m[2]);
  }
  // Fill any gaps (combined/omitted verses) so the array is dense.
  for (let i = 0; i < verses.length; i++) if (verses[i] == null) verses[i] = "";
  return verses;
}

// Ephemeral per-process cache — survives the server instance only, never
// persisted to disk. Relay, not redistribution.
const memCache = new Map<string, string[]>();

/**
 * Fetch one chapter of NLT and return its verses as `string[]`. Throws on a
 * missing key (503-worthy) or an upstream failure (502-worthy).
 */
export async function fetchNltChapter(
  code: string,
  chapter: number,
): Promise<string[]> {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new Error("NLT_API_KEY not configured");

  const cacheKey = `${code}:${chapter}`;
  const hit = memCache.get(cacheKey);
  if (hit) return hit;

  const ref = `${nltRefToken(code)}.${chapter}`;
  const url = `${API_BASE}?ref=${encodeURIComponent(ref)}&version=NLT&key=${encodeURIComponent(key)}`;
  // `no-store`: don't let Next persist copyrighted text to its on-disk data
  // cache. Caching is intentionally limited to process memory + CDN headers.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`NLT API ${res.status}`);
  const verses = parseChapter(await res.text());
  memCache.set(cacheKey, verses);
  return verses;
}
