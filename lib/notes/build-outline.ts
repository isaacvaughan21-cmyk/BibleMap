// lib/notes/build-outline.ts
//
// buildOutline(input): OutlineGraph — turns the canvas (bubbles + arrows for one
// map) into a rooted spanning forest that honors the user's intuition:
// "a top-level bubble is a section header; the bubbles branching out of it are
// the points under that header" — regardless of bubble kind.
//
// Pure & deterministic (no Date/Math.random; every comparator ends in cmpId so
// the output never depends on input array order). Iterative (explicit queues),
// so deep graphs never overflow the stack. Cycle-safe. Every input node appears
// EXACTLY ONCE across roots + orphans (two-sided preservation guard).

import { BOOKS } from "@/lib/bible-books";
import { formatRange, parseRange } from "@/lib/bible";
import type {
  BuildOutlineInput,
  OutlineCrossRef,
  OutlineGraph,
  OutlineNode,
  OutlineNodeKind,
} from "./outline";

type AnyNode = {
  id: string;
  type: string;
  data?: Record<string, unknown> | null;
  position?: { x?: number; y?: number } | null;
};
type AnyEdge = { source: string; target: string; type?: string };

const cmpId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isBlank = (v: unknown): boolean => str(v).trim() === "";

const KIND_RANK: Record<string, number> = {
  verse: 0,
  question: 1,
  note: 2,
  definition: 3,
  other: 4,
};

const GRID = 80; // spatial banding for top-to-bottom, left-to-right child order
const LABEL_CLIP = 60;

export function buildOutline(input: BuildOutlineInput): OutlineGraph {
  const rawNodes = input.nodes as unknown as AnyNode[];
  const rawEdges = input.edges as unknown as AnyEdge[];
  const { mapName, primaryNodeId } = input;

  // ---- STEP 0: index + dedup nodes (order-independent winner on id clash) ----
  const nodeById = new Map<string, AnyNode>();
  for (const n of rawNodes) {
    if (!n || typeof n.id !== "string") continue;
    const existing = nodeById.get(n.id);
    if (!existing) {
      nodeById.set(n.id, n);
    } else {
      const a = JSON.stringify([existing.type, existing.data ?? null]);
      const b = JSON.stringify([n.type, n.data ?? null]);
      if (b < a) nodeById.set(n.id, n);
    }
  }
  const ids = [...nodeById.keys()];
  const isVerse = (id: string) => nodeById.get(id)?.type === "verse";

  // ---- verse sort keys (for canonical root ordering + labels) ---------------
  type VKey = { bookIdx: number; chapter: number; verse: number };
  const verseKey = new Map<string, VKey>();
  const verseLabel = new Map<string, string>();
  const unparseableRefs: string[] = [];
  for (const id of ids) {
    const n = nodeById.get(id)!;
    if (n.type !== "verse") continue;
    const rawRef = str(n.data?.verseRef).trim();
    const pr = rawRef ? parseRange(rawRef) : null;
    if (pr) {
      verseKey.set(id, {
        bookIdx: BOOKS.indexOf(pr.start.book),
        chapter: pr.start.chapter,
        verse: pr.start.verse,
      });
      verseLabel.set(id, formatRange(pr));
    } else {
      if (rawRef) unparseableRefs.push(rawRef);
      verseKey.set(id, {
        bookIdx: Infinity,
        chapter: Infinity,
        verse: Infinity,
      });
      verseLabel.set(id, rawRef || "Untitled verse");
    }
  }

  /** Short label for a cross-reference target. */
  const labelOf = (id: string): string => {
    const n = nodeById.get(id);
    if (!n) return id;
    if (n.type === "verse") return verseLabel.get(id) ?? "verse";
    const body = str(n.data?.content) || str(n.data?.definition);
    const clipped = body.replace(/\s+/g, " ").trim().slice(0, LABEL_CLIP);
    return clipped || `(${str(n.type) || "note"})`;
  };

  // ---- STEP 1: classify edges ------------------------------------------------
  const manualOut = new Map<string, string[]>(); // source -> [targets]
  const inManualCount = new Map<string, number>();
  const manualUndirected = new Map<string, Set<string>>();
  const crossPairs = new Set<string>(); // "a|b", a<b
  const hasAnyEdge = new Set<string>();
  const seenDirected = new Set<string>();
  for (const id of ids) {
    manualOut.set(id, []);
    inManualCount.set(id, 0);
    manualUndirected.set(id, new Set());
  }
  let edgeCount = 0;
  for (const e of rawEdges) {
    const s = e?.source;
    const t = e?.target;
    if (typeof s !== "string" || typeof t !== "string") continue;
    if (s === t) continue; // self-loop
    if (!nodeById.has(s) || !nodeById.has(t)) continue; // dangling
    // Dedup by (pair, kind) — not pair alone — so a same-pair manual+crossref
    // combination resolves identically regardless of input array order.
    const kind = (e.type ?? "manual") === "crossref" ? "crossref" : "manual";
    const key = `${s}>${t}|${kind}`;
    if (seenDirected.has(key)) continue;
    seenDirected.add(key);
    edgeCount++;
    hasAnyEdge.add(s);
    hasAnyEdge.add(t);
    if (kind === "crossref") {
      crossPairs.add(s < t ? `${s}|${t}` : `${t}|${s}`);
    } else {
      manualOut.get(s)!.push(t);
      inManualCount.set(t, (inManualCount.get(t) ?? 0) + 1);
      manualUndirected.get(s)!.add(t);
      manualUndirected.get(t)!.add(s);
    }
  }

  // ---- child comparator: spatial (top→bottom, left→right) → kind → id -------
  const band = (n: AnyNode | undefined, axis: "x" | "y"): number => {
    const v = n?.position?.[axis];
    return Math.round(
      (typeof v === "number" && Number.isFinite(v) ? v : 0) / GRID,
    );
  };
  const cmpChild = (a: string, b: string): number => {
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    return (
      band(na, "y") - band(nb, "y") ||
      band(na, "x") - band(nb, "x") ||
      (KIND_RANK[na?.type ?? "other"] ?? 4) -
        (KIND_RANK[nb?.type ?? "other"] ?? 4) ||
      cmpId(a, b)
    );
  };

  /** Root ordering: anchor first, then canonical verse order, then id. */
  const cmpRoot = (a: string, b: string): number => {
    if (a === primaryNodeId && b !== primaryNodeId) return -1;
    if (b === primaryNodeId && a !== primaryNodeId) return 1;
    const ka = verseKey.get(a);
    const kb = verseKey.get(b);
    const ra = ka ? ka.bookIdx : Infinity;
    const rb = kb ? kb.bookIdx : Infinity;
    if (ra !== rb) return ra - rb;
    const ca = ka ? ka.chapter : Infinity;
    const cb = kb ? kb.chapter : Infinity;
    if (ca !== cb) return ca - cb;
    const va = ka ? ka.verse : Infinity;
    const vb = kb ? kb.verse : Infinity;
    if (va !== vb) return va - vb;
    return cmpId(a, b);
  };

  // ---- STEP 2: pick roots over the manual graph's components ----------------
  const inManual = new Set<string>(); // nodes touched by a manual edge
  for (const id of ids)
    if (manualUndirected.get(id)!.size > 0) inManual.add(id);

  const roots: string[] = [];
  const compVisited = new Set<string>();
  for (const start of [...inManual].sort(cmpId)) {
    if (compVisited.has(start)) continue;
    // gather the connected component (undirected manual graph)
    const comp: string[] = [];
    const q = [start];
    compVisited.add(start);
    while (q.length) {
      const u = q.shift()!;
      comp.push(u);
      for (const w of [...manualUndirected.get(u)!].sort(cmpId)) {
        if (!compVisited.has(w)) {
          compVisited.add(w);
          q.push(w);
        }
      }
    }
    const compRoots = comp.filter((id) => (inManualCount.get(id) ?? 0) === 0);
    const anchorInComp = primaryNodeId && comp.includes(primaryNodeId);
    if (anchorInComp) {
      // Force the anchor to be a root; its incoming manual edges become back-edges.
      if (!compRoots.includes(primaryNodeId!)) compRoots.push(primaryNodeId!);
    }
    if (compRoots.length === 0) {
      // pure cycle, no entry point → smallest id is the root
      compRoots.push(comp.slice().sort(cmpId)[0]);
    }
    roots.push(...compRoots);
  }

  // ---- STEP 3: grow the forest (single multi-root BFS, claim + break cycles) -
  const parent = new Map<string, string | null>();
  const depth = new Map<string, number>();
  const visited = new Set<string>();
  const demotedCrossRefs = new Map<string, OutlineCrossRef[]>(); // owner -> back-edge refs
  let cyclesBroken = 0;

  const queue: string[] = [...roots].sort(cmpRoot);
  for (const r of queue) {
    visited.add(r);
    parent.set(r, null);
    depth.set(r, 0);
  }
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    const d = depth.get(u)!;
    const kids = [...(manualOut.get(u) ?? [])].sort(cmpChild);
    for (const w of kids) {
      if (visited.has(w)) {
        // back-edge / 2nd parent → demote to a manual cross-reference on u
        const list = demotedCrossRefs.get(u) ?? [];
        list.push({ targetId: w, via: "manual", targetLabel: labelOf(w) });
        demotedCrossRefs.set(u, list);
        cyclesBroken++;
      } else {
        visited.add(w);
        parent.set(w, u);
        depth.set(w, d + 1);
        queue.push(w);
      }
    }
  }

  // ---- STEP 5 (prep): per-node cross-references (symmetric + demoted) --------
  const crossRefsOf = new Map<string, OutlineCrossRef[]>();
  const pushRef = (owner: string, ref: OutlineCrossRef) => {
    const list = crossRefsOf.get(owner) ?? [];
    list.push(ref);
    crossRefsOf.set(owner, list);
  };
  for (const pair of crossPairs) {
    const [a, b] = pair.split("|");
    pushRef(a, { targetId: b, via: "crossref", targetLabel: labelOf(b) });
    pushRef(b, { targetId: a, via: "crossref", targetLabel: labelOf(a) });
  }
  for (const [owner, refs] of demotedCrossRefs) {
    for (const r of refs) pushRef(owner, r);
  }
  const finalizeRefs = (id: string): OutlineCrossRef[] => {
    const refs = crossRefsOf.get(id) ?? [];
    const seen = new Set<string>();
    const out: OutlineCrossRef[] = [];
    for (const r of refs) {
      const k = `${r.targetId}|${r.via}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    // crossref before manual, then canonical target order, then id
    out.sort(
      (x, y) =>
        (x.via === "crossref" ? 0 : 1) - (y.via === "crossref" ? 0 : 1) ||
        cmpRoot(x.targetId, y.targetId) ||
        cmpId(x.targetId, y.targetId),
    );
    return out;
  };

  // ---- STEP 6: orphans + crossref-only singleton roots ----------------------
  // A node with NO edges at all is an orphan. A node touched only by crossref
  // edges (never claimed into the tree) becomes its own singleton root section.
  const orphanIds: string[] = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    if (!hasAnyEdge.has(id)) {
      orphanIds.push(id); // truly loose bubble
    } else {
      // crossref-only (or otherwise unclaimed but connected) → singleton root
      visited.add(id);
      parent.set(id, null);
      depth.set(id, 0);
      roots.push(id);
    }
  }
  roots.sort(cmpRoot);

  // ---- STEP 7: highlight dedup (mirror VerseNode), payload builder ----------
  const buildHighlights = (text: string, hi: unknown): string[] | undefined => {
    const arr = Array.isArray(hi) ? (hi as unknown[]) : [];
    const phrases = [...new Set(arr)].filter(
      (p): p is string => typeof p === "string" && text.includes(p),
    );
    if (!phrases.length) return undefined;
    // length-DESC dedup, keep those present, ordered by first occurrence in text
    const longestFirst = phrases.slice().sort((a, b) => b.length - a.length);
    const kept = longestFirst.filter(
      (p, i) => !longestFirst.slice(0, i).some((q) => q.includes(p)),
    );
    return kept.sort((a, b) => text.indexOf(a) - text.indexOf(b));
  };

  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);
  for (const [child, par] of parent) {
    if (par) childrenOf.get(par)!.push(child);
  }
  for (const list of childrenOf.values()) list.sort(cmpChild);

  const payload = (id: string): Omit<OutlineNode, "children" | "depth"> => {
    const n = nodeById.get(id)!;
    const d = n.data ?? {};
    const isAnchor = id === primaryNodeId;
    const base = {
      id,
      isAnchor,
      crossRefs: finalizeRefs(id),
    };
    switch (n.type) {
      case "verse": {
        const text = str(d.verseText);
        const rawRef = str(d.verseRef).trim();
        const kind: OutlineNodeKind = "verse";
        return {
          ...base,
          kind,
          rawType: "verse",
          title: verseLabel.get(id),
          text: text || undefined,
          highlights: text ? buildHighlights(text, d.highlights) : undefined,
          rawRef: rawRef || undefined,
          refUnparseable: verseKey.get(id)?.bookIdx === Infinity || undefined,
          isEmpty: isBlank(text) && isBlank(rawRef),
        };
      }
      case "question":
        return {
          ...base,
          kind: "question",
          rawType: "question",
          text: str(d.content) || undefined,
          isEmpty: isBlank(d.content),
        };
      case "note":
        return {
          ...base,
          kind: "note",
          rawType: "note",
          text: str(d.content) || undefined,
          isEmpty: isBlank(d.content),
        };
      case "definition":
        return {
          ...base,
          kind: "definition",
          rawType: "definition",
          title: str(d.content).trim() || undefined,
          text: str(d.definition) || undefined,
          isEmpty: isBlank(d.content) && isBlank(d.definition),
        };
      default: {
        const body =
          str(d.content) ||
          str(d.definition) ||
          str(d.verseText) ||
          str(d.verseRef);
        return {
          ...base,
          kind: "other",
          rawType: typeof n.type === "string" ? n.type : "other",
          text: body || undefined,
          isEmpty: body === "",
        };
      }
    }
  };

  // Assemble each tree iteratively (stack-based; never recurses on graph depth).
  let maxDepth = 0;
  const assembleTree = (rootId: string): OutlineNode => {
    const built = new Map<string, OutlineNode>();
    // post-order via an explicit stack so children are built before parents
    const order: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      order.push(id);
      for (const c of childrenOf.get(id) ?? []) stack.push(c);
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const d = depth.get(id) ?? 0;
      if (d > maxDepth) maxDepth = d;
      built.set(id, {
        ...payload(id),
        depth: d,
        children: (childrenOf.get(id) ?? []).map((c) => built.get(c)!),
      });
    }
    return built.get(rootId)!;
  };

  const rootNodes = roots.map(assembleTree);
  const orphanNodes = orphanIds
    .slice()
    .sort(cmpChild)
    .map((id) => ({ ...payload(id), depth: 0, children: [] as OutlineNode[] }));

  // ---- STEP 8: preservation guard -------------------------------------------
  const emitted = new Set<string>();
  const duplicates: string[] = [];
  // Iterative (explicit stack) so a very deep chain never overflows the stack.
  const guardStack: OutlineNode[] = [...rootNodes];
  while (guardStack.length) {
    const n = guardStack.pop()!;
    if (emitted.has(n.id)) duplicates.push(n.id);
    else emitted.add(n.id);
    for (const c of n.children) guardStack.push(c);
  }
  for (const n of orphanNodes) {
    if (emitted.has(n.id)) duplicates.push(n.id);
    else emitted.add(n.id);
  }
  const missing = ids.filter((id) => !emitted.has(id));
  for (const id of missing.sort(cmpId)) {
    orphanNodes.push({ ...payload(id), depth: 0, children: [] });
    emitted.add(id);
  }
  if (process.env.NODE_ENV !== "production" && duplicates.length) {
    throw new Error(
      `buildOutline: node(s) emitted more than once: ${duplicates.join(", ")}`,
    );
  }

  return {
    title: mapName,
    roots: rootNodes,
    orphans: orphanNodes,
    stats: {
      nodeCount: ids.length,
      emittedNodeCount: emitted.size,
      rootCount: rootNodes.length,
      orphanCount: orphanNodes.length,
      maxDepth,
      edgeCount,
      cyclesBroken,
      unparseableRefs: unparseableRefs.slice().sort(),
    },
  };
}
