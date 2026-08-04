// One-off generator for the demo canvas .hodos.json.
// Reads verbatim BSB verse text from public/bible/{code}.json and assembles a
// deeply-nested map. Run: node scripts/gen-demo-canvas.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BIBLE = join(ROOT, "public", "bible");

const cache = new Map();
function verse(code, ch, v) {
  if (!cache.has(code)) {
    cache.set(
      code,
      JSON.parse(readFileSync(join(BIBLE, `${code}.json`), "utf8")),
    );
  }
  const book = cache.get(code);
  const text = book.chapters?.[ch - 1]?.[v - 1];
  if (typeof text !== "string") {
    throw new Error(`Missing verse ${code} ${ch}:${v}`);
  }
  return text;
}

// Deterministic timestamps (Date.now is fine in a plain node script, but keep
// it stable so re-runs produce identical files for clean diffs).
const T0 = 1749513600000; // 2026-06-10T00:00:00Z
let tick = 0;
const stamp = () => T0 + tick++ * 1000;

const nodes = [];
const edges = [];

/** Add a node. type: question|verse|note */
function node(id, mapId, type, opts = {}) {
  const ts = stamp();
  const n = {
    id,
    mapId,
    type,
    content: type === "verse" ? "" : (opts.content ?? ""),
    position: { x: opts.x ?? 0, y: opts.y ?? 0 },
    createdAt: ts,
    updatedAt: ts,
  };
  if (type === "verse") {
    n.verseRef = opts.ref;
    n.verseText = verse(opts.code, opts.ch, opts.v);
  }
  nodes.push(n);
  return n;
}

let edgeSeq = 0;
function edge(mapId, source, target, kind = "manual") {
  const ts = stamp();
  edges.push({
    id: `e${++edgeSeq}`,
    mapId,
    source,
    target,
    kind,
    createdAt: ts,
    updatedAt: ts,
  });
}

// ---------------------------------------------------------------------------
// ROOT MAP — the showpiece. ~29 bubbles in themed clusters radiating out from
// the central question, generously cross-linked.
// ---------------------------------------------------------------------------
const R = "root";

// — center: who is Melchizedek? —
node("q-mel", R, "question", {
  content:
    "Who is Melchizedek, and why does the Bible keep circling back to him?",
  x: 0,
  y: 0,
});
node("v-gen1418", R, "verse", {
  ref: "Genesis 14:18",
  code: "Gen",
  ch: 14,
  v: 18,
  x: -360,
  y: 230,
});
node("v-heb71", R, "verse", {
  ref: "Hebrews 7:1",
  code: "Heb",
  ch: 7,
  v: 1,
  x: 360,
  y: 230,
});
node("v-heb73", R, "verse", {
  ref: "Hebrews 7:3",
  code: "Heb",
  ch: 7,
  v: 3,
  x: 0,
  y: 330,
});
node("q-abraham", R, "question", {
  content: "Why does Abraham's response to Melchizedek matter so much?",
  x: 400,
  y: -300,
});
node("n-root1", R, "note", {
  content:
    "My take: Melchizedek shows up for three verses in Genesis, one line in the Psalms, then a whole chapter in Hebrews. The disproportion feels deliberate — like a seed planted early and harvested late.",
  x: -400,
  y: -300,
});

// — top: without genealogy —
node("q-genealogy", R, "question", {
  content: "Why is he 'without father or mother or genealogy'?",
  x: 0,
  y: -580,
});
node("v-heb78", R, "verse", {
  ref: "Hebrews 7:8",
  code: "Heb",
  ch: 7,
  v: 8,
  x: 340,
  y: -640,
});
node("n-root2", R, "note", {
  content:
    "The author of Hebrews seems to read the SILENCE of Genesis as testimony — what Scripture doesn't say about him carries weight too. That way of reading feels worth learning slowly.",
  x: -340,
  y: -660,
});

// — right: superiority + the oath of Psalm 110 —
node("q-superior", R, "question", {
  content: "What makes his priesthood superior to the Levitical one?",
  x: 720,
  y: -40,
});
node("v-ps1104", R, "verse", {
  ref: "Psalm 110:4",
  code: "Ps",
  ch: 110,
  v: 4,
  x: 720,
  y: 260,
});
node("q-oath", R, "question", {
  content: "Why does God confirm this priesthood with an oath?",
  x: 1100,
  y: -240,
});
node("v-heb721", R, "verse", {
  ref: "Hebrews 7:21",
  code: "Heb",
  ch: 7,
  v: 21,
  x: 1120,
  y: 60,
});
node("v-heb620", R, "verse", {
  ref: "Hebrews 6:20",
  code: "Heb",
  ch: 6,
  v: 20,
  x: 1100,
  y: 360,
});
node("v-heb56", R, "verse", {
  ref: "Hebrews 5:6",
  code: "Heb",
  ch: 5,
  v: 6,
  x: 760,
  y: 560,
});
node("v-ps1101", R, "verse", {
  ref: "Psalm 110:1",
  code: "Ps",
  ch: 110,
  v: 1,
  x: 340,
  y: 560,
});
node("n-root5", R, "note", {
  content:
    "Something I noticed while tracing references: the New Testament reaches for Psalm 110 more than any other psalm. The early church clearly heard Jesus in every line of it.",
  x: 1180,
  y: 640,
});

// — far right: king AND priest in one person —
node("q-priestking", R, "question", {
  content: "How can one man hold both the throne and the altar?",
  x: 1500,
  y: -40,
});
node("v-zech613", R, "verse", {
  ref: "Zechariah 6:13",
  code: "Zech",
  ch: 6,
  v: 13,
  x: 1520,
  y: 280,
});
node("n-root3", R, "note", {
  content:
    "Israel kept crown and priesthood strictly apart — Uzziah was struck down for crossing that line. So a figure who carries both at once feels like a signpost pointing past the whole system.",
  x: 1500,
  y: -360,
});

// — left: a priest forever + present-tense intercession —
node("q-forever", R, "question", {
  content: "What does it actually mean to be 'a priest forever'?",
  x: -720,
  y: -40,
});
node("q-intercede", R, "question", {
  content: "What is Jesus doing for us right now as our High Priest?",
  x: -1140,
  y: -260,
});
node("v-heb81", R, "verse", {
  ref: "Hebrews 8:1",
  code: "Heb",
  ch: 8,
  v: 1,
  x: -1140,
  y: 40,
});
node("v-rom834", R, "verse", {
  ref: "Romans 8:34",
  code: "Rom",
  ch: 8,
  v: 34,
  x: -1480,
  y: -60,
});
node("v-heb726", R, "verse", {
  ref: "Hebrews 7:26",
  code: "Heb",
  ch: 7,
  v: 26,
  x: -1480,
  y: -360,
});

// — bottom left: born again + the throne of grace —
node("q-bornagain", R, "question", {
  content: "How does being 'born again' connect to an eternal priesthood?",
  x: -720,
  y: 300,
});
node("v-heb415", R, "verse", {
  ref: "Hebrews 4:15",
  code: "Heb",
  ch: 4,
  v: 15,
  x: -1060,
  y: 560,
});
node("v-heb416", R, "verse", {
  ref: "Hebrews 4:16",
  code: "Heb",
  ch: 4,
  v: 16,
  x: -1420,
  y: 480,
});
node("n-root4", R, "note", {
  content:
    "What gets me: because the Priest lives forever, the invitation is to draw near with CONFIDENCE — not to tiptoe. I want to pray like that's true.",
  x: -720,
  y: 620,
});

// center hub-and-spoke
edge(R, "q-mel", "v-gen1418");
edge(R, "q-mel", "v-heb71");
edge(R, "q-mel", "v-heb73");
edge(R, "q-mel", "n-root1");
edge(R, "q-mel", "q-genealogy");
edge(R, "q-mel", "q-superior");
edge(R, "q-mel", "q-forever");
edge(R, "q-mel", "q-bornagain");
edge(R, "q-mel", "q-abraham");
// genealogy cluster
edge(R, "q-genealogy", "v-heb73");
edge(R, "q-genealogy", "v-heb78");
edge(R, "q-genealogy", "n-root2");
// oath / Psalm 110 cluster
edge(R, "q-superior", "v-ps1104");
edge(R, "q-superior", "q-oath");
edge(R, "q-oath", "v-heb721");
edge(R, "q-oath", "v-ps1104");
edge(R, "v-heb56", "n-root5");
// priest-king cluster
edge(R, "q-priestking", "v-zech613");
edge(R, "q-priestking", "n-root3");
edge(R, "q-oath", "q-priestking");
// intercession cluster
edge(R, "q-forever", "q-intercede");
edge(R, "q-intercede", "v-rom834");
edge(R, "q-intercede", "v-heb81");
edge(R, "q-intercede", "v-heb726");
// throne of grace chain
edge(R, "q-intercede", "v-heb415");
edge(R, "v-heb415", "v-heb416");
edge(R, "v-heb416", "n-root4");
// cross-references stringing the clusters together
edge(R, "v-gen1418", "v-ps1104", "crossref");
edge(R, "v-ps1104", "v-heb71", "crossref");
edge(R, "v-gen1418", "v-heb71", "crossref");
edge(R, "v-ps1104", "v-heb721", "crossref");
edge(R, "v-ps1104", "v-heb56", "crossref");
edge(R, "v-ps1104", "v-heb620", "crossref");
edge(R, "v-ps1101", "v-ps1104", "crossref");
edge(R, "v-ps1101", "v-heb81", "crossref");
edge(R, "v-zech613", "v-gen1418", "crossref");
edge(R, "v-rom834", "v-heb81", "crossref");

// ---------------------------------------------------------------------------
// L2 — q-mel : Genesis 14 scene
// ---------------------------------------------------------------------------
const M = "q-mel";
node("anchor-mel", M, "question", {
  content:
    "Who is Melchizedek, and why does the Bible keep circling back to him?",
  x: 0,
  y: 0,
});
node("v-gen1417", M, "verse", {
  ref: "Genesis 14:17",
  code: "Gen",
  ch: 14,
  v: 17,
  x: -380,
  y: -210,
});
node("v-gen1418b", M, "verse", {
  ref: "Genesis 14:18",
  code: "Gen",
  ch: 14,
  v: 18,
  x: 360,
  y: -210,
});
node("v-gen1419", M, "verse", {
  ref: "Genesis 14:19",
  code: "Gen",
  ch: 14,
  v: 19,
  x: 400,
  y: 180,
});
node("v-gen1420", M, "verse", {
  ref: "Genesis 14:20",
  code: "Gen",
  ch: 14,
  v: 20,
  x: -400,
  y: 220,
});
node("q-breadwine", M, "question", {
  content: "Why bread and wine — and why does that detail echo so far forward?",
  x: 0,
  y: 360,
});
node("n-mel1", M, "note", {
  content:
    "He simply appears — king and priest at once — blesses Abraham, and is gone. No introduction, no exit. It reads less like a biography and more like a glimpse of something larger.",
  x: 760,
  y: 0,
});
edge(M, "anchor-mel", "v-gen1417");
edge(M, "anchor-mel", "v-gen1418b");
edge(M, "anchor-mel", "n-mel1");
edge(M, "v-gen1418b", "v-gen1419");
edge(M, "v-gen1419", "v-gen1420");
edge(M, "v-gen1418b", "q-breadwine");

// ---------------------------------------------------------------------------
// L3 — q-breadwine : the bread & wine thread
// ---------------------------------------------------------------------------
const BW = "q-breadwine";
node("anchor-breadwine", BW, "question", {
  content: "Why bread and wine — and why does that detail echo so far forward?",
  x: 0,
  y: 0,
});
node("v-matt2626", BW, "verse", {
  ref: "Matthew 26:26",
  code: "Matt",
  ch: 26,
  v: 26,
  x: -380,
  y: 200,
});
node("v-matt2627", BW, "verse", {
  ref: "Matthew 26:27",
  code: "Matt",
  ch: 26,
  v: 27,
  x: 0,
  y: 320,
});
node("v-matt2628", BW, "verse", {
  ref: "Matthew 26:28",
  code: "Matt",
  ch: 26,
  v: 28,
  x: 380,
  y: 200,
});
node("q-newcov", BW, "question", {
  content:
    "Is the meal Melchizedek brought a faint sketch of the new covenant?",
  x: 380,
  y: -220,
});
node("n-bw1", BW, "note", {
  content:
    "I don't want to over-read a single detail, but bread and wine, offered by a priest-king, is hard to pass by once you've sat at the Lord's table.",
  x: -380,
  y: -220,
});
edge(BW, "anchor-breadwine", "v-matt2626");
edge(BW, "anchor-breadwine", "n-bw1");
edge(BW, "v-matt2626", "v-matt2627");
edge(BW, "v-matt2627", "v-matt2628");
edge(BW, "anchor-breadwine", "q-newcov");
edge(BW, "v-matt2628", "q-newcov");

// ---------------------------------------------------------------------------
// L4 — q-newcov : the new covenant
// ---------------------------------------------------------------------------
const NC = "q-newcov";
node("anchor-newcov", NC, "question", {
  content:
    "Is the meal Melchizedek brought a faint sketch of the new covenant?",
  x: 0,
  y: 0,
});
node("v-luke2220", NC, "verse", {
  ref: "Luke 22:20",
  code: "Luke",
  ch: 22,
  v: 20,
  x: -360,
  y: 220,
});
node("v-heb915", NC, "verse", {
  ref: "Hebrews 9:15",
  code: "Heb",
  ch: 9,
  v: 15,
  x: 360,
  y: 220,
});
node("n-nc1", NC, "note", {
  content:
    "Reflecting here: the cup is called 'the new covenant in My blood.' If Melchizedek's bread and wine pointed forward at all, this is where the arrow lands for me.",
  x: 0,
  y: 320,
});
edge(NC, "anchor-newcov", "v-luke2220");
edge(NC, "anchor-newcov", "v-heb915");
edge(NC, "v-luke2220", "n-nc1");
edge(NC, "v-luke2220", "v-heb915", "crossref");

// ---------------------------------------------------------------------------
// L2 — q-superior : superiority of the priesthood
// ---------------------------------------------------------------------------
const SU = "q-superior";
node("anchor-superior", SU, "question", {
  content: "What makes his priesthood superior to the Levitical one?",
  x: 0,
  y: 0,
});
node("v-heb74", SU, "verse", {
  ref: "Hebrews 7:4",
  code: "Heb",
  ch: 7,
  v: 4,
  x: -380,
  y: 200,
});
node("v-heb77", SU, "verse", {
  ref: "Hebrews 7:7",
  code: "Heb",
  ch: 7,
  v: 7,
  x: 380,
  y: 200,
});
node("v-heb72", SU, "verse", {
  ref: "Hebrews 7:2",
  code: "Heb",
  ch: 7,
  v: 2,
  x: 0,
  y: 330,
});
node("q-mvl", SU, "question", {
  content: "How does the order of Melchizedek differ from the order of Levi?",
  x: 0,
  y: -330,
});
node("n-sup1", SU, "note", {
  content:
    "The argument that struck me: the greater blesses the lesser. If Abraham — and Levi, still in his body — were blessed by Melchizedek, the ranking seems to settle itself.",
  x: 760,
  y: -40,
});
edge(SU, "anchor-superior", "v-heb74");
edge(SU, "anchor-superior", "v-heb77");
edge(SU, "anchor-superior", "v-heb72");
edge(SU, "anchor-superior", "n-sup1");
edge(SU, "anchor-superior", "q-mvl");

// ---------------------------------------------------------------------------
// L3 — q-mvl : order of Melchizedek vs Levi
// ---------------------------------------------------------------------------
const MVL = "q-mvl";
node("anchor-mvl", MVL, "question", {
  content: "How does the order of Melchizedek differ from the order of Levi?",
  x: 0,
  y: 0,
});
node("v-heb711", MVL, "verse", {
  ref: "Hebrews 7:11",
  code: "Heb",
  ch: 7,
  v: 11,
  x: -390,
  y: 200,
});
node("v-heb712", MVL, "verse", {
  ref: "Hebrews 7:12",
  code: "Heb",
  ch: 7,
  v: 12,
  x: 0,
  y: 320,
});
node("v-heb719", MVL, "verse", {
  ref: "Hebrews 7:19",
  code: "Heb",
  ch: 7,
  v: 19,
  x: 390,
  y: 200,
});
node("q-lawgrace", MVL, "question", {
  content: "Is this the very hinge from Law to grace?",
  x: 0,
  y: -330,
});
node("n-mvl1", MVL, "note", {
  content:
    "My honest read: if perfection had come through the Levitical priesthood, why announce another priest 'in the order of Melchizedek' at all? The new order seems to imply the old one was always provisional.",
  x: 760,
  y: 0,
});
edge(MVL, "anchor-mvl", "v-heb711");
edge(MVL, "anchor-mvl", "n-mvl1");
edge(MVL, "v-heb711", "v-heb712");
edge(MVL, "v-heb712", "v-heb719");
edge(MVL, "anchor-mvl", "q-lawgrace");
edge(MVL, "v-heb719", "q-lawgrace");

// ---------------------------------------------------------------------------
// L4 — q-lawgrace : Law vs grace
// ---------------------------------------------------------------------------
const LG = "q-lawgrace";
node("anchor-lawgrace", LG, "question", {
  content: "Is this the very hinge from Law to grace?",
  x: 0,
  y: 0,
});
node("v-john117", LG, "verse", {
  ref: "John 1:17",
  code: "John",
  ch: 1,
  v: 17,
  x: -380,
  y: -200,
});
node("v-rom614", LG, "verse", {
  ref: "Romans 6:14",
  code: "Rom",
  ch: 6,
  v: 14,
  x: 380,
  y: -200,
});
node("v-gal324", LG, "verse", {
  ref: "Galatians 3:24",
  code: "Gal",
  ch: 3,
  v: 24,
  x: 380,
  y: 200,
});
node("v-gal325", LG, "verse", {
  ref: "Galatians 3:25",
  code: "Gal",
  ch: 3,
  v: 25,
  x: -380,
  y: 200,
});
node("n-lg1", LG, "note", {
  content:
    "Sitting with this: the Law was a guardian until faith came — not the enemy of grace, but its escort. That reframes the whole tension for me.",
  x: 0,
  y: 330,
});
edge(LG, "anchor-lawgrace", "v-john117");
edge(LG, "anchor-lawgrace", "v-rom614");
edge(LG, "anchor-lawgrace", "v-gal324");
edge(LG, "v-gal324", "v-gal325");
edge(LG, "v-gal325", "n-lg1");
edge(LG, "v-john117", "v-rom614", "crossref");

// ---------------------------------------------------------------------------
// L2 — q-forever : a priest forever
// ---------------------------------------------------------------------------
const FV = "q-forever";
node("anchor-forever", FV, "question", {
  content: "What does it actually mean to be 'a priest forever'?",
  x: 0,
  y: 0,
});
node("v-heb716", FV, "verse", {
  ref: "Hebrews 7:16",
  code: "Heb",
  ch: 7,
  v: 16,
  x: -390,
  y: 200,
});
node("v-heb724", FV, "verse", {
  ref: "Hebrews 7:24",
  code: "Heb",
  ch: 7,
  v: 24,
  x: 0,
  y: 320,
});
node("v-heb725", FV, "verse", {
  ref: "Hebrews 7:25",
  code: "Heb",
  ch: 7,
  v: 25,
  x: 390,
  y: 200,
});
node("v-heb717", FV, "verse", {
  ref: "Hebrews 7:17",
  code: "Heb",
  ch: 7,
  v: 17,
  x: 390,
  y: -200,
});
node("n-fv1", FV, "note", {
  content:
    "What lands for me here: because He lives forever, His priesthood never transfers. There's no next-in-line, no vacancy. The intercession just doesn't stop.",
  x: -390,
  y: -200,
});
edge(FV, "anchor-forever", "v-heb716");
edge(FV, "anchor-forever", "v-heb717");
edge(FV, "v-heb716", "v-heb724");
edge(FV, "v-heb724", "v-heb725");
edge(FV, "v-heb725", "n-fv1");
edge(FV, "v-heb716", "v-heb724", "crossref");

// ---------------------------------------------------------------------------
// L2 — q-bornagain : born again (John 3)
// ---------------------------------------------------------------------------
const BA = "q-bornagain";
node("anchor-bornagain", BA, "question", {
  content: "How does being 'born again' connect to an eternal priesthood?",
  x: 0,
  y: 0,
});
node("v-john33", BA, "verse", {
  ref: "John 3:3",
  code: "John",
  ch: 3,
  v: 3,
  x: -390,
  y: 200,
});
node("v-john35", BA, "verse", {
  ref: "John 3:5",
  code: "John",
  ch: 3,
  v: 5,
  x: 0,
  y: 330,
});
node("v-john36", BA, "verse", {
  ref: "John 3:6",
  code: "John",
  ch: 3,
  v: 6,
  x: 390,
  y: 200,
});
node("q-spirit", BA, "question", {
  content: "What is Jesus saying about the Spirit and the wind?",
  x: 0,
  y: -330,
});
node("n-ba1", BA, "note", {
  content:
    "A thought I keep returning to: an everlasting priest serves a people given everlasting life. Maybe 'born again' is the doorway into the very life His priesthood secures.",
  x: 760,
  y: 0,
});
edge(BA, "anchor-bornagain", "v-john33");
edge(BA, "anchor-bornagain", "n-ba1");
edge(BA, "v-john33", "v-john35");
edge(BA, "v-john35", "v-john36");
edge(BA, "anchor-bornagain", "q-spirit");

// ---------------------------------------------------------------------------
// L3 — q-spirit : Spirit & wind
// ---------------------------------------------------------------------------
const SP = "q-spirit";
node("anchor-spirit", SP, "question", {
  content: "What is Jesus saying about the Spirit and the wind?",
  x: 0,
  y: 0,
});
node("v-john37", SP, "verse", {
  ref: "John 3:7",
  code: "John",
  ch: 3,
  v: 7,
  x: -360,
  y: 210,
});
node("v-john38", SP, "verse", {
  ref: "John 3:8",
  code: "John",
  ch: 3,
  v: 8,
  x: 360,
  y: 210,
});
node("v-1pet123", SP, "verse", {
  ref: "1 Peter 1:23",
  code: "1Pet",
  ch: 1,
  v: 23,
  x: 0,
  y: 330,
});
node("n-sp1", SP, "note", {
  content:
    "I love that the same word means wind and Spirit. You don't see the wind — only what it moves. That's about the most honest picture of new birth I can think of.",
  x: 0,
  y: -300,
});
edge(SP, "anchor-spirit", "v-john37");
edge(SP, "v-john37", "v-john38");
edge(SP, "v-john38", "v-1pet123");
edge(SP, "anchor-spirit", "n-sp1");

// ---------------------------------------------------------------------------
// L2 — q-abraham : Abraham's faith
// ---------------------------------------------------------------------------
const AB = "q-abraham";
node("anchor-abraham", AB, "question", {
  content: "Why does Abraham's response to Melchizedek matter so much?",
  x: 0,
  y: 0,
});
node("v-gen156", AB, "verse", {
  ref: "Genesis 15:6",
  code: "Gen",
  ch: 15,
  v: 6,
  x: -390,
  y: 200,
});
node("v-rom43", AB, "verse", {
  ref: "Romans 4:3",
  code: "Rom",
  ch: 4,
  v: 3,
  x: 0,
  y: 320,
});
node("v-gal36", AB, "verse", {
  ref: "Galatians 3:6",
  code: "Gal",
  ch: 3,
  v: 6,
  x: 390,
  y: 200,
});
node("n-ab1", AB, "note", {
  content:
    "It moves me that Abraham gave a tenth before any law required it — faith first, obligation later. His believing God was credited as righteousness; the tithe was just the overflow.",
  x: 0,
  y: -300,
});
edge(AB, "anchor-abraham", "v-gen156");
edge(AB, "anchor-abraham", "n-ab1");
edge(AB, "v-gen156", "v-rom43");
edge(AB, "v-rom43", "v-gal36");
edge(AB, "v-gen156", "v-gal36", "crossref");

// ---------------------------------------------------------------------------
// Drop any edge whose endpoints are not both on the same map (safety) and any
// edge referencing a node id that doesn't exist.
// ---------------------------------------------------------------------------
const byId = new Map(nodes.map((n) => [n.id, n]));
const cleanEdges = edges.filter((e) => {
  const s = byId.get(e.source);
  const t = byId.get(e.target);
  return s && t && s.mapId === e.mapId && t.mapId === e.mapId;
});

const out = {
  version: 1,
  exportedAt: new Date(T0).toISOString(),
  name: "Melchizedek & the Eternal Priesthood",
  nodes,
  edges: cleanEdges,
};

mkdirSync(join(ROOT, "demo"), { recursive: true });
const dest = join(ROOT, "demo", "biblical-demo.hodos.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

// Report
const byType = nodes.reduce(
  (a, n) => ((a[n.type] = (a[n.type] || 0) + 1), a),
  {},
);
const maps = [...new Set(nodes.map((n) => n.mapId))];
console.log("wrote", dest);
console.log("nodes:", nodes.length, byType);
console.log(
  "edges:",
  cleanEdges.length,
  "(dropped",
  edges.length - cleanEdges.length,
  "cross-map)",
);
console.log("maps:", maps.length, maps.join(", "));
