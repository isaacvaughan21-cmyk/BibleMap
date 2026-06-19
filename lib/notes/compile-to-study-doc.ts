// =============================================================================
// lib/notes/compile-to-study-doc.ts
//
// The deterministic, graph-aware "Compile to notes" engine. Turns a
// disorganized canvas (bubbles + connections for ONE map) into a structured
// StudyDoc: a canonical verse-by-verse spine, with every question / note /
// definition attached to its nearest verse, freeform clusters as themed
// sections, and loose bubbles collected at the end.
//
// Guarantees:
//  • Pure & deterministic — same input (in any order) -> identical StudyDoc.
//    No Date / Math.random; every comparator terminates in cmpId (node id is a
//    deterministic tiebreaker only — no claim is made that id == creation time).
//  • Content preservation — every input node appears EXACTLY ONCE. A two-sided
//    guard (Step 9) catches both drops (appends to "Loose notes") and, in dev,
//    duplicates (throws). Relationships ride along as pointers (seeAlso /
//    alsoRelatesTo) that reference nodes by id without re-emitting their content.
//  • Robust — no edges, no verses, one giant clump, cycles, self-loops,
//    dangling edges, empty / duplicate / unparseable refs, thousands of nodes.
//    Iterative (explicit frontiers/queues) so deep graphs never overflow.
// =============================================================================

import { BOOKS } from "@/lib/bible-books";
import { formatRange, parseRange } from "@/lib/bible";
import type {
  AttachedBlock,
  CompileInput,
  CrossRef,
  DocSection,
  OrphanSection,
  StudyDoc,
  TextRun,
  ThemedSection,
  VerseSection,
} from "./study-doc";

/** Permissive runtime view of a node — tolerates unknown future types (e.g. "lexicon"). */
type AnyNode = {
  id: string;
  type: string;
  data?: Record<string, unknown> | null;
};
type AnyEdge = { source: string; target: string; type?: string };

/** Sortable canonical key for a verse node. Unparseable refs use Infinity (trail). */
type VerseKey = {
  parsed: boolean;
  bookIdx: number;
  chapter: number;
  verse: number;
  rawRef: string;
  displayRef: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isBlank = (v: unknown): boolean => str(v).trim() === "";
const firstString = (...xs: unknown[]): string =>
  (xs.find((x) => typeof x === "string" && x.length > 0) as string) ?? "";
const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** Total string order over node ids (works for uuid v7 and synthetic ids alike). */
const cmpId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Copied verbatim from VerseNode so emphasis matches the canvas byte-for-byte. */
const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KIND_RANK: Record<string, number> = {
  question: 0,
  note: 1,
  definition: 2,
  other: 3,
};

export function compileToStudyDoc(input: CompileInput): StudyDoc {
  const rawNodes = input.nodes as unknown as AnyNode[];
  const rawEdges = input.edges as unknown as AnyEdge[];
  const { mapName, primaryNodeId } = input;

  // ---- STEP 0: index + dedup nodes ------------------------------------------
  // Real ids are unique uuids; if a malformed input repeats an id, keep an
  // ORDER-INDEPENDENT winner (smallest serialized [type, data]) so the output
  // never depends on which copy appeared first in the array.
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
  const isVerse = (id: string): boolean => nodeById.get(id)?.type === "verse";

  // ---- STEP 1: verse sort keys (compute once) -------------------------------
  const verseKey = new Map<string, VerseKey>();
  const unparseableRefs: string[] = [];
  for (const id of ids) {
    const n = nodeById.get(id)!;
    if (n.type !== "verse") continue;
    const rawRef = str(n.data?.verseRef).trim();
    const pr = rawRef ? parseRange(rawRef) : null;
    if (pr) {
      verseKey.set(id, {
        parsed: true,
        bookIdx: BOOKS.indexOf(pr.start.book),
        chapter: pr.start.chapter,
        verse: pr.start.verse,
        rawRef,
        displayRef: formatRange(pr),
      });
    } else {
      if (rawRef) unparseableRefs.push(rawRef);
      verseKey.set(id, {
        parsed: false,
        bookIdx: Infinity,
        chapter: Infinity,
        verse: Infinity,
        rawRef,
        displayRef: rawRef || "Untitled verse",
      });
    }
  }
  const displayRef = (id: string): string =>
    verseKey.get(id)?.displayRef ?? "Untitled verse";
  const refUnparseable = (id: string): boolean =>
    verseKey.get(id)?.parsed === false;

  /** Canonical order: book, chapter, verse, then id. */
  const cmpVerse = (a: string, b: string): number => {
    const ka = verseKey.get(a)!;
    const kb = verseKey.get(b)!;
    return (
      ka.bookIdx - kb.bookIdx ||
      ka.chapter - kb.chapter ||
      ka.verse - kb.verse ||
      cmpId(a, b)
    );
  };

  // ---- STEP 2: undirected simple graph + verse<->verse crossref pairs --------
  const adj = new Map<string, Set<string>>();
  for (const id of ids) adj.set(id, new Set());
  const crossPairs = new Set<string>(); // "min|max" for verse<->verse crossref
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const e of rawEdges) {
    const s = e?.source;
    const t = e?.target;
    if (typeof s !== "string" || typeof t !== "string") continue;
    if (s === t) continue; // self-loop
    if (!nodeById.has(s) || !nodeById.has(t)) continue; // dangling endpoint
    adj.get(s)!.add(t);
    adj.get(t)!.add(s);
    if ((e.type ?? "manual") === "crossref" && isVerse(s) && isVerse(t)) {
      crossPairs.add(pairKey(s, t));
    }
  }
  const edgeCount =
    [...adj.values()].reduce((sum, set) => sum + set.size, 0) / 2;

  const verseIds = ids.filter((id) => isVerse(id));
  const nonVerseIds = ids.filter((id) => !isVerse(id));

  // ---- STEP 3: attach each non-verse bubble to its NEAREST verse -------------
  // One synchronous-layer multi-source BFS seeded from every verse. Each frontier
  // is sorted by ownerRank before expansion and claims are first-write-wins, so
  // an equidistant bubble is taken by the anchor verse first, else the
  // canonically-earliest verse (then id). multiHits records every verse that
  // reaches a bubble at its minimal distance -> "also relates to" pointers.
  const dist = new Map<string, number>();
  const owner = new Map<string, string>(); // node id -> owning verse id
  const multiHits = new Map<string, Set<string>>();

  /** [anchorTier, bookIdx, chapter, verse, id] — lower wins. */
  const ownerRank = (vId: string): [number, number, number, number, string] => {
    const k = verseKey.get(vId)!;
    return [vId === primaryNodeId ? 0 : 1, k.bookIdx, k.chapter, k.verse, vId];
  };
  const cmpOwnerRank = (a: string, b: string): number => {
    const ra = ownerRank(a);
    const rb = ownerRank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] < rb[i]) return -1;
      if (ra[i] > rb[i]) return 1;
    }
    return 0;
  };

  for (const v of verseIds) {
    dist.set(v, 0);
    owner.set(v, v);
  }
  let frontier = verseIds.slice();
  let depth = 0;
  while (frontier.length) {
    frontier.sort(
      (a, b) => cmpOwnerRank(owner.get(a)!, owner.get(b)!) || cmpId(a, b),
    );
    const next: string[] = [];
    for (const u of frontier) {
      const neighbours = [...adj.get(u)!].sort(cmpId);
      for (const w of neighbours) {
        if (isVerse(w)) continue; // verses are never re-owned
        if (!dist.has(w)) {
          dist.set(w, depth + 1);
          owner.set(w, owner.get(u)!);
          multiHits.set(w, new Set([owner.get(u)!]));
          next.push(w);
        } else if (dist.get(w) === depth + 1) {
          multiHits.get(w)!.add(owner.get(u)!);
        }
      }
    }
    frontier = next;
    depth++;
  }

  // ---- STEP 7: buildRuns(verseId) — mirror VerseNode.withHighlights ----------
  const buildRuns = (id: string): TextRun[] => {
    const text = str(nodeById.get(id)!.data?.verseText);
    if (text === "") return [];
    const hi = nodeById.get(id)!.data?.highlights;
    const phrases = [
      ...new Set(Array.isArray(hi) ? (hi as unknown[]) : []),
    ].filter((p): p is string => typeof p === "string" && text.includes(p));
    if (!phrases.length) return [{ text, mark: false }];
    const re = new RegExp(
      `(${phrases
        .sort((a, b) => b.length - a.length) // length-DESC only (matches VerseNode)
        .map(escapeRegExp)
        .join("|")})`,
      "g",
    );
    return text
      .split(re)
      .filter((s) => s !== "")
      .map((s) => ({ text: s, mark: phrases.includes(s) }));
  };

  // ---- STEP 8: toBlock(id) ---------------------------------------------------
  const toBlock = (id: string): AttachedBlock => {
    const n = nodeById.get(id)!;
    const d = n.data ?? {};
    const isAnchor = id === primaryNodeId;
    const base = { nodeId: id, isAnchor, alsoRelatesTo: [] as CrossRef[] };
    switch (n.type) {
      case "question":
        return {
          ...base,
          kind: "question",
          label: "Question",
          body: str(d.content),
          isEmpty: isBlank(d.content),
        };
      case "note":
        return {
          ...base,
          kind: "note",
          label: "Note",
          body: str(d.content),
          isEmpty: isBlank(d.content),
        };
      case "definition":
        return {
          ...base,
          kind: "definition",
          label: "Definition",
          term: str(d.content).trim() || "(unnamed term)",
          body: str(d.definition),
          isEmpty: isBlank(d.content) && isBlank(d.definition),
        };
      default: {
        // Unknown future type (e.g. "lexicon"): never drop, render best-effort.
        const body = firstString(
          d.content,
          d.definition,
          d.verseText,
          d.verseRef,
        );
        const term =
          typeof d.content === "string" && d.definition !== undefined
            ? str(d.content)
            : undefined;
        return {
          ...base,
          kind: "other",
          label:
            titleCase(typeof n.type === "string" ? n.type : "note") || "Note",
          term,
          body,
          isEmpty: body === "",
        };
      }
    }
  };

  /** Sort blocks: question < note < definition < other, then by id. */
  const sortBlocks = (blocks: AttachedBlock[]): AttachedBlock[] =>
    blocks.sort(
      (a, b) =>
        (KIND_RANK[a.kind] ?? 3) - (KIND_RANK[b.kind] ?? 3) ||
        cmpId(a.nodeId, b.nodeId),
    );

  // ---- STEP 4: build VERSE SECTIONS -----------------------------------------
  const ownedByVerse = new Map<string, string[]>(); // verseId -> [nonVerse ids]
  for (const v of verseIds) ownedByVerse.set(v, []);
  for (const id of nonVerseIds) {
    // owner.has — not `if (v)` — so a verse with an empty-string id still owns.
    if (owner.has(id)) ownedByVerse.get(owner.get(id)!)!.push(id);
  }

  const verseSections: VerseSection[] = verseIds
    .slice()
    .sort(cmpVerse)
    .map((v) => {
      const k = verseKey.get(v)!;
      const seeAlso: CrossRef[] = [];
      for (const pair of crossPairs) {
        const [a, b] = pair.split("|");
        const other = a === v ? b : b === v ? a : null;
        if (!other) continue;
        seeAlso.push({
          label: displayRef(other),
          targetNodeId: other,
          via: "crossref",
          unparseable: refUnparseable(other),
        });
      }
      seeAlso.sort(
        (x, y) =>
          cmpVerse(x.targetNodeId, y.targetNodeId) ||
          cmpId(x.targetNodeId, y.targetNodeId),
      );

      const attached = sortBlocks(
        ownedByVerse.get(v)!.map((id) => {
          const block = toBlock(id);
          const others = [...(multiHits.get(id) ?? [])]
            .filter((x) => x !== v)
            .sort((p, q) => cmpVerse(p, q) || cmpId(p, q))
            .map(
              (x): CrossRef => ({
                label: displayRef(x),
                targetNodeId: x,
                via: "manual",
                unparseable: refUnparseable(x),
              }),
            );
          block.alsoRelatesTo = others;
          return block;
        }),
      );

      return {
        type: "verse",
        nodeId: v,
        ref: k.displayRef,
        rawRef: k.rawRef,
        unparseable: !k.parsed,
        runs: buildRuns(v),
        isAnchor: v === primaryNodeId,
        attached,
        seeAlso,
      };
    });

  // ---- STEP 5 + 6: verse-less components -> themed / orphan ------------------
  const unreached = nonVerseIds.filter((id) => !owner.has(id));
  const unreachedSet = new Set(unreached);
  const visited = new Set<string>();
  const themedSections: ThemedSection[] = [];
  const orphanBlocks: AttachedBlock[] = [];

  for (const start of unreached.slice().sort(cmpId)) {
    if (visited.has(start)) continue;
    const comp: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const u = queue.shift()!;
      comp.push(u);
      for (const w of [...adj.get(u)!].sort(cmpId)) {
        if (unreachedSet.has(w) && !visited.has(w)) {
          visited.add(w);
          queue.push(w);
        }
      }
    }
    if (comp.length >= 2) {
      const blocks = sortBlocks(comp.map(toBlock));
      const lead = blocks.find((b) => (b.body || b.term || "").trim() !== "");
      const raw = (lead ? lead.body || lead.term || "" : "")
        .replace(/\s+/g, " ")
        .trim();
      const heading = raw
        ? raw.length > 60
          ? `${raw.slice(0, 60).trimEnd()}…`
          : raw
        : "Untitled group";
      themedSections.push({
        type: "themed",
        groupId: comp.slice().sort(cmpId)[0],
        heading,
        isAnchor: primaryNodeId !== null && comp.includes(primaryNodeId),
        blocks,
      });
    } else {
      orphanBlocks.push(toBlock(comp[0]));
    }
  }
  themedSections.sort((a, b) => cmpId(a.groupId, b.groupId));

  // ---- STEP 9: assemble + two-sided preservation guard ----------------------
  const sections: DocSection[] = [...verseSections, ...themedSections];
  let orphanSection: OrphanSection | undefined;
  if (orphanBlocks.length) {
    orphanSection = {
      type: "orphans",
      heading: "Loose notes",
      blocks: sortBlocks(orphanBlocks),
    };
    sections.push(orphanSection);
  }

  // Walk the assembled tree: catch drops (append) and duplicates (dev throw).
  const emitted = new Set<string>();
  const duplicates: string[] = [];
  const count = (id: string) => {
    if (emitted.has(id)) duplicates.push(id);
    else emitted.add(id);
  };
  for (const s of sections) {
    if (s.type === "verse") {
      count(s.nodeId);
      for (const b of s.attached) count(b.nodeId);
    } else {
      for (const b of s.blocks) count(b.nodeId);
    }
  }
  const missing = ids.filter((id) => !emitted.has(id));
  if (missing.length) {
    if (!orphanSection) {
      orphanSection = { type: "orphans", heading: "Loose notes", blocks: [] };
      sections.push(orphanSection);
    }
    for (const id of missing.sort(cmpId)) {
      orphanSection.blocks.push(toBlock(id));
      emitted.add(id);
    }
  }
  if (process.env.NODE_ENV !== "production" && duplicates.length) {
    throw new Error(
      `compileToStudyDoc: node(s) emitted more than once: ${duplicates.join(", ")}`,
    );
  }

  return {
    title: mapName,
    sections,
    stats: {
      nodeCount: ids.length,
      emittedNodeCount: emitted.size,
      verseCount: verseIds.length,
      themedSectionCount: themedSections.length,
      orphanCount: orphanSection?.blocks.length ?? 0,
      edgeCount,
      // Sorted so identical content in a different node-array order yields an
      // identical StudyDoc (raw ref strings — no node ids involved).
      unparseableRefs: unparseableRefs.slice().sort(),
    },
  };
}
