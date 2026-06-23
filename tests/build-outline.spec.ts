import { test, expect } from "@playwright/test";
import { buildOutline } from "@/lib/notes/build-outline";
import type {
  BuildOutlineInput,
  OutlineGraph,
  OutlineNode,
} from "@/lib/notes/outline";
import type { HodosEdge, HodosNode } from "@/lib/types";

/**
 * Pure-unit tests for the graph→outline extractor. No browser needed.
 * Run: npx playwright test tests/build-outline.spec.ts
 *
 * Covers the two hard guarantees (content preservation + determinism) plus the
 * user-facing contract: top-level bubble = section, its branches = sub-points.
 */

type RawNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
};
const verse = (id: string, ref: string, text = "", x = 0, y = 0): RawNode => ({
  id,
  type: "verse",
  data: { verseRef: ref, verseText: text },
  position: { x, y },
});
const q = (id: string, content: string, x = 0, y = 0): RawNode => ({
  id,
  type: "question",
  data: { content },
  position: { x, y },
});
const note = (id: string, content: string, x = 0, y = 0): RawNode => ({
  id,
  type: "note",
  data: { content },
  position: { x, y },
});
const def = (
  id: string,
  term: string,
  definition?: string,
  x = 0,
  y = 0,
): RawNode => ({
  id,
  type: "definition",
  data: { content: term, definition },
  position: { x, y },
});
const edge = (
  id: string,
  source: string,
  target: string,
  type: "manual" | "crossref",
) => ({ id, source, target, type });

function makeInput(
  nodes: RawNode[],
  edges: ReturnType<typeof edge>[],
  mapName = "Map",
): BuildOutlineInput {
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

/** Every node id reachable across roots (recursively) + orphans. */
function allIds(g: OutlineGraph): string[] {
  const ids: string[] = [];
  const walk = (n: OutlineNode) => {
    ids.push(n.id);
    n.children.forEach(walk);
  };
  g.roots.forEach(walk);
  g.orphans.forEach((n) => ids.push(n.id));
  return ids;
}

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

function battery(): { name: string; input: BuildOutlineInput }[] {
  return [
    { name: "empty", input: makeInput([], []) },
    { name: "one node, no edges", input: makeInput([q("a", "lonely")], []) },
    {
      name: "all orphans (no edges)",
      input: makeInput(
        [q("a", "?"), note("b", "n"), verse("c", "John 3:16")],
        [],
      ),
    },
    {
      name: "simple tree",
      input: makeInput(
        [
          q("a-root", "Main idea", 0, 0),
          note("b", "point 1", 0, 100),
          note("c", "point 2", 0, 200),
        ],
        [
          edge("e1", "a-root", "b", "manual"),
          edge("e2", "a-root", "c", "manual"),
        ],
      ),
    },
    {
      name: "deep chain",
      input: makeInput(
        [
          q("a", "root"),
          note("b", "child"),
          def("c", "term", "meaning"),
          note("d", "deep"),
        ],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "b", "c", "manual"),
          edge("e3", "c", "d", "manual"),
        ],
      ),
    },
    {
      name: "cycle + self-loop + dangling",
      input: makeInput(
        [q("a", "x"), note("b", "y"), note("c", "z")],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "b", "c", "manual"),
          edge("e3", "c", "a", "manual"), // cycle back-edge
          edge("e4", "b", "b", "manual"), // self-loop
          edge("e5", "a", "ghost", "manual"), // dangling
        ],
      ),
    },
    {
      name: "two components -> two roots",
      input: makeInput(
        [
          q("a", "topic A"),
          note("b", "a1"),
          q("c", "topic B"),
          note("d", "b1"),
        ],
        [edge("e1", "a", "b", "manual"), edge("e2", "c", "d", "manual")],
      ),
    },
    {
      name: "crossref-only node -> singleton root",
      input: makeInput(
        [verse("a", "John 3:16", "x"), verse("b", "Rom 3:28", "y")],
        [edge("e1", "a", "b", "crossref")],
      ),
    },
    {
      name: "diamond (two parents)",
      input: makeInput(
        [
          q("a", "root"),
          note("b", "left"),
          note("c", "right"),
          def("d", "shared", "m"),
        ],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "a", "c", "manual"),
          edge("e3", "b", "d", "manual"),
          edge("e4", "c", "d", "manual"), // d's 2nd parent -> demoted to crossref
        ],
      ),
    },
    {
      // same ordered pair with BOTH a manual and a crossref edge — must resolve
      // identically regardless of input order (dedup key includes the kind).
      name: "manual + crossref on the same pair",
      input: makeInput(
        [
          verse("a", "John 3:16", "x"),
          verse("b", "Rom 3:28", "y"),
          note("c", "child"),
        ],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "a", "b", "crossref"),
          edge("e3", "a", "c", "manual"),
        ],
      ),
    },
    {
      name: "large chain (400 nodes)",
      input: (() => {
        const ns: RawNode[] = [q("n-000", "root", 0, 0)];
        const es: ReturnType<typeof edge>[] = [];
        for (let i = 1; i < 400; i++) {
          const id = `n-${String(i).padStart(3, "0")}`;
          ns.push(note(id, `n${i}`, 0, i * 60));
          es.push(
            edge(`e-${i}`, `n-${String(i - 1).padStart(3, "0")}`, id, "manual"),
          );
        }
        return makeInput(ns, es);
      })(),
    },
  ];
}

test.describe("buildOutline", () => {
  test("preserves every node exactly once across the battery", () => {
    for (const { name, input } of battery()) {
      const g = buildOutline(input);
      const ids = allIds(g);
      const inputIds = new Set(
        input.nodes.map((n) => (n as unknown as RawNode).id),
      );
      expect(g.stats.nodeCount, `${name}: nodeCount`).toBe(inputIds.size);
      expect(g.stats.emittedNodeCount, `${name}: emitted === nodeCount`).toBe(
        g.stats.nodeCount,
      );
      expect(new Set(ids).size, `${name}: no duplicates`).toBe(ids.length);
      expect(new Set(ids), `${name}: same id set`).toEqual(inputIds);
    }
  });

  test("is deterministic — input order never changes the output", () => {
    for (const { name, input } of battery()) {
      const base = JSON.stringify(buildOutline(input));
      for (let seed = 1; seed <= 4; seed++) {
        const shuffled: BuildOutlineInput = {
          ...input,
          nodes: shuffle(input.nodes, seed),
          edges: shuffle(input.edges, seed * 7),
        };
        expect(
          JSON.stringify(buildOutline(shuffled)),
          `${name}: stable under shuffle ${seed}`,
        ).toBe(base);
      }
    }
  });

  test("top-level bubble is a section; its branches are sub-points", () => {
    const g = buildOutline(
      makeInput(
        [
          q("a-root", "How does grace work?", 0, 0),
          note("b", "by faith", 0, 100),
          note("c", "not works", 0, 200),
          def("d", "grace", "unmerited favor", 0, 300),
        ],
        [
          edge("e1", "a-root", "b", "manual"),
          edge("e2", "a-root", "c", "manual"),
          edge("e3", "b", "d", "manual"), // grandchild under "by faith"
        ],
      ),
    );
    expect(g.roots).toHaveLength(1);
    const root = g.roots[0];
    expect(root.id).toBe("a-root");
    expect(root.depth).toBe(0);
    expect(root.children.map((c) => c.id)).toEqual(["b", "c"]); // top→bottom by position
    const byFaith = root.children[0];
    expect(byFaith.children.map((c) => c.id)).toEqual(["d"]); // branch of a branch
    expect(byFaith.children[0].depth).toBe(2);
    expect(g.stats.maxDepth).toBe(2);
    expect(g.orphans).toHaveLength(0);
  });

  test("a cycle back-edge is demoted to a cross-reference (no infinite loop)", () => {
    const g = buildOutline(
      makeInput(
        [q("a", "x"), note("b", "y"), note("c", "z")],
        [
          edge("e1", "a", "b", "manual"),
          edge("e2", "b", "c", "manual"),
          edge("e3", "c", "a", "manual"), // back-edge
        ],
      ),
    );
    expect(g.stats.cyclesBroken).toBe(1);
    expect(g.roots).toHaveLength(1);
    expect(allIds(g).sort()).toEqual(["a", "b", "c"]);
  });

  test("loose bubbles with no edges land in orphans", () => {
    const g = buildOutline(
      makeInput(
        [q("a", "linked"), note("b", "child"), note("c", "loose")],
        [edge("e1", "a", "b", "manual")],
      ),
    );
    expect(g.roots.map((r) => r.id)).toEqual(["a"]);
    expect(g.orphans.map((o) => o.id)).toEqual(["c"]);
  });
});
