// @ts-check
/**
 * Build "Map of the Day" JSON from authored specs — the single grounding gate.
 *
 * A spec proposes a centring question, an anchor verse, and a few branches
 * (supporting verses + short observations). This script:
 *   1. validates EVERY reference against the committed BSB corpus and reads the
 *      AUTHORITATIVE verse text from it (an authored quote is never trusted),
 *   2. lays the bubbles out radially (question hub, anchor above, branches fan),
 *   3. writes public/daily-maps/<id>.json and merges public/daily-maps/index.json.
 *
 * Any reference that doesn't resolve fully aborts the build — a map is never
 * published with a verse that isn't really in Scripture. This is the same
 * "never fabricate a verse" backstop the Ask assistant uses (lib/qa/server-bible).
 *
 * Usage:
 *   node scripts/build-daily-maps.mjs [--specs path] [--start YYYY-MM-DD]
 *                                     [--version BSB] [--fresh]
 *   --fresh   rebuild index.json from only these specs (default: merge/append)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIBLE_DIR = path.join(ROOT, "public", "bible");
const OUT_DIR = path.join(ROOT, "public", "daily-maps");

/* --------------------------------- args ---------------------------------- */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}
const SPECS_PATH = path.resolve(
  ROOT,
  arg("specs", "scripts/daily-map-specs.json"),
);
const VERSION = arg("version", "BSB");
const FRESH = process.argv.includes("--fresh");

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const START = arg("start", todayKey());

/* ------------------------- corpus + reference parser --------------------- */

/** @typedef {{ code: string, name: string, chapters: string[][] }} BookData */

/** @type {Map<string, BookData>} byCode */
const byCode = new Map();
/** @type {Map<string, string>} normalized name/code -> code */
const byName = new Map();

// Short forms the prefix match can't resolve (ported from lib/bible.ts).
const ALIASES = {
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
  psalm: "Ps",
  prv: "Prov",
  ecc: "Eccl",
  sos: "Song",
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

async function loadCorpus() {
  const entries = await fs.readdir(BIBLE_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
  for (const f of files) {
    /** @type {BookData} */
    const book = JSON.parse(
      await fs.readFile(path.join(BIBLE_DIR, f.name), "utf8"),
    );
    if (!book.code || !Array.isArray(book.chapters)) continue;
    byCode.set(book.code, book);
    byName.set(book.name.toLowerCase(), book.code);
    byName.set(book.code.toLowerCase(), book.code);
  }
  if (!byCode.size) throw new Error(`No BSB corpus found in ${BIBLE_DIR}`);
}

function findBookCode(raw) {
  const q = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!q) return null;
  const aliased = ALIASES[q.replace(/ /g, "")] ?? ALIASES[q];
  if (aliased) return aliased;
  if (byName.has(q)) return byName.get(q);
  // prefix match (e.g. "philipp" -> Philippians)
  for (const [name, code] of byName) if (name.startsWith(q)) return code;
  return null;
}

/** Parse "John 3:16" -> { code, chapter, verse }. */
function parseRef(input) {
  const m = input
    .trim()
    .match(/^(\d?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.,v]\s*(\d+))?$/);
  if (!m) return null;
  const code = findBookCode(m[1]);
  if (!code) return null;
  const book = byCode.get(code);
  if (!book) return null;
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : 1;
  if (chapter < 1 || chapter > book.chapters.length || verse < 1) return null;
  return { code, chapter, verse };
}

/** Parse a single-book range: "Heb 7:1-3", "John 3:14–15", "Heb 7:1-8:2". */
function parseRange(input) {
  const trimmed = input.trim();
  const m = trimmed.match(/^(.*?\d)\s*[–—-]\s*(\d+(?::\d+)?)\s*$/);
  if (!m) {
    const start = parseRef(trimmed);
    return start ? { start, end: start } : null;
  }
  const start = parseRef(m[1]);
  if (!start) return null;
  const tail = m[2];
  if (tail.includes(":")) {
    const [c, v] = tail.split(":").map(Number);
    return { start, end: { code: start.code, chapter: c, verse: v } };
  }
  return {
    start,
    end: { code: start.code, chapter: start.chapter, verse: Number(tail) },
  };
}

function fullName(code) {
  return byCode.get(code)?.name ?? code;
}

function formatRange(r) {
  const s = `${fullName(r.start.code)} ${r.start.chapter}:${r.start.verse}`;
  if (r.start.chapter === r.end.chapter && r.start.verse === r.end.verse) {
    return s;
  }
  if (r.start.chapter === r.end.chapter) return `${s}–${r.end.verse}`;
  return `${s}–${r.end.chapter}:${r.end.verse}`;
}

/** Authoritative text for a range, or null if ANY verse is missing. */
function readSpan(r) {
  const book = byCode.get(r.start.code);
  if (!book) return null;
  const parts = [];
  for (let c = r.start.chapter; c <= r.end.chapter; c++) {
    const verses = book.chapters[c - 1];
    if (!verses) return null;
    const from = c === r.start.chapter ? r.start.verse : 1;
    const to = c === r.end.chapter ? r.end.verse : verses.length;
    for (let v = from; v <= to; v++) {
      const text = verses[v - 1];
      if (!text) return null;
      parts.push(text);
    }
  }
  const joined = parts.join(" ").trim();
  return joined || null;
}

/** Validate a reference and return its canonical form + corpus text. */
function validate(rawRef) {
  const cleaned = rawRef.trim().replace(/[.,;]+$/, "");
  const range = parseRange(cleaned);
  if (!range) throw new Error(`Unparseable reference: "${rawRef}"`);
  const text = readSpan(range);
  if (!text) throw new Error(`Reference not in corpus: "${rawRef}"`);
  return { ref: formatRange(range), text };
}

/* ------------------------------- layout ---------------------------------- */

function slugify(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "map"
  );
}

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Deterministic radial layout: question hub, anchor above, branches fanned. */
function layout(branchCount) {
  const positions = {
    question: { x: 0, y: 0 },
    anchor: { x: 0, y: -240 },
    branches: /** @type {{x:number,y:number}[]} */ ([]),
  };
  const k = branchCount;
  const R = 360 + k * 18;
  // Sweep a wide lower arc centred on "straight down" (90°), avoiding the top
  // cone where the anchor sits. ±110° of span keeps a tidy fan.
  const spanDeg = Math.min(220, Math.max(60, (k - 1) * 52));
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0 : i / (k - 1) - 0.5; // -0.5..0.5
    const deg = 90 + t * spanDeg;
    const rad = (deg * Math.PI) / 180;
    // Gentle deterministic jitter so the fan feels hand-placed, not mechanical.
    const jitter = ((i * 37) % 11) - 5;
    positions.branches.push({
      x: Math.round(Math.cos(rad) * (R + jitter)),
      y: Math.round(Math.sin(rad) * (R + jitter)) - 40,
    });
  }
  return positions;
}

/* ------------------------------- build ----------------------------------- */

function buildMap(spec, date) {
  // A daily map is a STARTER kit, not a finished study: the question plus a
  // few verse bubbles around it. We deliberately do NOT render any authored
  // commentary — only the question and Scripture — so the reader draws the
  // connections (and their own observations) themselves.
  const verseBranches = (spec.branches ?? []).filter((b) => b.kind === "verse");
  const pos = layout(verseBranches.length);

  const anchor = validate(spec.anchorRef);

  /** @type {any[]} */
  const nodes = [];
  /** @type {any[]} */
  const edges = [];

  // Order matters: question first → earliest id → emphasised anchor on save.
  // The question is the hub; every starter verse hangs off it with a light
  // (manual) link, leaving the verse-to-verse cross-references for the reader.
  nodes.push({
    id: "q",
    type: "question",
    position: pos.question,
    content: spec.question,
  });
  nodes.push({
    id: "anchor",
    type: "verse",
    position: pos.anchor,
    verseRef: anchor.ref,
    verseText: anchor.text,
  });
  edges.push({
    id: "e-q-anchor",
    source: "q",
    target: "anchor",
    kind: "manual",
  });

  verseBranches.forEach((b, i) => {
    const id = `b${i + 1}`;
    const v = validate(b.ref);
    nodes.push({
      id,
      type: "verse",
      position: pos.branches[i],
      verseRef: v.ref,
      verseText: v.text,
    });
    edges.push({ id: `e-q-${id}`, source: "q", target: id, kind: "manual" });
  });

  const id = `${date}-${slugify(spec.title)}`;
  return {
    id,
    date,
    title: spec.title.trim(),
    question: spec.question.trim(),
    anchorRef: anchor.ref,
    blurb: (spec.blurb ?? "").trim(),
    version: VERSION,
    nodes,
    edges,
  };
}

async function readJsonIfExists(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  await loadCorpus();
  console.log(`Loaded ${byCode.size} BSB books.`);

  const specs = JSON.parse(await fs.readFile(SPECS_PATH, "utf8"));
  if (!Array.isArray(specs) || !specs.length) {
    throw new Error(`No specs found in ${SPECS_PATH}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const indexPath = path.join(OUT_DIR, "index.json");
  const existing = FRESH ? null : await readJsonIfExists(indexPath);
  /** @type {Map<string, any>} id -> meta */
  const metaById = new Map((existing?.maps ?? []).map((m) => [m.id, m]));

  let built = 0;
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const date = spec.date ?? addDays(START, i);
    const map = buildMap(spec, date);
    await fs.writeFile(
      path.join(OUT_DIR, `${map.id}.json`),
      JSON.stringify(map, null, 2) + "\n",
      "utf8",
    );
    metaById.set(map.id, {
      id: map.id,
      date: map.date,
      title: map.title,
      question: map.question,
      anchorRef: map.anchorRef,
      blurb: map.blurb,
    });
    built++;
    console.log(`✓ ${map.date}  ${map.title}  (${map.anchorRef})`);
  }

  const maps = [...metaById.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const index = { generatedAt: new Date().toISOString(), maps };
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");

  console.log(
    `\nBuilt ${built} map(s). Index now lists ${maps.length} total → ${path.relative(ROOT, indexPath)}`,
  );
}

main().catch((err) => {
  console.error(`\n✗ build-daily-maps failed: ${err.message}`);
  process.exit(1);
});
