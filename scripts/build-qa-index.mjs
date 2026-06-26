/**
 * Builds the local retrieval index for the "Ask Scripture" assistant from the
 * already-committed corpus (public/bible). One-time/offline, same conventions
 * as scripts/build-bible-data.mjs; the outputs are committed and shipped.
 *
 *   node scripts/build-qa-index.mjs                 # BM25 over BSB (default)
 *   node scripts/build-qa-index.mjs --version=KJV   # build against another bundled version
 *   node scripts/build-qa-index.mjs --embed         # also write a local vector index
 *
 * Outputs (data/qa-index/):
 *   bm25.json            — inverted index { avgdl, unitCount, doclen, terms }
 *   units.json           — parallel unit table [{ s: startOSIS, e?: endOSIS }]
 *   manifest.json        — build metadata
 *   embeddings.bin       — (only with --embed) int8 quantized MiniLM vectors
 *   embeddings-meta.json — (only with --embed) { model, dim, count }
 *
 * Units are per-verse plus 3-verse sliding windows (stride 2) for passage
 * context; window text is reconstructed from the corpus at answer time, so the
 * unit table stores OSIS references only (no duplicated verse text).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BIBLE_DIR = resolve(ROOT, "public/bible");
const OUT_DIR = resolve(ROOT, "data/qa-index");

const args = process.argv.slice(2);
const VERSION =
  args.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "BSB";
const EMBED = args.includes("--embed");
const SRC_DIR = VERSION === "BSB" ? BIBLE_DIR : join(BIBLE_DIR, VERSION);

const WINDOW_SIZE = 3;
const WINDOW_STRIDE = 2;

/** STOPWORDS — keep in sync with lib/qa/bm25.ts (index side: STOPWORDS only). */
const STOPWORDS = new Set([
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

function tokenize(text) {
  const out = [];
  for (const w of text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

/* ---- 1. Build the unit list from the corpus ---- */
const bookFiles = readdirSync(SRC_DIR).filter((f) => /\.json$/.test(f));
if (bookFiles.length === 0) {
  console.error(`No book JSON found in ${SRC_DIR}`);
  process.exit(1);
}

const units = []; // { s, e? }
const docTokens = []; // tokens per unit (parallel to units)
const unitText = []; // original text per unit — only used for --embed

for (const file of bookFiles) {
  const data = JSON.parse(readFileSync(join(SRC_DIR, file), "utf8"));
  const { code, chapters } = data;
  for (let ci = 0; ci < chapters.length; ci++) {
    const verses = chapters[ci];
    if (!verses) continue;
    const ch = ci + 1;

    // per-verse units
    for (let vi = 0; vi < verses.length; vi++) {
      const text = verses[vi];
      if (!text) continue;
      units.push({ s: `${code}.${ch}.${vi + 1}` });
      docTokens.push(tokenize(text));
      if (EMBED) unitText.push(text);
    }

    // 3-verse window units (stride 2) within the chapter
    for (
      let start = 0;
      start + WINDOW_SIZE <= verses.length;
      start += WINDOW_STRIDE
    ) {
      const slice = verses.slice(start, start + WINDOW_SIZE);
      if (slice.some((t) => !t)) continue;
      const joined = slice.join(" ");
      units.push({
        s: `${code}.${ch}.${start + 1}`,
        e: `${code}.${ch}.${start + WINDOW_SIZE}`,
      });
      docTokens.push(tokenize(joined));
      if (EMBED) unitText.push(joined);
    }
  }
}

/* ---- 2. Build the BM25 inverted index ---- */
const N = units.length;
const doclen = new Array(N);
const terms = Object.create(null); // term -> { df, postings: [docId, tf][] }
let totalLen = 0;

for (let d = 0; d < N; d++) {
  const toks = docTokens[d];
  doclen[d] = toks.length;
  totalLen += toks.length;
  const tf = new Map();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [t, f] of tf) {
    let entry = terms[t];
    if (!entry) {
      entry = { df: 0, postings: [] };
      terms[t] = entry;
    }
    entry.df += 1;
    entry.postings.push([d, f]);
  }
}
const avgdl = N ? totalLen / N : 0;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "bm25.json"),
  JSON.stringify({ avgdl, unitCount: N, doclen, terms }),
);
writeFileSync(join(OUT_DIR, "units.json"), JSON.stringify(units));
writeFileSync(
  join(OUT_DIR, "manifest.json"),
  JSON.stringify(
    {
      version: VERSION,
      unitCount: N,
      termCount: Object.keys(terms).length,
      windowSize: WINDOW_SIZE,
      windowStride: WINDOW_STRIDE,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(
  `qa-index: ${N} units, ${Object.keys(terms).length} terms, avgdl ${avgdl.toFixed(1)} (version ${VERSION})`,
);

/* ---- 3. Optional: local embeddings (spec's vector index) ---- */
if (EMBED) {
  try {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
    const DIM = 384;
    console.log(`Embedding ${N} units with ${MODEL_ID} (this takes a while)…`);
    const extractor = await pipeline("feature-extraction", MODEL_ID);
    const mat = new Int8Array(N * DIM);
    for (let d = 0; d < N; d++) {
      const output = await extractor(unitText[d], {
        pooling: "mean",
        normalize: true,
      });
      const vec = output.data;
      for (let i = 0; i < DIM; i++) {
        mat[d * DIM + i] = Math.max(
          -127,
          Math.min(127, Math.round(vec[i] * 127)),
        );
      }
      if (d % 2000 === 0) console.log(`  ${d}/${N}`);
    }
    writeFileSync(join(OUT_DIR, "embeddings.bin"), Buffer.from(mat.buffer));
    writeFileSync(
      join(OUT_DIR, "embeddings-meta.json"),
      JSON.stringify({ model: MODEL_ID, dim: DIM, count: N }, null, 2),
    );
    console.log(`embeddings: ${N} vectors × ${DIM} dims (int8) written.`);
  } catch (err) {
    console.warn(
      "Embeddings skipped. Install the optional dependency to enable: npm i -D @xenova/transformers",
    );
    console.warn(String(err?.message ?? err));
  }
}
