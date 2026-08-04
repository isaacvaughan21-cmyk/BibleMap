import { BOOKS, type BibleBook } from "@/lib/bible-books";
import { parseRange } from "@/lib/bible";

/**
 * The scripture spine of the Library.
 *
 * Every verse bubble already carries a `verseRef`, so the books a study touches
 * can be read straight off the map — no tagging, no upkeep. This module turns
 * those references into a canon-ordered index and into the short range label a
 * card wears ("Heb 5–7 · Gen 14 · Ps 110").
 */

export type Division = {
  id: string;
  name: string;
  /** What sits in it, in the reader's words — not a range of indices. */
  era: string;
  books: BibleBook[];
};

/** Canonical position of a book code — the sort key for everything here. */
export const BOOK_ORDER: Record<string, number> = Object.fromEntries(
  BOOKS.map((b, i) => [b.code, i]),
);

const BY_CODE = new Map(BOOKS.map((b) => [b.code, b]));

export function bookByCode(code: string): BibleBook | undefined {
  return BY_CODE.get(code);
}

/** Divisions as a reader thinks of them, not as the file is ordered. */
export const DIVISIONS: Division[] = [
  {
    id: "law",
    name: "The law",
    era: "Genesis – Deuteronomy",
    books: BOOKS.slice(0, 5),
  },
  {
    id: "history",
    name: "History",
    era: "Joshua – Esther",
    books: BOOKS.slice(5, 17),
  },
  {
    id: "wisdom",
    name: "Wisdom",
    era: "Job – Song of Solomon",
    books: BOOKS.slice(17, 22),
  },
  {
    id: "prophets",
    name: "The prophets",
    era: "Isaiah – Malachi",
    books: BOOKS.slice(22, 39),
  },
  {
    id: "gospels",
    name: "The gospels and Acts",
    era: "Matthew – Acts",
    books: BOOKS.slice(39, 44),
  },
  {
    id: "letters",
    name: "The letters",
    era: "Romans – Jude",
    books: BOOKS.slice(44, 65),
  },
  {
    id: "revelation",
    name: "Revelation",
    era: "The apocalypse",
    books: BOOKS.slice(65),
  },
];

/**
 * Compact display name — the stored code with numbered books spaced out
 * ("1Cor" → "1 Cor"). Short enough for a card, still unambiguous.
 */
export function shortBookName(code: string): string {
  return code.replace(/^([123])(?=[A-Za-z])/, "$1 ");
}

/**
 * The book and chapter a stored reference points at. Reuses the same parser the
 * canvas uses, so anything the verse picker can write, this can read — single
 * verses, ranges, and cross-chapter spans alike.
 */
export function refLocation(
  verseRef: string | undefined,
): { code: string; chapters: number[] } | null {
  if (!verseRef) return null;
  const parsed = parseRange(verseRef);
  if (!parsed) return null;
  const from = parsed.start.chapter;
  const to = parsed.end?.chapter ?? from;
  const chapters: number[] = [];
  for (let c = Math.min(from, to); c <= Math.max(from, to); c++)
    chapters.push(c);
  return { code: parsed.start.book.code, chapters };
}

/** [5,6,7,12] → "5–7, 12". Collapses runs; keeps it to two groups. */
function chapterLabel(chapters: number[]): string {
  const sorted = [...new Set(chapters)].sort((a, b) => a - b);
  const runs: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.length > 2 ? `${runs.slice(0, 2).join(", ")}…` : runs.join(", ");
}

/**
 * The line a card wears: up to three books in canonical order, each with its
 * chapters, then a count of whatever else the study reaches into.
 */
export function scriptureLabel(
  chaptersByBook: Map<string, Set<number>>,
  limit = 3,
): string {
  const ordered = [...chaptersByBook.entries()].sort(
    (a, b) => (BOOK_ORDER[a[0]] ?? 999) - (BOOK_ORDER[b[0]] ?? 999),
  );
  if (!ordered.length) return "";
  const shown = ordered
    .slice(0, limit)
    .map(([code, chs]) => `${shortBookName(code)} ${chapterLabel([...chs])}`);
  const rest = ordered.length - limit;
  return rest > 0 ? `${shown.join(" · ")} +${rest} more` : shown.join(" · ");
}
