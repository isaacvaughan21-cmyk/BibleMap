import { BOOKS, type BibleBook } from "./bible-books";

/**
 * BSB access — per-book JSON under /bible/{osis}.json, lazy-loaded and cached.
 * Canonical reference display form: "John 3:16" (full book name).
 */

export type BookData = { code: string; name: string; chapters: string[][] };
export type ParsedRef = { book: BibleBook; chapter: number; verse: number };

const bookCache = new Map<string, Promise<BookData>>();

export function loadBook(code: string): Promise<BookData> {
  let cached = bookCache.get(code);
  if (!cached) {
    cached = fetch(`/bible/${code}.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${code} (${res.status})`);
      return res.json() as Promise<BookData>;
    });
    // Don't cache failures — a retry should actually retry.
    cached.catch(() => bookCache.delete(code));
    bookCache.set(code, cached);
  }
  return cached;
}

/** Common short forms that prefix matching alone can't resolve. */
const ALIASES: Record<string, string> = {
  gn: "Gen",
  ex: "Exod",
  lv: "Lev",
  nm: "Num",
  dt: "Deut",
  jsh: "Josh",
  jdg: "Judg",
  "1sm": "1Sam",
  "2sm": "2Sam",
  ps: "Ps",
  psa: "Ps",
  psalms: "Ps",
  prv: "Prov",
  ecc: "Eccl",
  sos: "Song",
  "song of songs": "Song",
  is: "Isa",
  jr: "Jer",
  ez: "Ezek",
  ezk: "Ezek",
  dn: "Dan",
  hs: "Hos",
  mt: "Matt",
  mk: "Mark",
  mrk: "Mark",
  lk: "Luke",
  jn: "John",
  jhn: "John",
  rm: "Rom",
  gl: "Gal",
  php: "Phil",
  phm: "Phlm",
  hb: "Heb",
  jm: "Jas",
  jas: "Jas",
  "1jn": "1John",
  "2jn": "2John",
  "3jn": "3John",
  rv: "Rev",
  rev: "Rev",
};

function findBook(raw: string): BibleBook | null {
  const q = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!q) return null;
  const aliased = ALIASES[q.replace(/ /g, "")] ?? ALIASES[q];
  if (aliased) return BOOKS.find((b) => b.code === aliased) ?? null;
  const exact = BOOKS.find(
    (b) => b.name.toLowerCase() === q || b.code.toLowerCase() === q,
  );
  if (exact) return exact;
  return (
    BOOKS.find(
      (b) =>
        b.name.toLowerCase().startsWith(q) ||
        b.code.toLowerCase().startsWith(q),
    ) ?? null
  );
}

/** "John 3:16", "jn 3 16", "1 cor 13:4" → ParsedRef. Null if unresolvable. */
export function parseRef(input: string): ParsedRef | null {
  const m = input
    .trim()
    .match(/^(\d?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.,v]\s*(\d+))?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : 1;
  if (chapter < 1 || chapter > book.chapters || verse < 1) return null;
  return { book, chapter, verse };
}

export function formatRef(p: ParsedRef): string {
  return `${p.book.name} ${p.chapter}:${p.verse}`;
}

/** OSIS id used by the TSK lookup: "John.3.16" */
export function osisId(p: ParsedRef): string {
  return `${p.book.code}.${p.chapter}.${p.verse}`;
}

/** "John.3.16" → ParsedRef */
export function fromOsisId(id: string): ParsedRef | null {
  const [code, ch, vs] = id.split(".");
  const book = BOOKS.find((b) => b.code === code);
  if (!book) return null;
  return { book, chapter: Number(ch), verse: Number(vs) };
}

export async function getVerse(ref: string): Promise<{ text: string }> {
  const parsed = parseRef(ref);
  if (!parsed) throw new Error(`Unrecognized reference: ${ref}`);
  return getVerseByParsed(parsed);
}

export async function getVerseByParsed(
  p: ParsedRef,
): Promise<{ text: string }> {
  const book = await loadBook(p.book.code);
  const text = book.chapters[p.chapter - 1]?.[p.verse - 1];
  if (!text) throw new Error(`No text for ${formatRef(p)}`);
  return { text };
}

/** Verses p..end inclusive (same book), joined for denormalized storage. */
export async function getPassageText(
  start: ParsedRef,
  endVerse?: ParsedRef,
): Promise<string> {
  const book = await loadBook(start.book.code);
  const end = endVerse ?? start;
  const parts: string[] = [];
  for (let c = start.chapter; c <= end.chapter; c++) {
    const verses = book.chapters[c - 1] ?? [];
    const from = c === start.chapter ? start.verse : 1;
    const to = c === end.chapter ? end.verse : verses.length;
    for (let v = from; v <= to; v++) {
      if (verses[v - 1]) parts.push(verses[v - 1]);
    }
  }
  return parts.join(" ");
}

/** Free-text candidates for the picker ("jo" → John, Job, Joel, Jonah …). */
export function searchPassage(query: string): ParsedRef[] {
  const direct = parseRef(query);
  if (direct) return [direct];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BOOKS.filter((b) => b.name.toLowerCase().startsWith(q))
    .slice(0, 6)
    .map((book) => ({ book, chapter: 1, verse: 1 }));
}
