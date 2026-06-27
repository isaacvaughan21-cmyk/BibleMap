import { BOOKS } from "@/lib/bible-books";
import { BOOK_META, type BookMeta } from "./book-meta";
import { PERSON_META, type PersonMeta } from "./person-meta";
import { dice } from "./spell";
import type { Route } from "./types";

/**
 * Deterministic query classifier — pure regex + lookups, no ML, no network.
 * Runs BEFORE any retrieval or LLM call so authorship/biography questions go
 * straight to the curated metadata and obvious non-Bible questions are declined
 * without spending a model call.
 */

export type Classification = {
  route: Route;
  /** Authorship: the matched book(s). */
  bookHits?: BookMeta[];
  /** Biography: the matched figure(s) — length ≥ 2 means an ambiguous name. */
  personHits?: PersonMeta[];
};

/* ---- Book name matching ---- */

const BOOK_ALIASES: Record<string, string> = {
  psalms: "Ps",
  "song of songs": "Song",
  revelations: "Rev",
};

// Lowercase name forms for fuzzy matching: each book's full name plus its last
// word ("1 Corinthians" → "corinthians", "Song of Solomon" → "solomon").
const BOOK_FUZZY_TARGETS: { form: string; code: string }[] = [];
for (const b of BOOKS) {
  const n = b.name.toLowerCase();
  BOOK_FUZZY_TARGETS.push({ form: n, code: b.code });
  const last = n.split(" ").pop() ?? n;
  if (last !== n && last.length >= 4)
    BOOK_FUZZY_TARGETS.push({ form: last, code: b.code });
}
for (const [alias, code] of Object.entries(BOOK_ALIASES)) {
  BOOK_FUZZY_TARGETS.push({ form: alias, code });
}

function findBookCode(text: string): string | null {
  const q = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  const candidates: [string, string][] = [
    ...BOOKS.map((b) => [b.name, b.code] as [string, string]),
    ...Object.entries(BOOK_ALIASES),
  ];
  let bestCode: string | null = null;
  let bestLen = 0;
  for (const [name, code] of candidates) {
    const n = name.toLowerCase();
    if ((q.includes(` ${n} `) || q.includes(` ${n}s `)) && n.length > bestLen) {
      bestCode = code;
      bestLen = n.length;
    }
  }
  if (bestCode) return bestCode;

  // Fuzzy fallback for a misspelled book name ("reveltino" → Revelation). Only
  // reached behind an authorship phrase, so a false match is unlikely.
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  let fzCode: string | null = null;
  let fzScore = 0.5; // minimum similarity to accept
  for (const w of words) {
    for (const t of BOOK_FUZZY_TARGETS) {
      const s = dice(w, t.form);
      if (s > fzScore) {
        fzScore = s;
        fzCode = t.code;
      }
    }
  }
  return fzCode;
}

/* ---- Person name index ---- */

const personByName = new Map<string, PersonMeta[]>();
for (const p of PERSON_META) {
  const keys = new Set<string>([p.primaryName.toLowerCase()]);
  // Index distinctive single-word akas/tags (e.g. "Magdalene", "Baptist") so an
  // ambiguous name can be narrowed; multi-word akas are ignored for matching.
  for (const a of p.aka) {
    const tok = a.toLowerCase();
    if (/^[a-z']+$/.test(tok)) keys.add(tok);
  }
  for (const k of keys) {
    const arr = personByName.get(k);
    if (arr) arr.push(p);
    else personByName.set(k, [p]);
  }
}

/** Words that never identify a person on their own. */
const NAME_NOISE = new Set([
  "the",
  "a",
  "an",
  "apostle",
  "prophet",
  "king",
  "queen",
  "disciple",
  "saint",
  "st",
  "of",
  "in",
  "bible",
  "person",
  "figure",
  "man",
  "woman",
  "son",
  "daughter",
  "was",
  "is",
  "who",
  "about",
  "tell",
  "me",
]);

function findPersons(namePhrase: string): PersonMeta[] {
  const cleaned = namePhrase
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .trim();
  if (!cleaned) return [];
  // Exact phrase first (e.g. an aka indexed verbatim).
  const exact = personByName.get(cleaned);
  if (exact) return exact;
  // Otherwise prefer the most specific single-token match (fewest figures).
  let best: PersonMeta[] | null = null;
  for (const tok of cleaned.split(/\s+/)) {
    if (NAME_NOISE.has(tok)) continue;
    const hit = personByName.get(tok);
    if (hit && (!best || hit.length < best.length)) best = hit;
  }
  if (best) return best;

  // Fuzzy fallback for a misspelled name ("matthwe" → Matthew). Only reached
  // behind a biography phrase, so a false match is unlikely.
  let fz: { people: PersonMeta[]; score: number } | null = null;
  for (const tok of cleaned.split(/\s+/)) {
    if (NAME_NOISE.has(tok) || tok.length < 4) continue;
    for (const [key, people] of personByName) {
      if (key.length < 4) continue;
      const s = dice(tok, key);
      if (s >= 0.6 && (!fz || s > fz.score)) fz = { people, score: s };
    }
  }
  return fz?.people ?? [];
}

/* ---- Off-topic heuristic ---- */

const SECULAR =
  /\b(weather|forecast|temperature|rain|snow|stock|stocks|crypto|bitcoin|nfl|nba|mlb|soccer|baseball|basketball|score|recipe|cook|cooking|movie|netflix|youtube|password|wifi|router|invoice|python|javascript|typescript|css|html|sql|react|node|npm|email|calculator)\b/;
const BIBLICAL =
  /\b(god|jesus|christ|lord|bible|scripture|verse|gospel|spirit|holy|sin|grace|faith|heaven|prophet|disciple|apostle|psalm|covenant|salvation|prayer|messiah|kingdom)\b/;

function isClearlyOffTopic(lower: string): boolean {
  return SECULAR.test(lower) && !BIBLICAL.test(lower);
}

/* ---- Classifier ---- */

const AUTHOR_TRIGGER =
  /\b(who\s+(wrote|authored|penned|composed)|who\s+is\s+the\s+author\s+of|authorship\s+of|author\s+of\s+the\s+book)\b/;
const BIO_TRIGGER =
  /\b(?:who\s+(?:was|is|were)|tell\s+me\s+about|who'?s)\s+([a-z][a-z'\s.]*?)(?:\s+in\s+the\s+bible)?\s*[?.!]*$/i;

export function classifyQuery(question: string): Classification {
  const text = question.trim();
  const lower = text.toLowerCase();

  // Authorship: an author trigger + a recognizable book.
  if (AUTHOR_TRIGGER.test(lower)) {
    const code = findBookCode(text);
    const meta = code ? BOOK_META[code] : undefined;
    if (meta) return { route: "authorship", bookHits: [meta] };
  }

  // Biography: "who was/is <Name>" or "tell me about <Name>".
  const bio = BIO_TRIGGER.exec(text);
  if (bio) {
    const hits = findPersons(bio[1]);
    if (hits.length) return { route: "biography", personHits: hits };
  }

  // Obvious non-Bible questions get declined without a model call.
  if (isClearlyOffTopic(lower)) return { route: "offtopic" };

  return { route: "topical" };
}
