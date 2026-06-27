import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bm25Search, tokenize, type Bm25Index } from "./bm25";
import { expandTopics, TOPIC_SEEDS } from "./topic-seeds";
import { correctWord } from "./spell";
import { validateOsis } from "./server-bible";
import type { Testament, ValidatedCitation } from "./types";
import { BOOKS } from "@/lib/bible-books";
import { DEFAULT_VERSION } from "@/lib/versions";

const TESTAMENT_BY_CODE = new Map(BOOKS.map((b) => [b.code, b.testament]));

/**
 * BM25 retrieval over the committed index (data/qa-index/), loaded once and
 * cached as a module singleton (warm across serverless invocations). No model,
 * no network. Topic-synonym expansion widens recall; overlapping passages are
 * collapsed; every returned passage is corpus-validated.
 *
 * If the index can't be read (e.g. the build step was skipped), retrieval
 * returns [] and the caller degrades to a graceful "no relevant passages".
 */

/** Compact unit record stored in units.json — `s`=start OSIS, `e`=optional end OSIS. */
type Unit = { s: string; e?: string };
type Index = { bm25: Bm25Index; units: Unit[]; vocabByFreq: string[] };

let indexPromise: Promise<Index | null> | null = null;

function loadIndex(): Promise<Index | null> {
  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        const dir = path.join(process.cwd(), "data", "qa-index");
        const [bm25Raw, unitsRaw] = await Promise.all([
          fs.readFile(path.join(dir, "bm25.json"), "utf8"),
          fs.readFile(path.join(dir, "units.json"), "utf8"),
        ]);
        const bm25 = JSON.parse(bm25Raw) as Bm25Index;
        return {
          bm25,
          units: JSON.parse(unitsRaw) as Unit[],
          // Vocabulary, most-common first — the target set for typo correction.
          vocabByFreq: Object.keys(bm25.terms).sort(
            (a, b) => bm25.terms[b].df - bm25.terms[a].df,
          ),
        };
      } catch (err) {
        console.error("hodos: failed to load qa-index", err);
        return null;
      }
    })();
    // If it failed, allow a later call to retry instead of caching the failure.
    void indexPromise.then((v) => {
      if (!v) indexPromise = null;
    });
  }
  return indexPromise;
}

const SCORE_FLOOR = 0.4; // below this on every hit → no relevant passages
const POOL = 60; // BM25 candidates considered before overlap-collapse
const MAX_PASSAGES = 12; // distinct passages handed to the model

export type Candidate = ValidatedCitation & {
  osisStart: string;
  osisEnd?: string;
};

function osisSpan(
  unit: Unit,
): { code: string; ch: number; from: number; to: number } | null {
  const [code, chS, vS] = unit.s.split(".");
  if (!code || !chS || !vS) return null;
  const ch = Number(chS);
  const from = Number(vS);
  let to = from;
  if (unit.e) {
    const vE = unit.e.split(".")[2];
    to = Number(vE) || from;
  }
  return { code, ch, from, to };
}

export async function retrieve(
  question: string,
  version: string = DEFAULT_VERSION,
  testament?: Testament,
): Promise<Candidate[]> {
  const index = await loadIndex();
  if (!index) return [];

  const rawTokens = tokenize(question, { query: true });
  if (!rawTokens.length) return [];

  // Typo handling: keep words the corpus knows (or that a topic seed expands),
  // fix a likely misspelling to the nearest corpus word with the same first
  // letter ("graec" → "grace"), and DROP anything still unknown so a typo can't
  // pull unrelated verses. No content words left ⇒ a graceful "no passages".
  const content: string[] = [];
  for (const t of rawTokens) {
    if (index.bm25.terms[t] || TOPIC_SEEDS[t]) {
      content.push(t);
      continue;
    }
    const fixed = correctWord(t, index.vocabByFreq, t.length <= 4 ? 1 : 2);
    if (fixed && fixed[0] === t[0]) content.push(fixed);
  }
  if (!content.length) return [];
  const queryTokens = [...content, ...expandTopics(content)];

  // A wider pool when filtering by testament, so the half we keep still fills up.
  const pool = testament ? POOL * 3 : POOL;
  const hits = bm25Search(index.bm25, queryTokens, pool).filter(
    (h) => h.score >= SCORE_FLOOR,
  );

  const out: Candidate[] = [];
  const accepted: { code: string; ch: number; from: number; to: number }[] = [];
  for (const hit of hits) {
    const unit = index.units[hit.docId];
    if (!unit) continue;
    const span = osisSpan(unit);
    if (!span) continue;
    if (testament && TESTAMENT_BY_CODE.get(span.code) !== testament) continue;
    // Skip a passage already fully covered by an accepted one.
    const covered = accepted.some(
      (a) =>
        a.code === span.code &&
        a.ch === span.ch &&
        a.from <= span.from &&
        a.to >= span.to,
    );
    if (covered) continue;
    const v = await validateOsis(unit.s, unit.e, version);
    if (!v) continue;
    accepted.push(span);
    out.push({ ...v, osisStart: unit.s, osisEnd: unit.e });
    if (out.length >= MAX_PASSAGES) break;
  }
  return out;
}

/**
 * Spell-correct each word of a short topic phrase for display — so the framing
 * shown to the reader matches the corrected search ("graec" → "grace"). Keeps
 * known, seeded, and short words as-is.
 */
export async function spellFixPhrase(phrase: string): Promise<string> {
  const index = await loadIndex();
  if (!index) return phrase;
  return phrase
    .split(/\s+/)
    .map((w) => {
      const lw = w.toLowerCase();
      if (lw.length < 4 || index.bm25.terms[lw] || TOPIC_SEEDS[lw]) return w;
      const fixed = correctWord(lw, index.vocabByFreq, lw.length <= 4 ? 1 : 2);
      return fixed && fixed[0] === lw[0] ? fixed : w;
    })
    .join(" ");
}
