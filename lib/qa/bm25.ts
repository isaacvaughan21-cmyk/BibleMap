/**
 * Pure-TypeScript BM25 — the always-on retrieval core for the Ask assistant.
 *
 * No native deps, no model, no network. The build script
 * (scripts/build-qa-index.mjs) tokenizes with the SAME rules (mirror the
 * STOPWORDS set and `tokenize` logic when editing either) so a query's tokens
 * line up with the indexed tokens.
 */

/** Function words dropped from BOTH the index and queries. */
export const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "do",
  "does",
  "did",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "him",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "nor",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "she",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "unto",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/**
 * Extra words dropped from QUERIES only — generic framing that adds noise to a
 * topical search ("what does the BIBLE SAY about grace" → "grace"). They stay
 * in the index so a verse that genuinely contains them is still findable.
 */
export const QUERY_STOPWORDS = new Set([
  "bible",
  "scripture",
  "scriptures",
  "verse",
  "verses",
  "passage",
  "passages",
  "say",
  "says",
  "said",
  "tell",
  "about",
  "regarding",
  "concerning",
  "teach",
  "teaches",
  "mean",
  "means",
  "according",
  // Authorship framing — not topical content (a stray "who wrote X" shouldn't
  // search on "wrote"); the router answers real authorship questions instead.
  "wrote",
  "write",
  "writes",
  "written",
  "author",
  "authored",
  "penned",
  "composed",
]);

/** Lowercase, strip non-letters, drop stopwords + 1-char tokens. */
export function tokenize(text: string, opts?: { query?: boolean }): string[] {
  const out: string[] = [];
  for (const w of text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)) {
    if (w.length < 2) continue;
    if (STOPWORDS.has(w)) continue;
    if (opts?.query && QUERY_STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

export type Bm25Index = {
  avgdl: number;
  unitCount: number;
  /** Document length per unit, indexed by unit id (array position). */
  doclen: number[];
  /** term → { document frequency, [unitId, term frequency][] }. */
  terms: Record<string, { df: number; postings: [number, number][] }>;
};

const K1 = 1.5;
const B = 0.75;

/** Top-N unit ids scored by BM25 over the (already-tokenized) query. */
export function bm25Search(
  index: Bm25Index,
  queryTokens: string[],
  topN: number,
): { docId: number; score: number }[] {
  const N = index.unitCount || 1;
  const qf = new Map<string, number>();
  for (const t of queryTokens) qf.set(t, (qf.get(t) ?? 0) + 1);

  const scores = new Map<number, number>();
  for (const [term, count] of qf) {
    const entry = index.terms[term];
    if (!entry) continue;
    const idf = Math.log(1 + (N - entry.df + 0.5) / (entry.df + 0.5));
    const qWeight = Math.min(count, 3);
    for (const [docId, tf] of entry.postings) {
      const dl = index.doclen[docId] ?? index.avgdl;
      const denom = tf + K1 * (1 - B + (B * dl) / index.avgdl);
      const inc = idf * ((tf * (K1 + 1)) / denom) * qWeight;
      scores.set(docId, (scores.get(docId) ?? 0) + inc);
    }
  }

  return [...scores.entries()]
    .map(([docId, score]) => ({ docId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
