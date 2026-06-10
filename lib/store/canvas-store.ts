import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import * as repo from "@/lib/db/repo";
import type { DbEdge, DbNode } from "@/lib/db/schema";
import { buildSeed } from "@/lib/db/seed";
import { uuidv7 } from "@/lib/uuid";
import type {
  EdgeKind,
  HodosEdge,
  HodosNode,
  NodeKind,
  VerseNodeData,
} from "@/lib/types";

/**
 * Canvas state — mirrors Dexie. Every mutation is optimistic in memory and
 * flushed to IndexedDB on a 250ms debounce. Deletes are soft.
 */

export type SaveState = "idle" | "saving" | "saved";

export interface CanvasStore {
  nodes: HodosNode[];
  edges: HodosEdge[];
  loaded: boolean;
  loadError: string | null;
  editingNodeId: string | null;
  saveState: SaveState;

  load(): Promise<void>;
  onNodesChange(changes: NodeChange<HodosNode>[]): void;
  onEdgesChange(changes: EdgeChange<HodosEdge>[]): void;
  onConnect(connection: Connection): void;
  createNode(type: NodeKind, position: { x: number; y: number }): string;
  updateNodeData(id: string, data: Partial<HodosNode["data"]>): void;
  setEditing(id: string | null): void;
  changeNodeType(id: string, to: NodeKind): void;
  changeEdgeKind(id: string, kind: EdgeKind): void;
  replaceAll(nodes: HodosNode[], edges: HodosEdge[]): void;
  selectAll(): void;
  selectOnly(id: string): void;
  reloadFromDb(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Dirty tracking + debounced flush                                    */
/* ------------------------------------------------------------------ */

const dirtyNodeIds = new Set<string>();
const dirtyEdgeIds = new Set<string>();
const deletedNodeIds = new Set<string>();
const deletedEdgeIds = new Set<string>();
const createdAtById = new Map<string, number>();
const updatedAtById = new Map<string, number>();

/** Recency for command-palette ranking. */
export function getNodeRecency(id: string): number {
  return updatedAtById.get(id) ?? 0;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let loadPromise: Promise<void> | null = null;

export const SNAPSHOT_KEY = "hodos.snapshot";

function toDbNode(n: HodosNode, now: number): DbNode {
  const isVerse = n.type === "verse";
  const data = n.data as VerseNodeData & { content?: string };
  return {
    id: n.id,
    type: n.type as NodeKind,
    content: isVerse ? "" : (data.content ?? ""),
    verseRef: isVerse ? data.verseRef : undefined,
    verseText: isVerse ? data.verseText : undefined,
    position: { x: n.position.x, y: n.position.y },
    createdAt: createdAtById.get(n.id) ?? now,
    updatedAt: now,
  };
}

function toDbEdge(e: HodosEdge, now: number): DbEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    kind: (e.type ?? "manual") as EdgeKind,
    createdAt: createdAtById.get(e.id) ?? now,
    updatedAt: now,
  };
}

function fromDbNode(r: DbNode): HodosNode {
  if (r.type === "verse") {
    return {
      id: r.id,
      type: "verse",
      position: r.position,
      data: { verseRef: r.verseRef ?? "", verseText: r.verseText ?? "" },
    };
  }
  return {
    id: r.id,
    type: r.type,
    position: r.position,
    data: { content: r.content },
  } as HodosNode;
}

function fromDbEdge(r: DbEdge): HodosEdge {
  return { id: r.id, source: r.source, target: r.target, type: r.kind };
}

/** Last-good copy in localStorage — recovery path if IndexedDB corrupts. */
function writeSnapshot(nodes: HodosNode[], edges: HodosEdge[]) {
  try {
    const now = Date.now();
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        nodes: nodes.map((n) => toDbNode(n, now)),
        edges: edges.map((e) => toDbEdge(e, now)),
      }),
    );
  } catch {
    // quota or privacy mode — snapshot is best-effort
  }
}

export const useCanvasStore = create<CanvasStore>()((set, get) => {
  function scheduleFlush() {
    set({ saveState: "saving" });
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
  }

  async function flush() {
    flushTimer = null;
    const { nodes, edges } = get();
    const now = Date.now();
    const nodeRows = nodes
      .filter((n) => dirtyNodeIds.has(n.id))
      .map((n) => toDbNode(n, now));
    const edgeRows = edges
      .filter((e) => dirtyEdgeIds.has(e.id))
      .map((e) => toDbEdge(e, now));
    const delNodes = [...deletedNodeIds];
    const delEdges = [...deletedEdgeIds];
    dirtyNodeIds.clear();
    dirtyEdgeIds.clear();
    deletedNodeIds.clear();
    deletedEdgeIds.clear();

    try {
      await Promise.all([
        nodeRows.length ? repo.upsertNodes(nodeRows) : null,
        edgeRows.length ? repo.upsertEdges(edgeRows) : null,
        delNodes.length ? repo.softDeleteNodes(delNodes) : null,
        delEdges.length ? repo.softDeleteEdges(delEdges) : null,
      ]);
      writeSnapshot(get().nodes, get().edges);
      set({ saveState: "saved" });
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (get().saveState === "saved") set({ saveState: "idle" });
      }, 1800);
    } catch (err) {
      console.error("hodos: save failed", err);
      set({ saveState: "idle" });
    }
  }

  function markNodeDirty(id: string) {
    dirtyNodeIds.add(id);
    updatedAtById.set(id, Date.now());
    scheduleFlush();
  }

  return {
    nodes: [],
    edges: [],
    loaded: false,
    loadError: null,
    editingNodeId: null,
    saveState: "idle",

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        try {
          let { nodes, edges } = await repo.loadLive();
          if (nodes.length === 0 && !(await repo.getMeta("seeded"))) {
            const seed = buildSeed();
            await repo.upsertNodes(seed.nodes);
            await repo.upsertEdges(seed.edges);
            await repo.setMeta("seeded", true);
            nodes = seed.nodes;
            edges = seed.edges;
          }
          nodes.forEach((n) => {
            createdAtById.set(n.id, n.createdAt);
            updatedAtById.set(n.id, n.updatedAt);
          });
          edges.forEach((e) => createdAtById.set(e.id, e.createdAt));
          set({
            nodes: nodes.map(fromDbNode),
            edges: edges.map(fromDbEdge),
            loaded: true,
            loadError: null,
          });
        } catch (err) {
          console.error("hodos: failed to open local database", err);
          set({
            loaded: true,
            loadError:
              err instanceof Error
                ? err.message
                : "Could not open the local database",
          });
        }
      })();
      return loadPromise;
    },

    onNodesChange(changes) {
      const removed = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      const moved = changes
        .filter((c) => c.type === "position")
        .map((c) => c.id);
      set({ nodes: applyNodeChanges(changes, get().nodes) });
      for (const id of removed) {
        deletedNodeIds.add(id);
        dirtyNodeIds.delete(id);
        if (get().editingNodeId === id) set({ editingNodeId: null });
      }
      moved.forEach((id) => dirtyNodeIds.add(id));
      if (removed.length || moved.length) scheduleFlush();
    },

    onEdgesChange(changes) {
      const removed = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      set({ edges: applyEdgeChanges(changes, get().edges) });
      for (const id of removed) {
        deletedEdgeIds.add(id);
        dirtyEdgeIds.delete(id);
      }
      if (removed.length) scheduleFlush();
    },

    onConnect(connection) {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const edge: HodosEdge = {
        id: uuidv7(),
        source: connection.source,
        target: connection.target,
        type: "manual",
      };
      createdAtById.set(edge.id, Date.now());
      set({ edges: [...get().edges, edge] });
      dirtyEdgeIds.add(edge.id);
      scheduleFlush();
    },

    createNode(type, position) {
      const id = uuidv7();
      createdAtById.set(id, Date.now());
      const data =
        type === "verse" ? { verseRef: "", verseText: "" } : { content: "" };
      const node = { id, type, position, data, selected: true } as HodosNode;
      set({
        nodes: [
          ...get().nodes.map((n) =>
            n.selected ? { ...n, selected: false } : n,
          ),
          node,
        ],
        editingNodeId: id,
      });
      markNodeDirty(id);
      return id;
    },

    updateNodeData(id, data) {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id
            ? ({ ...n, data: { ...n.data, ...data } } as HodosNode)
            : n,
        ),
      });
      markNodeDirty(id);
    },

    setEditing(id) {
      set({ editingNodeId: id });
    },

    changeNodeType(id, to) {
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== id) return n;
          const text =
            n.type === "verse"
              ? n.data.verseText || n.data.verseRef
              : n.data.content;
          const base = {
            id: n.id,
            position: n.position,
            selected: n.selected,
          };
          if (to === "verse") {
            return {
              ...base,
              type: "verse",
              data: { verseRef: "", verseText: text },
            } as HodosNode;
          }
          return { ...base, type: to, data: { content: text } } as HodosNode;
        }),
      });
      markNodeDirty(id);
    },

    changeEdgeKind(id, kind) {
      set({
        edges: get().edges.map((e) => (e.id === id ? { ...e, type: kind } : e)),
      });
      dirtyEdgeIds.add(id);
      scheduleFlush();
    },

    replaceAll(nodes, edges) {
      const now = Date.now();
      nodes.forEach((n) => createdAtById.set(n.id, now));
      edges.forEach((e) => createdAtById.set(e.id, now));
      set({ nodes, edges, editingNodeId: null });
    },

    selectAll() {
      set({
        nodes: get().nodes.map((n) =>
          n.selected ? n : { ...n, selected: true },
        ),
        edges: get().edges.map((e) =>
          e.selected ? e : { ...e, selected: true },
        ),
      });
    },

    selectOnly(id) {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id
            ? { ...n, selected: true }
            : n.selected
              ? { ...n, selected: false }
              : n,
        ),
      });
    },

    /** Re-read everything from Dexie (used after import). */
    async reloadFromDb() {
      const { nodes, edges } = await repo.loadLive();
      nodes.forEach((n) => {
        createdAtById.set(n.id, n.createdAt);
        updatedAtById.set(n.id, n.updatedAt);
      });
      edges.forEach((e) => createdAtById.set(e.id, e.createdAt));
      set({
        nodes: nodes.map(fromDbNode),
        edges: edges.map(fromDbEdge),
        editingNodeId: null,
      });
      writeSnapshot(get().nodes, get().edges);
    },
  };
});
