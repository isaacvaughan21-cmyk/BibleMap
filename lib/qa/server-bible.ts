import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  formatRange,
  fromOsisId,
  parseRange,
  type ParsedRange,
} from "@/lib/bible";
import { DEFAULT_VERSION } from "@/lib/versions";

/**
 * Server-side Bible access + citation validation.
 *
 * IMPORTANT: do NOT use loadBook / getPassageText from lib/bible.ts here — they
 * fetch("/bible/…"), which has no origin in Node and throws. This module reads
 * the same committed JSON straight off the filesystem instead, and reuses only
 * the pure PARSERS (parseRange / formatRange / fromOsisId) from lib/bible.ts.
 *
 * This is the single backstop behind the "never fabricate a verse" guarantee:
 * a reference that doesn't parse, or whose every verse isn't present in the
 * corpus, returns null and is dropped before the answer leaves the server.
 */

type BookData = { code: string; name: string; chapters: string[][] };

const bookCache = new Map<string, Promise<BookData>>();

function bookPath(code: string, version: string): string {
  const dir = path.join(process.cwd(), "public", "bible");
  return version === DEFAULT_VERSION
    ? path.join(dir, `${code}.json`)
    : path.join(dir, version, `${code}.json`);
}

export function loadBookServer(
  code: string,
  version: string = DEFAULT_VERSION,
): Promise<BookData> {
  const key = `${version}:${code}`;
  let cached = bookCache.get(key);
  if (!cached) {
    cached = fs
      .readFile(bookPath(code, version), "utf8")
      .then((s) => JSON.parse(s) as BookData);
    cached.catch(() => bookCache.delete(key)); // don't cache failures
    bookCache.set(key, cached);
  }
  return cached;
}

/**
 * The text of start..end (inclusive, same book), or null if ANY verse in the
 * span is missing from the corpus. `parseRange` only bounds the chapter, not the
 * verse — so this is what actually catches "Romans 1:99".
 */
export async function readSpan(
  range: ParsedRange,
  version: string = DEFAULT_VERSION,
): Promise<string | null> {
  const start = range.start;
  const end = range.end ?? range.start;
  let book: BookData;
  try {
    book = await loadBookServer(start.book.code, version);
  } catch {
    return null;
  }
  const parts: string[] = [];
  for (let c = start.chapter; c <= end.chapter; c++) {
    const verses = book.chapters[c - 1];
    if (!verses) return null;
    const from = c === start.chapter ? start.verse : 1;
    const to = c === end.chapter ? end.verse : verses.length;
    for (let v = from; v <= to; v++) {
      const text = verses[v - 1];
      if (!text) return null;
      parts.push(text);
    }
  }
  const joined = parts.join(" ").trim();
  return joined || null;
}

export type ValidatedCitation = { ref: string; text: string };

/**
 * Validate a (possibly model- or hand-authored) reference against the corpus.
 * Returns the canonical reference plus the AUTHORITATIVE corpus text, or null if
 * it doesn't parse or doesn't fully resolve. Never trust a caller's quote — the
 * `text` returned here is always read from the corpus.
 */
export async function validateCitation(
  rawRef: string,
  version: string = DEFAULT_VERSION,
): Promise<ValidatedCitation | null> {
  const cleaned = rawRef
    .trim()
    .replace(/[.,;]+$/, "")
    .replace(/^[-*•\s]+/, "");
  const parsed = parseRange(cleaned);
  if (!parsed) return null;
  const text = await readSpan(parsed, version);
  if (!text) return null;
  return { ref: formatRange(parsed), text };
}

/** Validate from an OSIS id pair, e.g. ("Rom.1.1", "Rom.1.3"). */
export async function validateOsis(
  osisStart: string,
  osisEnd: string | undefined,
  version: string = DEFAULT_VERSION,
): Promise<ValidatedCitation | null> {
  const start = fromOsisId(osisStart);
  if (!start) return null;
  const end = osisEnd ? (fromOsisId(osisEnd) ?? undefined) : undefined;
  const range: ParsedRange = { start, end };
  const text = await readSpan(range, version);
  if (!text) return null;
  return { ref: formatRange(range), text };
}
