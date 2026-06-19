import { test, expect } from "@playwright/test";
import { compileToStudyDoc } from "@/lib/notes/compile-to-study-doc";
import type { CompileInput, StudyDoc } from "@/lib/notes/study-doc";
import type { HodosEdge, HodosNode } from "@/lib/types";

/**
 * Pure-unit tests for the "Compile to notes" engine — no browser needed.
 * Run: npx playwright test tests/compile-notes.spec.ts
 *
 * Covers the compiler's two hard guarantees (determinism + content
 * preservation) across a degenerate-input battery, plus conformance on the
 * design's worked example.
 */

/* ----------------------------- tiny builders ----------------------------- */
type RawNode = { id: string; type: string; data: Record<string, unknown> };
const verse = (id: string, ref: string, text = "", hl?: string[]): RawNode => ({
  id,
  type: "verse",
  data: { verseRef: ref, verseText: text, highlights: hl },
});
const q = (id: string, content: string): RawNode => ({
  id,
  type: "question",
  data: { content },
});
const note = (id: string, content: string): RawNode => ({
  id,
  type: "note",
  data: { content },
});
const def = (id: string, term: string, definition?: string): RawNode => ({
  id,
  type: "definition",
  data: { content: term, definition },
});
const edge = (
  id: string,
  source: string,
  target: string,
  type: "manual" | "crossref",
): {
  id: string;
  source: string;
  target: string;
  type: string;
} => ({ id, source, target, type });

function makeInput(
  nodes: RawNode[],
  edges: ReturnType<typeof edge>[],
  mapName = "Test map",
): CompileInput {
  let primaryNodeId: string | null = null;
  for (const n of nodes)
    if (primaryNodeId === null || n.id < primaryNodeId) primaryNodeId = n.id;
  return {
    nodes: nodes as unknown as HodosNode[],
    edges: edges as unknown as HodosEdge[],
    mapName,
    primaryNodeId,
  };
}

function emittedIds(doc: StudyDoc): string[] {
  const ids: string[] = [];
  for (const s of doc.sections) {
    if (s.type === "verse") {
      ids.push(s.nodeId);
      for (const b of s.attached) ids.push(b.nodeId);
    } else {
      for (const b of s.blocks) ids.push(b.nodeId);
    }
  }
  return ids;
}

/** Deterministic seeded shuffle so the test itself is reproducible. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------- fixtures -------------------------------- */
function exampleNodes(): RawNode[] {
  return [
    verse(
      "wftest-1-james",
      "James 2:17",
      "So also faith by itself, if it does not have works, is dead.",
      ["dead"],
    ),
    verse(
      "wftest-2-eph",
      "Ephesians 2:8",
      "For by grace you have been saved through faith.",
    ),
    verse(
      "wftest-3-rom",
      "Romans 3:28",
      "For we hold that one is justified by faith apart from works of the law.",
    ),
    q("wftest-4-q1", "How do faith and works relate?"),
    q("wftest-5-q2", "What is dead faith?"),
    note("wftest-6-n1", "Reformation sola fide debate context"),
    def("wftest-7-d1", "justification", "to be declared righteous before God"),
  ];
}
function exampleEdges() {
  return [
    edge("e1", "wftest-4-q1", "wftest-1-james", "manual"),
    edge("e2", "wftest-4-q1", "wftest-2-eph", "manual"),
    edge("e3", "wftest-1-james", "wftest-3-rom", "crossref"),
    edge("e4", "wftest-6-n1", "wftest-2-eph", "manual"),
    edge("e5", "wftest-7-d1", "wftest-2-eph", "manual"),
  ];
}

/** The degenerate battery — each entry must compile without throwing and
 *  preserve every node exactly once. */
function battery(): { name: string; input: CompileInput }[] {
  const v = verse;
  return [
    { name: "empty", input: makeInput([], []) },
    { name: "one verse", input: makeInput([v("a", "John 3:16", "...")], []) },
    { name: "one orphan note", input: makeInput([note("a", "lonely")], []) },
    {
      name: "no edges, mixed",
      input: makeInput([v("a", "John 3:16"), q("b", "?"), note("c", "n")], []),
    },
    {
      name: "no verses, connected",
      input: makeInput(
        [q("a", "q"), note("b", "n"), def("c", "term", "d")],
        [edge("e1", "a", "b", "manual"), edge("e2", "b", "c", "manual")],
      ),
    },
    {
      name: "cycle + self-loop + dangling",
      input: makeInput(
        [v("a", "John 3:16", "x"), q("b", "?"), note("c", "n")],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "b", "c", "manual"),
          edge("e3", "c", "a", "manual"), // cycle
          edge("e4", "b", "b", "manual"), // self-loop
          edge("e5", "a", "ghost", "manual"), // dangling endpoint
        ],
      ),
    },
    {
      name: "duplicate + unparseable refs",
      input: makeInput(
        [
          v("a", "John 3:16", "x"),
          v("b", "John 3:16", "y"),
          v("c", "Zorp 9:9", "z"),
        ],
        [],
      ),
    },
    {
      name: "unknown node type",
      input: makeInput(
        [
          {
            id: "a",
            type: "lexicon",
            data: { content: "love", definition: "agape" },
          },
          v("b", "John 1:1", "t"),
        ],
        [edge("e1", "a", "b", "manual")],
      ),
    },
    {
      name: "verse with null/odd data",
      input: makeInput(
        [
          {
            id: "a",
            type: "verse",
            data: {
              verseRef: undefined as unknown as string,
              verseText: 7 as unknown as string,
            },
          },
          { id: "b", type: "note", data: {} },
        ],
        [],
      ),
    },
    {
      // two unparseable refs — guards stats.unparseableRefs ordering
      name: "multiple unparseable refs",
      input: makeInput(
        [
          v("a", "Zorp 1:1", "x"),
          v("b", "Qux 2:2", "y"),
          v("c", "John 3:16", "z"),
        ],
        [],
      ),
    },
    {
      // same id, different type/data — survivor must be order-independent
      name: "duplicate id differing data",
      input: makeInput(
        [
          { id: "dup", type: "note", data: { content: "A" } },
          { id: "dup", type: "question", data: { content: "B" } },
          v("v", "John 3:16", "t"),
        ],
        [],
      ),
    },
    {
      // a verse whose id is the empty string still owns its linked bubble
      name: "empty-string verse id",
      input: makeInput(
        [v("", "John 3:16", "t"), q("x", "linked")],
        [edge("e1", "x", "", "manual")],
      ),
    },
    {
      name: "the worked example",
      input: makeInput(exampleNodes(), exampleEdges()),
    },
    {
      name: "large clump (600 nodes)",
      input: (() => {
        const ns: RawNode[] = [
          verse("v-000", "Genesis 1:1", "In the beginning"),
        ];
        const es: ReturnType<typeof edge>[] = [];
        for (let i = 1; i < 600; i++) {
          const id = `n-${String(i).padStart(3, "0")}`;
          ns.push(q(id, `q${i}`));
          es.push(
            edge(
              `e-${i}`,
              id,
              i === 1 ? "v-000" : `n-${String(i - 1).padStart(3, "0")}`,
              "manual",
            ),
          );
        }
        return makeInput(ns, es);
      })(),
    },
  ];
}

/* -------------------------------- tests ---------------------------------- */
test.describe("compileToStudyDoc", () => {
  test("preserves every node exactly once across the degenerate battery", () => {
    for (const { name, input } of battery()) {
      const doc = compileToStudyDoc(input);
      const ids = emittedIds(doc);
      const inputIds = new Set(
        input.nodes.map((n) => (n as unknown as RawNode).id),
      );
      expect(doc.stats.nodeCount, `${name}: nodeCount`).toBe(inputIds.size);
      expect(
        doc.stats.emittedNodeCount,
        `${name}: emittedNodeCount === nodeCount`,
      ).toBe(doc.stats.nodeCount);
      // exactly once: no duplicates, and the set equals the input set
      expect(new Set(ids).size, `${name}: no duplicate emits`).toBe(ids.length);
      expect(new Set(ids), `${name}: same id set as input`).toEqual(inputIds);
    }
  });

  test("is deterministic — input order never changes the output", () => {
    for (const { name, input } of battery()) {
      const base = JSON.stringify(compileToStudyDoc(input));
      for (let seed = 1; seed <= 4; seed++) {
        const shuffled: CompileInput = {
          ...input,
          nodes: shuffle(input.nodes, seed),
          edges: shuffle(input.edges, seed * 7),
        };
        expect(
          JSON.stringify(compileToStudyDoc(shuffled)),
          `${name}: stable under shuffle ${seed}`,
        ).toBe(base);
      }
    }
  });

  test("nests a bubble under an empty-string-id verse (not Loose notes)", () => {
    const doc = compileToStudyDoc(
      makeInput(
        [verse("", "John 3:16", "t"), q("x", "linked")],
        [edge("e1", "x", "", "manual")],
      ),
    );
    const vs = doc.sections.find((s) => s.type === "verse");
    expect(
      vs && vs.type === "verse" && vs.attached.map((b) => b.nodeId),
    ).toEqual(["x"]);
    expect(doc.sections.some((s) => s.type === "orphans")).toBe(false);
  });

  test("conforms to the worked example outline", () => {
    const doc = compileToStudyDoc(makeInput(exampleNodes(), exampleEdges()));
    const verses = doc.sections.filter((s) => s.type === "verse") as Extract<
      StudyDoc["sections"][number],
      { type: "verse" }
    >[];

    // canonical order: Romans (45) < Ephesians (49) < James (59)
    expect(verses.map((v) => v.ref)).toEqual([
      "Romans 3:28",
      "Ephesians 2:8",
      "James 2:17",
    ]);

    const james = verses.find((v) => v.ref === "James 2:17")!;
    expect(james.isAnchor).toBe(true);
    expect(james.runs.some((r) => r.mark && r.text === "dead")).toBe(true);
    // crossref is reciprocal
    expect(james.seeAlso.map((c) => c.label)).toEqual(["Romans 3:28"]);
    // Q1 (anchor-biased tie) lands on James, pointing also to Ephesians
    expect(james.attached.map((b) => b.kind)).toEqual(["question"]);
    expect(james.attached[0].alsoRelatesTo.map((c) => c.label)).toEqual([
      "Ephesians 2:8",
    ]);

    const eph = verses.find((v) => v.ref === "Ephesians 2:8")!;
    expect(eph.attached.map((b) => b.kind)).toEqual(["note", "definition"]);

    const rom = verses.find((v) => v.ref === "Romans 3:28")!;
    expect(rom.seeAlso.map((c) => c.label)).toEqual(["James 2:17"]);

    // Q2 is a loose note (orphan)
    const orphans = doc.sections.find((s) => s.type === "orphans");
    expect(
      orphans &&
        orphans.type === "orphans" &&
        orphans.blocks.map((b) => b.nodeId),
    ).toEqual(["wftest-5-q2"]);
  });
});
