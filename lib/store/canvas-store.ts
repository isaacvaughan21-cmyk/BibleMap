import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { track } from "@/lib/analytics";
import * as repo from "@/lib/db/repo";
import { db, ROOT_MAP_ID, type DbEdge, type DbNode } from "@/lib/db/schema";
import { parseImport } from "@/lib/map-io";
import { DEFAULT_VERSION } from "@/lib/versions";
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

/** A rung in the breadcrumb trail of opened bubbles. */
export type MapCrumb = { id: string; label: string };

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
  /** Flip an edge's source and target — reverses the arrowhead. */
  reverseEdge(id: string): void;
  /** Re-attach one end of an edge to a different node (drag-to-reconnect). */
  reconnectEdge(oldEdge: HodosEdge, connection: Connection): void;
  replaceAll(nodes: HodosNode[], edges: HodosEdge[]): void;
  selectAll(): void;
  selectOnly(id: string): void;
  reloadFromDb(): Promise<void>;
  /** Node whose verse is being chosen in the picker, if any. */
  versePickerNodeId: string | null;
  setVersePicker(id: string | null): void;
  /**
   * Create a verse bubble joined to `sourceId` by a crossref edge. With an
   * explicit position (a drag-drop), it lands there; otherwise it's offset
   * to the right of the source.
   */
  addVerseWithCrossRef(
    sourceId: string,
    verseRef: string,
    verseText: string,
    position?: { x: number; y: number },
  ): string;
  /** Rebuild IndexedDB from the last-good localStorage snapshot. */
  recoverFromSnapshot(): Promise<boolean>;
  /** Wipe the local database and start over. */
  startFresh(): Promise<void>;
  mapName: string;
  setMapName(name: string): void;
  /**
   * The most recent deletion (coalesced across one gesture) — powers the
   * one-shot "Restore" toast. Not an undo stack.
   */
  lastDeletion: {
    nodes: HodosNode[];
    edges: HodosEdge[];
    at: number;
  } | null;
  restoreLastDeletion(): void;
  /** First-run hint bar — shown until dismissed once. */
  hintsDismissed: boolean;
  dismissHints(): void;
  /** Clone a bubble (offset, selected). Returns the new id, or null. */
  duplicateNode(id: string): string | null;

  /* ---- Nested maps ---- */
  /** The map currently on screen (ROOT_MAP_ID at the top level). */
  currentMapId: string;
  /** Breadcrumb trail from the root to the current map. */
  mapPath: MapCrumb[];
  /** Ids of bubbles on the current map that already contain a child map. */
  childMapIds: Set<string>;
  /**
   * The anchor bubble of the current map — the mirror of the bubble you dove
   * into. You can't dive into it again (no zooming the same bubble twice).
   * Null on the root and on legacy maps seeded before this was tracked.
   */
  anchorNodeId: string | null;
  /** Dive into a bubble's child map (seeding it on first open). */
  openNode(id: string): Promise<void>;
  /** Jump to a breadcrumb level (0 = root). */
  goToMap(index: number): Promise<void>;
  /** Up one level. */
  goUp(): Promise<void>;
  /**
   * A requested navigation, picked up by the canvas to play the zoom
   * transition before performing the actual map switch.
   */
  pendingNav:
    | { kind: "open"; id: string }
    | { kind: "goto"; index: number }
    | { kind: "canvas"; id: string }
    | null;
  requestOpen(id: string): void;
  requestGoTo(index: number): void;
  clearPendingNav(): void;

  /* ---- Canvases (independent top-level maps) ---- */
  /** All top-level canvases. The first is always the root. */
  canvases: { id: string; name: string }[];
  /** The canvas currently in view. */
  activeCanvasId: string;
  /** Create a blank canvas and slide to it. Returns its id. */
  createCanvas(): string;
  /** Request a sideways slide to an existing canvas. */
  requestCanvas(id: string): void;
  /** Perform the canvas switch (called by the slide animation). */
  switchCanvas(id: string): Promise<void>;
  /** Delete a canvas and all of its content (and any maps nested inside it). */
  deleteCanvas(id: string): Promise<void>;
  /** Re-read canvases + settings + the active map from the DB (after a cloud
   *  pull brings new data into IndexedDB). */
  rehydrate(): Promise<void>;

  /* ---- Settings ---- */
  /** The Bible translation used for new verse lookups + the study panel. */
  bibleVersion: string;
  setBibleVersion(code: string): void;
}

export const DEFAULT_MAP_NAME = "Untitled map";

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

/**
 * Drag-and-drop payload for a cross-reference dragged out of the study panel.
 * Module-scoped (not store state) so setting it never re-renders the canvas.
 */
let crossRefDragPayload: {
  sourceId: string;
  verseRef: string;
  text: Promise<string>;
} | null = null;
export function setCrossRefDrag(p: typeof crossRefDragPayload) {
  crossRefDragPayload = p;
}
export function takeCrossRefDrag() {
  const p = crossRefDragPayload;
  crossRefDragPayload = null;
  return p;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * The map dirty rows belong to. Mirrors the store's currentMapId so the
 * module-level toDbNode/toDbEdge can stamp mapId without reaching into state.
 * Navigation flushes before switching, so dirty rows are always this map's.
 */
let activeMapId: string = ROOT_MAP_ID;

/**
 * `/app?synthetic=300&edges=500` loads an in-memory stress map for perf work.
 * Ephemeral mode never touches IndexedDB, so real maps stay safe.
 */
let ephemeralMode = false;

function buildSynthetic(nodeCount: number, edgeCount: number) {
  const sampleTexts = [
    "In the beginning God created the heavens and the earth.",
    "The LORD is my shepherd; I shall not want.",
    "For God so loved the world that He gave His one and only Son.",
    "Your word is a lamp to my feet and a light to my path.",
  ];
  const cols = Math.ceil(Math.sqrt(nodeCount * 1.8));
  const nodes: HodosNode[] = Array.from({ length: nodeCount }, (_, i) => {
    const kind = (["question", "verse", "note"] as const)[i % 3];
    const position = {
      x: (i % cols) * 340 + ((i * 97) % 60),
      y: Math.floor(i / cols) * 220 + ((i * 53) % 50),
    };
    if (kind === "verse") {
      return {
        id: `syn-${i}`,
        type: "verse",
        position,
        data: {
          verseRef: `Psalm ${(i % 150) + 1}:1`,
          verseText: sampleTexts[i % sampleTexts.length],
        },
      };
    }
    return {
      id: `syn-${i}`,
      type: kind,
      position,
      data: {
        content:
          kind === "question"
            ? `Synthetic question #${i} — how do these connect?`
            : `Synthetic note #${i}: ${sampleTexts[i % sampleTexts.length]}`,
      },
    } as HodosNode;
  });
  const edges: HodosEdge[] = Array.from({ length: edgeCount }, (_, i) => {
    const source = i % nodeCount;
    const target = (source + 1 + ((i * 7) % (nodeCount - 1))) % nodeCount;
    return {
      id: `syn-e-${i}`,
      source: `syn-${source}`,
      target: `syn-${target}`,
      type: i % 4 === 0 ? "crossref" : "manual",
    };
  });
  return { nodes, edges };
}

export const SNAPSHOT_KEY = "hodos.snapshot";

const mapIdById = new Map<string, string>();

function toDbNode(n: HodosNode, now: number): DbNode {
  const isVerse = n.type === "verse";
  const isDef = n.type === "definition";
  const data = n.data as VerseNodeData & {
    content?: string;
    definition?: string;
  };
  return {
    id: n.id,
    mapId: mapIdById.get(n.id) ?? activeMapId,
    type: n.type as NodeKind,
    content: isVerse ? "" : (data.content ?? ""),
    verseRef: isVerse ? data.verseRef : undefined,
    verseText: isVerse ? data.verseText : undefined,
    definition: isDef ? (data.definition ?? "") : undefined,
    position: { x: n.position.x, y: n.position.y },
    createdAt: createdAtById.get(n.id) ?? now,
    updatedAt: now,
  };
}

function toDbEdge(e: HodosEdge, now: number): DbEdge {
  return {
    id: e.id,
    mapId: mapIdById.get(e.id) ?? activeMapId,
    source: e.source,
    target: e.target,
    kind: (e.type ?? "manual") as EdgeKind,
    createdAt: createdAtById.get(e.id) ?? now,
    updatedAt: now,
  };
}

/** Remember per-record provenance so flushes always stamp the right map. */
function registerLoaded(nodes: DbNode[], edges: DbEdge[]) {
  nodes.forEach((n) => {
    createdAtById.set(n.id, n.createdAt);
    updatedAtById.set(n.id, n.updatedAt);
    mapIdById.set(n.id, n.mapId);
  });
  edges.forEach((e) => {
    createdAtById.set(e.id, e.createdAt);
    mapIdById.set(e.id, e.mapId);
  });
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
  if (r.type === "definition") {
    return {
      id: r.id,
      type: "definition",
      position: r.position,
      data: { content: r.content, definition: r.definition ?? "" },
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

/** Last-good copy of the WHOLE tree in localStorage — corruption recovery. */
async function writeSnapshot() {
  try {
    const data = await repo.exportData();
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data));
  } catch {
    // quota or privacy mode — snapshot is best-effort
  }
}

/** Breadcrumb / anchor label for a bubble. */
function labelFor(node: HodosNode): string {
  const text =
    node.type === "verse"
      ? node.data.verseRef || node.data.verseText
      : node.data.content;
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return node.type === "verse"
      ? "Untitled verse"
      : node.type === "question"
        ? "Untitled question"
        : node.type === "definition"
          ? "Untitled definition"
          : "Untitled note";
  }
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

export const useCanvasStore = create<CanvasStore>()((set, get) => {
  function scheduleFlush() {
    if (ephemeralMode) return; // synthetic stress maps never persist
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
      await writeSnapshot();
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
    mapIdById.set(id, activeMapId);
    scheduleFlush();
  }

  /** Force a synchronous flush — used before navigating between maps. */
  async function flushPending() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flush();
  }

  /**
   * Every live node + edge inside a canvas, walking into nested child maps
   * (a bubble's child map has mapId === the bubble's id). Used to delete a
   * whole canvas and everything dived into it.
   */
  async function collectCanvasContent(
    rootId: string,
  ): Promise<{ nodeIds: string[]; edgeIds: string[] }> {
    const seen = new Set<string>();
    const queue = [rootId];
    const nodeIds: string[] = [];
    const edgeIds: string[] = [];
    while (queue.length) {
      const mapId = queue.shift() as string;
      if (seen.has(mapId)) continue;
      seen.add(mapId);
      const { nodes, edges } = await repo.loadLive(mapId);
      for (const n of nodes) {
        nodeIds.push(n.id);
        queue.push(n.id); // each node may host a child map
      }
      for (const e of edges) edgeIds.push(e.id);
    }
    return { nodeIds, edgeIds };
  }

  /** Resolve the anchor (self-mirror) bubble of a map; null = none. */
  async function refreshAnchor(mapId: string) {
    if (mapId === ROOT_MAP_ID) {
      set({ anchorNodeId: null });
      return;
    }
    const aid = (await repo.getMeta<string>(`anchor:${mapId}`)) ?? null;
    set({ anchorNodeId: aid });
  }

  /** Recompute which on-screen bubbles already hold a child map. */
  async function refreshChildMapIds() {
    try {
      const ids = await repo.childMapIds(get().nodes.map((n) => n.id));
      set({ childMapIds: ids });
    } catch {
      set({ childMapIds: new Set() });
    }
  }

  /** Swap the visible map after a flush. */
  function applyMap(
    mapId: string,
    path: MapCrumb[],
    nodes: DbNode[],
    edges: DbEdge[],
  ) {
    activeMapId = mapId;
    registerLoaded(nodes, edges);
    set({
      currentMapId: mapId,
      mapPath: path,
      nodes: nodes.map(fromDbNode),
      edges: edges.map(fromDbEdge),
      editingNodeId: null,
      lastDeletion: null,
      versePickerNodeId: null,
    });
  }

  /**
   * An untitled canvas borrows the name of its first meaningful bubble — a
   * verse contributes just its reference ("John 3:16"), not the verse text.
   * Only the top level of a canvas is named this way, and only while it's
   * still "Untitled map" (a deliberate rename is never overwritten).
   */
  function maybeAutoName(node: HodosNode) {
    if (ephemeralMode) return;
    const s = get();
    if (s.mapPath.length !== 1) return;
    if (s.mapName !== DEFAULT_MAP_NAME) return;
    const name =
      node.type === "verse"
        ? (node.data.verseRef || "").trim()
        : (node.data.content || "").trim();
    if (!name) return;
    get().setMapName(name);
  }

  /** Group node + edge removals from one gesture into a single restorable unit. */
  function recordDeletion(nodes: HodosNode[], edges: HodosEdge[]) {
    const prev = get().lastDeletion;
    const now = Date.now();
    if (prev && now - prev.at < 400) {
      set({
        lastDeletion: {
          nodes: [...prev.nodes, ...nodes],
          edges: [...prev.edges, ...edges],
          at: prev.at,
        },
      });
    } else {
      set({ lastDeletion: { nodes, edges, at: now } });
    }
  }

  return {
    nodes: [],
    edges: [],
    loaded: false,
    loadError: null,
    editingNodeId: null,
    saveState: "idle",
    versePickerNodeId: null,
    mapName: DEFAULT_MAP_NAME,
    lastDeletion: null,
    hintsDismissed: true, // assume dismissed until load() learns otherwise
    currentMapId: ROOT_MAP_ID,
    mapPath: [{ id: ROOT_MAP_ID, label: DEFAULT_MAP_NAME }],
    childMapIds: new Set<string>(),
    anchorNodeId: null,
    pendingNav: null,
    canvases: [{ id: ROOT_MAP_ID, name: DEFAULT_MAP_NAME }],
    activeCanvasId: ROOT_MAP_ID,
    bibleVersion: DEFAULT_VERSION,

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        // Synthetic stress-test mode (?synthetic=300&edges=500) — in-memory only.
        const params =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const synthetic = params?.get("synthetic");
        if (synthetic) {
          ephemeralMode = true;
          const n = Math.min(Number(synthetic) || 300, 2000);
          const e = Math.min(
            Number(params?.get("edges")) || Math.round((n * 5) / 3),
            4000,
          );
          const data = buildSynthetic(n, e);
          set({ nodes: data.nodes, edges: data.edges, loaded: true });
          return;
        }

        try {
          // Canvas registry — migrate from the legacy single `mapName`.
          const legacyName =
            (await repo.getMeta<string>("mapName")) ?? DEFAULT_MAP_NAME;
          const canvases = (await repo.getMeta<{ id: string; name: string }[]>(
            "canvases",
          )) ?? [{ id: ROOT_MAP_ID, name: legacyName }];
          const savedActive =
            (await repo.getMeta<string>("activeCanvas")) ?? ROOT_MAP_ID;
          const active = canvases.some((c) => c.id === savedActive)
            ? savedActive
            : ROOT_MAP_ID;
          const activeName =
            canvases.find((c) => c.id === active)?.name ?? legacyName;

          set({
            canvases,
            activeCanvasId: active,
            mapName: activeName,
            hintsDismissed: !!(await repo.getMeta<boolean>("hintsDismissed")),
            bibleVersion:
              (await repo.getMeta<string>("bibleVersion")) ?? DEFAULT_VERSION,
          });

          // New users start with a blank canvas (no sample map seeded).
          const { nodes, edges } = await repo.loadLive(active);
          activeMapId = active;
          registerLoaded(nodes, edges);
          set({
            currentMapId: active,
            mapPath: [{ id: active, label: activeName }],
            nodes: nodes.map(fromDbNode),
            edges: edges.map(fromDbEdge),
            loaded: true,
            loadError: null,
          });
          await refreshChildMapIds();
          track("map_size", { nodes: nodes.length, edges: edges.length });
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
      const removedNodes = removed.length
        ? get().nodes.filter((n) => removed.includes(n.id))
        : [];
      set({ nodes: applyNodeChanges(changes, get().nodes) });
      for (const id of removed) {
        deletedNodeIds.add(id);
        dirtyNodeIds.delete(id);
        if (get().editingNodeId === id) set({ editingNodeId: null });
      }
      moved.forEach((id) => dirtyNodeIds.add(id));
      if (removedNodes.length) recordDeletion(removedNodes, []);
      if (removed.length || moved.length) scheduleFlush();
    },

    onEdgesChange(changes) {
      const removed = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      const removedEdges = removed.length
        ? get().edges.filter((e) => removed.includes(e.id))
        : [];
      set({ edges: applyEdgeChanges(changes, get().edges) });
      for (const id of removed) {
        deletedEdgeIds.add(id);
        dirtyEdgeIds.delete(id);
      }
      if (removedEdges.length) recordDeletion([], removedEdges);
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
      track("edge_drawn", { kind: "manual" });
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
      track("bubble_created", { type });
      return id;
    },

    updateNodeData(id, data) {
      let updated: HodosNode | undefined;
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== id) return n;
          updated = { ...n, data: { ...n.data, ...data } } as HodosNode;
          return updated;
        }),
      });
      markNodeDirty(id);
      if (updated) maybeAutoName(updated);
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

    reverseEdge(id) {
      set({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, source: e.target, target: e.source } : e,
        ),
      });
      dirtyEdgeIds.add(id);
      scheduleFlush();
    },

    reconnectEdge(oldEdge, connection) {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      set({
        edges: get().edges.map((e) =>
          e.id === oldEdge.id
            ? { ...e, source: connection.source!, target: connection.target! }
            : e,
        ),
      });
      dirtyEdgeIds.add(oldEdge.id);
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

    setVersePicker(id) {
      set({ versePickerNodeId: id });
    },

    addVerseWithCrossRef(sourceId, verseRef, verseText, explicitPosition) {
      const source = get().nodes.find((n) => n.id === sourceId);
      const siblings = get().edges.filter(
        (e) => e.source === sourceId && e.type === "crossref",
      ).length;
      const position =
        explicitPosition ??
        (source
          ? {
              x: source.position.x + 380,
              y: source.position.y + siblings * 150 - 40,
            }
          : { x: 0, y: 0 });

      const nodeId = uuidv7();
      createdAtById.set(nodeId, Date.now());
      const node: HodosNode = {
        id: nodeId,
        type: "verse",
        position,
        data: { verseRef, verseText },
      };
      const edge: HodosEdge = {
        id: uuidv7(),
        source: sourceId,
        target: nodeId,
        type: "crossref",
      };
      createdAtById.set(edge.id, Date.now());
      set({ nodes: [...get().nodes, node], edges: [...get().edges, edge] });
      dirtyNodeIds.add(nodeId);
      updatedAtById.set(nodeId, Date.now());
      dirtyEdgeIds.add(edge.id);
      scheduleFlush();
      maybeAutoName(node);
      track("crossref_added", { ref: verseRef });
      return nodeId;
    },

    async recoverFromSnapshot() {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(SNAPSHOT_KEY)
          : null;
      if (!raw) return false;
      try {
        const data = parseImport(raw);
        try {
          await db.delete();
        } catch {
          // already unusable — Dexie recreates on next open
        }
        await repo.importReplace(data);
        window.location.reload();
        return true;
      } catch (err) {
        console.error("hodos: snapshot recovery failed", err);
        return false;
      }
    },

    async startFresh() {
      try {
        await db.delete();
      } catch {
        // ignore — reload recreates
      }
      window.location.reload();
    },

    setMapName(name) {
      const trimmed = name.trim().slice(0, 120) || DEFAULT_MAP_NAME;
      // The root crumb mirrors the active canvas name.
      const path = get().mapPath.map((c, i) =>
        i === 0 ? { ...c, label: trimmed } : c,
      );
      const canvases = get().canvases.map((c) =>
        c.id === get().activeCanvasId ? { ...c, name: trimmed } : c,
      );
      set({ mapName: trimmed, mapPath: path, canvases });
      if (!ephemeralMode) {
        void repo.setMeta("mapName", trimmed); // legacy mirror
        void repo.setMeta("canvases", canvases);
      }
    },

    dismissHints() {
      set({ hintsDismissed: true });
      if (!ephemeralMode) void repo.setMeta("hintsDismissed", true);
    },

    duplicateNode(id) {
      const src = get().nodes.find((n) => n.id === id);
      if (!src) return null;
      const newId = uuidv7();
      createdAtById.set(newId, Date.now());
      const clone = {
        ...src,
        id: newId,
        position: { x: src.position.x + 28, y: src.position.y + 28 },
        selected: true,
        data: { ...src.data },
      } as HodosNode;
      set({
        nodes: [
          ...get().nodes.map((n) =>
            n.selected ? { ...n, selected: false } : n,
          ),
          clone,
        ],
      });
      markNodeDirty(newId);
      track("bubble_created", { type: src.type as string, via: "duplicate" });
      return newId;
    },

    restoreLastDeletion() {
      const del = get().lastDeletion;
      if (!del) return;
      const nodeIds = new Set(get().nodes.map((n) => n.id));
      const edgeIds = new Set(get().edges.map((e) => e.id));
      const nodes = del.nodes
        .filter((n) => !nodeIds.has(n.id))
        .map((n) => ({ ...n, selected: false }) as HodosNode);
      const stillThere = new Set([...nodeIds, ...nodes.map((n) => n.id)]);
      const edges = del.edges.filter(
        (e) =>
          !edgeIds.has(e.id) &&
          stillThere.has(e.source) &&
          stillThere.has(e.target),
      );
      set({
        nodes: [...get().nodes, ...nodes],
        edges: [...get().edges, ...edges],
        lastDeletion: null,
      });
      // Re-upserting without deletedAt resurrects the soft-deleted rows.
      nodes.forEach((n) => {
        deletedNodeIds.delete(n.id);
        dirtyNodeIds.add(n.id);
        updatedAtById.set(n.id, Date.now());
      });
      edges.forEach((e) => {
        deletedEdgeIds.delete(e.id);
        dirtyEdgeIds.add(e.id);
      });
      scheduleFlush();
    },

    /** Re-read everything from Dexie (used after import) — back to the root. */
    async reloadFromDb() {
      const savedName =
        (await repo.getMeta<string>("mapName")) ?? get().mapName;
      const { nodes, edges } = await repo.loadLive(ROOT_MAP_ID);
      applyMap(
        ROOT_MAP_ID,
        [{ id: ROOT_MAP_ID, label: savedName }],
        nodes,
        edges,
      );
      set({ mapName: savedName, anchorNodeId: null });
      await refreshChildMapIds();
      await writeSnapshot();
    },

    /* ---------------- Nested-map navigation ---------------- */

    async openNode(id) {
      if (ephemeralMode) return; // synthetic stress maps don't nest
      const node = get().nodes.find((n) => n.id === id);
      if (!node) return;
      await flushPending();

      const childMapId = id;
      let { nodes, edges } = await repo.loadLive(childMapId);

      // First open ever → seed the child map with an anchor mirroring the
      // bubble you came from, so it's "isolated" at the center of its world.
      const openedBefore = await repo.getMeta<boolean>(`opened:${childMapId}`);
      if (nodes.length === 0 && !openedBefore) {
        const now = Date.now();
        const anchorBase = {
          id: uuidv7(),
          mapId: childMapId,
          position: { x: 0, y: 0 },
          createdAt: now,
          updatedAt: now,
        };
        const anchor: DbNode =
          node.type === "verse"
            ? {
                ...anchorBase,
                type: "verse",
                content: "",
                verseRef: node.data.verseRef,
                verseText: node.data.verseText,
              }
            : {
                ...anchorBase,
                type: node.type,
                content: node.data.content,
              };
        await repo.upsertNodes([anchor]);
        await repo.setMeta(`anchor:${childMapId}`, anchor.id);
        nodes = [anchor];
      }
      if (!openedBefore) await repo.setMeta(`opened:${childMapId}`, true);

      applyMap(
        childMapId,
        [...get().mapPath, { id: childMapId, label: labelFor(node) }],
        nodes,
        edges,
      );
      await refreshAnchor(childMapId);
      await refreshChildMapIds();
      track("bubble_opened", { type: node.type as string });
    },

    async goToMap(index) {
      const path = get().mapPath;
      if (index < 0 || index >= path.length || index === path.length - 1)
        return;
      if (ephemeralMode) return;
      await flushPending();
      const target = path[index];
      const { nodes, edges } = await repo.loadLive(target.id);
      applyMap(target.id, path.slice(0, index + 1), nodes, edges);
      await refreshAnchor(target.id);
      await refreshChildMapIds();
    },

    async goUp() {
      await get().goToMap(get().mapPath.length - 2);
    },

    requestOpen(id) {
      if (ephemeralMode || get().pendingNav) return;
      // You can only dive into a given bubble once — its self-mirror anchor
      // on the next canvas can't be dived into again.
      if (id === get().anchorNodeId) return;
      set({ pendingNav: { kind: "open", id } });
    },
    requestGoTo(index) {
      if (ephemeralMode || get().pendingNav) return;
      if (index === get().mapPath.length - 1) return; // already here
      set({ pendingNav: { kind: "goto", index } });
    },
    clearPendingNav() {
      set({ pendingNav: null });
    },

    /* ---------------- Canvases ---------------- */

    createCanvas() {
      const id = uuidv7();
      const canvases = [...get().canvases, { id, name: DEFAULT_MAP_NAME }];
      set({ canvases });
      if (!ephemeralMode) void repo.setMeta("canvases", canvases);
      if (!get().pendingNav) set({ pendingNav: { kind: "canvas", id } });
      return id;
    },

    requestCanvas(id) {
      if (ephemeralMode || get().pendingNav) return;
      if (id === get().activeCanvasId) return; // already here
      set({ pendingNav: { kind: "canvas", id } });
    },

    async switchCanvas(id) {
      if (ephemeralMode) return;
      await flushPending();
      const { nodes, edges } = await repo.loadLive(id);
      const name =
        get().canvases.find((c) => c.id === id)?.name ?? DEFAULT_MAP_NAME;
      applyMap(id, [{ id, label: name }], nodes, edges);
      set({ activeCanvasId: id, mapName: name, anchorNodeId: null });
      if (!ephemeralMode) void repo.setMeta("activeCanvas", id);
      await refreshChildMapIds();
    },

    async deleteCanvas(id) {
      if (ephemeralMode) return;
      const { canvases, activeCanvasId } = get();
      const remaining = canvases.filter((c) => c.id !== id);
      const wasActive = activeCanvasId === id;
      const isLast = remaining.length === 0;

      // Settle any live edits first so the soft-delete below can't be undone by
      // a later debounced flush re-upserting dirty rows.
      if (wasActive || isLast) await flushPending();

      const { nodeIds, edgeIds } = await collectCanvasContent(id);
      if (nodeIds.length) await repo.softDeleteNodes(nodeIds);
      if (edgeIds.length) await repo.softDeleteEdges(edgeIds);

      // Deleting your ONLY canvas clears it back to a fresh, blank canvas
      // (same id) rather than leaving you with nothing.
      if (isLast) {
        const cleared = [{ id, name: DEFAULT_MAP_NAME }];
        set({ canvases: cleared, mapName: DEFAULT_MAP_NAME });
        void repo.setMeta("canvases", cleared);
        void repo.setMeta("mapName", DEFAULT_MAP_NAME);
        applyMap(id, [{ id, label: DEFAULT_MAP_NAME }], [], []);
        set({ activeCanvasId: id, anchorNodeId: null });
        await refreshChildMapIds();
        void writeSnapshot();
        return;
      }

      set({ canvases: remaining });
      void repo.setMeta("canvases", remaining);

      // If we deleted the canvas in view, slide to a neighbour (the existing
      // canvas transition flushes — now a no-op — loads it, and re-frames).
      if (wasActive && !get().pendingNav) {
        set({ pendingNav: { kind: "canvas", id: remaining[0].id } });
      }

      // Refresh the recovery snapshot so a deleted canvas can't resurface from
      // it (deleting a non-active canvas never triggers a flush otherwise).
      void writeSnapshot();
    },

    setBibleVersion(code) {
      set({ bibleVersion: code });
      if (!ephemeralMode) void repo.setMeta("bibleVersion", code);
    },

    async rehydrate() {
      if (ephemeralMode) return;
      const canvases =
        (await repo.getMeta<{ id: string; name: string }[]>("canvases")) ??
        get().canvases;
      const savedActive = (await repo.getMeta<string>("activeCanvas")) ?? null;
      const active =
        savedActive && canvases.some((c) => c.id === savedActive)
          ? savedActive
          : (canvases.find((c) => c.id === get().activeCanvasId)?.id ??
            canvases[0]?.id ??
            ROOT_MAP_ID);
      const name =
        canvases.find((c) => c.id === active)?.name ?? DEFAULT_MAP_NAME;
      const bibleVersion =
        (await repo.getMeta<string>("bibleVersion")) ?? get().bibleVersion;
      const { nodes, edges } = await repo.loadLive(active);
      applyMap(active, [{ id: active, label: name }], nodes, edges);
      set({
        canvases,
        activeCanvasId: active,
        mapName: name,
        bibleVersion,
        anchorNodeId: null,
      });
      await refreshChildMapIds();
    },
  };
});
