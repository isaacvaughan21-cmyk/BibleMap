import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bm25Search, tokenize, type Bm25Index } from "./bm25";
import { expandTopics } from "./topic-seeds";
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
type Index = { bm25: Bm25Index; units: Unit[] };

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
        return {
          bm25: JSON.parse(bm25Raw) as Bm25Index,
          units: JSON.parse(unitsRaw) as Unit[],
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

  const tokens = tokenize(question, { query: true });
  if (!tokens.length) return [];
  const queryTokens = [...tokens, ...expandTopics(tokens)];

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
