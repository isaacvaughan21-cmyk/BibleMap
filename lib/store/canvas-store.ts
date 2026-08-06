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
import { getBrowserClient, isCloudEnabled } from "@/lib/supabase-browser";
import {
  broadcastCursor,
  broadcastLock,
  closeGroupChannel,
  colorForUser,
  createGroup as createGroupRpc,
  fetchGroupContent,
  joinGroupByCode,
  leaveGroup as leaveGroupRpc,
  listGroupCanvases,
  openGroupChannel,
  pushGroupRows,
  renameGroupCanvasRow,
  renameGroupRpc,
  shareCanvasRow,
  subscribeGroupCanvases,
  unshareCanvasRow,
  unsubscribeGroupCanvases,
  listMyGroups,
  type EditLock,
  type GroupCanvasRow,
  type GroupMemberMeta,
  type GroupRow,
  type RemoteCursor,
} from "@/lib/groups/realtime";
import { DEFAULT_MAP_NAME } from "@/lib/library/constants";
import {
  MAX_TAGS_PER_CANVAS,
  normalizeCanvases,
  normalizeShelves,
  type CanvasEntry,
  type Shelf,
} from "@/lib/library/model";
import { parseImport } from "@/lib/map-io";
import { DEFAULT_VERSION } from "@/lib/versions";
import { DEFAULT_THEME } from "@/lib/themes";
import { uuidv7 } from "@/lib/uuid";
import {
  advanceStreak,
  celebrationFor,
  EMPTY_STREAK,
  isMilestone,
  localDayKey,
  reconcileStreak,
  type StreakState,
} from "@/lib/streak";
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

  /* ---- Undo / redo ---- */
  /** Whether there's a step to undo / redo (drives the control buttons). */
  canUndo: boolean;
  canRedo: boolean;
  /** Step back to the state before the last edit. Returns false if empty. */
  undo(): boolean;
  /** Re-apply the last undone edit. Returns false if empty. */
  redo(): boolean;

  /** First-run hint bar — shown until dismissed once. */
  hintsDismissed: boolean;
  dismissHints(): void;
  /** True while the guided tour is walking — quieter chrome yields to it. */
  tourActive: boolean;
  setTourActive(v: boolean): void;
  /** Clone a bubble (offset, selected). Returns the new id, or null. */
  duplicateNode(id: string): string | null;
  /**
   * Create a populated bubble from the notes view. With a `parentId` it's
   * joined under that bubble by a manual edge (mirroring "a point under a
   * topic" in the compiled notes); without one it's a free-floating bubble.
   * Returns the new node id.
   */
  addNoteNode(input: {
    type: NodeKind;
    data: HodosNode["data"];
    parentId?: string | null;
  }): string;

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
  /**
   * All top-level canvases, with the organisation a reader has put on them —
   * shelf, tags, pin, archive. See lib/library/model.
   */
  canvases: CanvasEntry[];
  /** Named collections a canvas can sit on. One shelf per canvas. */
  shelves: Shelf[];
  /** The canvas currently in view. */
  activeCanvasId: string;
  /** Create a blank canvas and slide to it. Returns its id. */
  createCanvas(shelfId?: string | null): string;
  /** Request a sideways slide to an existing canvas. */
  requestCanvas(id: string): void;
  /** Perform the canvas switch (called by the slide animation). */
  switchCanvas(id: string): Promise<void>;
  /** Delete a canvas and all of its content (and any maps nested inside it). */
  deleteCanvas(id: string): Promise<void>;

  /* ---- The Library ---- */
  /**
   * Whether the Library is on screen. It's the zoom level ABOVE the root
   * canvas, not a modal — the canvas stays mounted underneath so the camera can
   * pull back into it and grow back out of it.
   */
  libraryOpen: boolean;
  /** Open the Library, optionally landing on a group's shelf of shared studies. */
  openLibrary(groupId?: string): void;
  closeLibrary(): void;
  /**
   * The group the Library should open on, if any — set when arriving from the
   * group menu, cleared once the Library has read it.
   */
  libraryGroupFocus: string | null;
  clearLibraryGroupFocus(): void;
  /** Rename any canvas, in view or not. */
  renameCanvas(id: string, name: string): void;
  /** Move a canvas onto a shelf, or off every shelf with null. */
  setCanvasShelf(id: string, shelfId: string | null): void;
  /** Add a tag if absent, remove it if present. */
  toggleCanvasTag(id: string, tag: string): void;
  setCanvasPinned(id: string, pinned: boolean): void;
  /**
   * Archive rather than delete. A finished study leaves every view but the
   * Archive shelf and keeps all of its content — the reader can always come
   * back to it. Deleting stays available for genuine mistakes.
   */
  setCanvasArchived(id: string, archived: boolean): void;
  /** Create a shelf. Returns its id. */
  createShelf(name: string): string;
  renameShelf(id: string, name: string): void;
  /** Remove a shelf; the studies on it fall back to unshelved. */
  deleteShelf(id: string): void;
  /** Mark a shelf as an ordered series (cards then show their number). */
  setShelfSequential(id: string, sequential: boolean): void;
  /** Re-read canvases + settings + the active map from the DB (after a cloud
   *  pull brings new data into IndexedDB). */
  rehydrate(): Promise<void>;

  /* ---- Settings ---- */
  /** The Bible translation used for new verse lookups + the study panel. */
  bibleVersion: string;
  setBibleVersion(code: string): void;
  /** Bubble colour theme id (see lib/themes.ts). "classic" = uniform look. */
  colorTheme: string;
  setColorTheme(id: string): void;

  /* ---- Daily streak ---- */
  /**
   * Consecutive days the reader has placed at least one bubble. Reconciled
   * against the calendar on load, advanced whenever a new bubble is created.
   */
  streak: StreakState;
  /**
   * Transient "words of encouragement" shown the moment a placement carries the
   * streak into a new day. The badge renders it, then calls dismiss to clear it.
   */
  streakCelebration: {
    count: number;
    message: string;
    milestone: boolean;
  } | null;
  dismissStreakCelebration(): void;

  /* ---- Group map sharing (live collaboration) ---- */
  /**
   * The live session, when the canvas on screen is one a group shares. Null in
   * ordinary solo canvases.
   */
  groupSession: GroupSession | null;
  /**
   * Every group this reader belongs to — the "My groups" section of the
   * Library. Cloud truth, refreshed by `refreshGroups`; empty when signed out.
   */
  myGroups: GroupRow[];
  /** Members currently connected to the active group channel (incl. self). */
  groupMembersOnline: GroupMemberMeta[];
  /** Other members' live cursors, keyed by user id (flow coordinates). */
  remoteCursors: Record<string, RemoteCursor>;
  /**
   * Bubbles a peer is currently editing, keyed by node id — an exclusive edit
   * lock. While a lock is held, this client can't open that bubble's editor.
   */
  remoteLocks: Record<string, EditLock>;
  /** Create a named group with a first shared study, and show it. */
  createGroup(name: string): Promise<GroupRow | null>;
  /** Join a group by invite code; pulls its shared studies into the Library. */
  joinGroup(
    code: string,
  ): Promise<{ group: GroupRow | null; error: string | null }>;
  /** Rename a group. Any member may. */
  renameGroup(groupId: string, name: string): Promise<void>;
  /**
   * Re-read my groups and the studies they share, registering any study a
   * member has added and pruning any that left. Safe to call often.
   */
  refreshGroups(): Promise<void>;
  /** Start a NEW shared study in a group. Returns its canvas id. */
  createGroupCanvas(groupId: string, name?: string): Promise<string | null>;
  /**
   * Share one of my own studies with a group — it stays mine (and stays on my
   * shelves), and everyone in the group gets it live. Returns the canvas id,
   * which may differ from the one passed if a legacy canvas had to be re-keyed.
   */
  shareCanvasWithGroup(
    canvasId: string,
    groupId: string,
  ): Promise<string | null>;
  /** Take a study back out of its group. My own copy survives; others' don't. */
  unshareCanvas(canvasId: string): Promise<void>;
  /**
   * Leave a group — drop membership, remove the studies that belonged to the
   * group, and keep the ones I brought in.
   */
  leaveGroup(groupId: string): Promise<void>;
  /** Broadcast the local cursor to peers (throttle at the call site). */
  publishCursor(x: number, y: number): void;
  /**
   * Reconcile the live session with the current auth state — open the channel
   * when a signed-in user is on a group canvas, close it on sign-out. Called
   * whenever the signed-in user changes.
   */
  refreshGroupSession(): Promise<void>;
}

/** A live shared-canvas session — one group, one of its studies. */
export type GroupSession = {
  groupId: string;
  canvasId: string;
  inviteCode: string;
  /** The group's name — the room. */
  groupName: string;
  /** This study's name — the map on the table. */
  canvasName: string;
  role: string;
};

/**
 * Local record of a shared canvas: which group it belongs to, and enough of
 * that group to render the session badge before any network call returns.
 */
type GroupCanvasInfo = {
  canvasId: string;
  groupId: string;
  inviteCode: string;
  groupName: string;
  role: string;
};

/** The shape persisted under meta["groups"], keyed by canvas id. */
type StoredGroupCanvas = Omit<GroupCanvasInfo, "canvasId">;

export { DEFAULT_MAP_NAME };

/**
 * True when a stored registry still has rows in the pre-Library `{ id, name }`
 * shape — the cue to write the widened rows back once, rather than re-deriving
 * them on every load.
 */
function needsWidening(rows: unknown[]): boolean {
  return rows.some(
    (r) =>
      !r ||
      typeof r !== "object" ||
      typeof (r as { createdAt?: unknown }).createdAt !== "number",
  );
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

/**
 * Undo / redo history for the CURRENT map. Each entry is the whole
 * {nodes, edges} of a map as it was before an edit. The store only ever
 * replaces these arrays (never mutates them in place), so a snapshot can hold
 * the live references — no cloning needed. Cleared on every map/canvas switch.
 */
type HistorySnap = { nodes: HodosNode[]; edges: HodosEdge[] };
const undoStack: HistorySnap[] = [];
const redoStack: HistorySnap[] = [];
const HISTORY_LIMIT = 60;
/** True between a drag's first move and its drop — so one drag = one undo step. */
let midDrag = false;

function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  midDrag = false;
}

/** Recency for command-palette ranking. */
export function getNodeRecency(id: string): number {
  return updatedAtById.get(id) ?? 0;
}

/**
 * Id of the first bubble placed on the current map — the lowest uuid v7 (they
 * sort by creation time), regardless of bubble type. The first bubble is the
 * anchor of a study, so it gets a persistent emphasis (see `.node-primary`).
 */
export function usePrimaryNodeId(): string | null {
  return useCanvasStore((s) => {
    let firstId: string | null = null;
    for (const n of s.nodes)
      if (firstId === null || n.id < firstId) firstId = n.id;
    return firstId;
  });
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

/**
 * The group whose shared canvas is currently on screen, or null in a solo
 * canvas — plus which of that group's studies it is. Set on entering a group
 * session; drives the flush mirror. Kept at module scope so `flush()` can read
 * it without a store round-trip.
 */
let activeGroupId: string | null = null;
let activeGroupCanvasId: string | null = null;
/** Presence identity for the active session (self), or null when solo. */
let sessionMe: GroupMemberMeta | null = null;
/** True once the standing watch on every group's canvas list is running. */
let watchingGroupCanvases = false;
/** Registry of group-backed canvases, keyed by canvas id. */
const groupByCanvasId = new Map<string, GroupCanvasInfo>();

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
    highlights: isVerse ? data.highlights : undefined,
    highlightColors: isVerse ? data.highlightColors : undefined,
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
      data: {
        verseRef: r.verseRef ?? "",
        verseText: r.verseText ?? "",
        ...(r.highlights?.length ? { highlights: r.highlights } : {}),
        ...(r.highlightColors ? { highlightColors: r.highlightColors } : {}),
      },
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
      // Mirror the very same rows to the group tables when the canvas on
      // screen is a shared one. Aligning the echo clock (updatedAtById) to the
      // pushed rows' timestamps lets applyRemoteRows filter our own echoes.
      if (activeGroupId && activeGroupCanvasId) {
        for (const r of nodeRows) updatedAtById.set(r.id, r.updatedAt);
        for (const r of edgeRows) updatedAtById.set(r.id, r.updatedAt);
        void pushGroupRows(
          activeGroupId,
          activeGroupCanvasId,
          nodeRows,
          edgeRows,
          delNodes,
          delEdges,
        );
      }
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

  /**
   * Count a freshly placed bubble toward the daily streak. The first bubble of a
   * new calendar day extends (or restarts) the streak and pops a line of
   * encouragement; later bubbles the same day are a no-op. Synthetic stress
   * maps never touch the streak.
   */
  function noteBubblePlaced() {
    if (ephemeralMode) return;
    const today = localDayKey();
    const reconciled = reconcileStreak(get().streak, today);
    const { next, changed } = advanceStreak(reconciled, today);
    if (!changed) {
      if (reconciled !== get().streak) set({ streak: reconciled });
      return;
    }
    set({
      streak: next,
      streakCelebration: {
        count: next.count,
        message: celebrationFor(next.count),
        milestone: isMilestone(next.count),
      },
    });
    void repo.setMeta("streak", next);
    track("streak_advanced", { count: next.count, best: next.best });
  }

  /**
   * Snapshot the current map onto the undo stack — call BEFORE a mutation, so
   * undo restores the state as it was just before. A fresh edit invalidates the
   * redo stack. Selection-only changes don't call this (they aren't edits).
   */
  function pushHistory() {
    if (ephemeralMode) return;
    const { nodes, edges } = get();
    undoStack.push({ nodes, edges });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    if (!get().canUndo || get().canRedo) set({ canUndo: true, canRedo: false });
  }

  /**
   * Replace the live map with a history snapshot, reconciling the persistence
   * bookkeeping: nodes/edges the snapshot drops are soft-deleted; nodes/edges it
   * brings back (or changes) are re-marked dirty so the next flush writes them
   * (re-upserting a soft-deleted row without `deletedAt` resurrects it).
   */
  function applyHistorySnapshot(snap: HistorySnap) {
    const now = Date.now();
    const cur = get();
    const snapNodeIds = new Set(snap.nodes.map((n) => n.id));
    const snapEdgeIds = new Set(snap.edges.map((e) => e.id));
    for (const n of cur.nodes)
      if (!snapNodeIds.has(n.id)) {
        deletedNodeIds.add(n.id);
        dirtyNodeIds.delete(n.id);
      }
    for (const e of cur.edges)
      if (!snapEdgeIds.has(e.id)) {
        deletedEdgeIds.add(e.id);
        dirtyEdgeIds.delete(e.id);
      }
    for (const n of snap.nodes) {
      deletedNodeIds.delete(n.id);
      dirtyNodeIds.add(n.id);
      updatedAtById.set(n.id, now);
      mapIdById.set(n.id, activeMapId);
      if (!createdAtById.has(n.id)) createdAtById.set(n.id, now);
    }
    for (const e of snap.edges) {
      deletedEdgeIds.delete(e.id);
      dirtyEdgeIds.add(e.id);
      mapIdById.set(e.id, activeMapId);
      if (!createdAtById.has(e.id)) createdAtById.set(e.id, now);
    }
    set({
      nodes: snap.nodes,
      edges: snap.edges,
      editingNodeId: null,
      versePickerNodeId: null,
    });
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

  /**
   * Every live row of a canvas — the root map and every map nested inside it.
   * What a first share has to hand the group.
   */
  async function collectCanvasRows(
    rootId: string,
  ): Promise<{ nodes: DbNode[]; edges: DbEdge[] }> {
    const seen = new Set<string>();
    const queue = [rootId];
    const nodes: DbNode[] = [];
    const edges: DbEdge[] = [];
    while (queue.length) {
      const mapId = queue.shift() as string;
      if (seen.has(mapId)) continue;
      seen.add(mapId);
      const live = await repo.loadLive(mapId);
      for (const n of live.nodes) {
        nodes.push(n);
        queue.push(n.id);
      }
      edges.push(...live.edges);
    }
    return { nodes, edges };
  }

  /**
   * Give a canvas a new id, rewriting the mapId of every bubble on its root
   * map. Only ever needed for the very first canvas a reader is given, whose
   * id is the literal `root` — a name every OTHER reader's first canvas also
   * has, so sharing it as-is would collide on their machine. Bubble ids and
   * nested maps are uuidv7 and already unique, so nothing else has to move.
   */
  async function rekeyCanvas(oldId: string, newId: string) {
    await flushPending();
    const now = Date.now();
    const { nodes, edges } = await repo.loadLive(oldId);
    if (nodes.length)
      await repo.upsertNodes(
        nodes.map((n) => ({ ...n, mapId: newId, updatedAt: now })),
      );
    if (edges.length)
      await repo.upsertEdges(
        edges.map((e) => ({ ...e, mapId: newId, updatedAt: now })),
      );
    for (const n of nodes) mapIdById.set(n.id, newId);
    for (const e of edges) mapIdById.set(e.id, newId);

    persistCanvases(
      get().canvases.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
    );

    if (get().activeCanvasId === oldId) {
      const atRoot = get().currentMapId === oldId;
      if (atRoot) activeMapId = newId;
      set({
        activeCanvasId: newId,
        ...(atRoot ? { currentMapId: newId } : {}),
        // The root crumb is the canvas itself, however deep the reader is.
        mapPath: get().mapPath.map((c, i) =>
          i === 0 ? { ...c, id: newId } : c,
        ),
      });
      await repo.setMeta("activeCanvas", newId);
    }
    await writeSnapshot();
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

  /**
   * Leaving a nested map you dove into but never used: if all that remains is
   * the seeded anchor (mirroring the bubble you came from) and no edges, throw
   * the child map away so the parent bubble stops advertising a nested canvas.
   * Clearing the `opened`/`anchor` markers lets a later dive reseed it cleanly.
   * Call this AFTER flushing pending edits and BEFORE swapping to the new map.
   */
  async function discardCurrentIfEmpty() {
    const s = get();
    if (s.mapPath.length <= 1) return; // top-level canvases are never discarded
    const mapId = s.currentMapId;
    if (mapId === ROOT_MAP_ID) return;
    const anchorId = s.anchorNodeId;
    const onlyAnchor =
      s.edges.length === 0 &&
      (s.nodes.length === 0 ||
        (s.nodes.length === 1 && s.nodes[0].id === anchorId));
    if (!onlyAnchor) return;
    try {
      if (anchorId) {
        await repo.softDeleteNodes([anchorId]);
        mapIdById.delete(anchorId);
        createdAtById.delete(anchorId);
        updatedAtById.delete(anchorId);
        dirtyNodeIds.delete(anchorId);
      }
      await repo.setMeta(`opened:${mapId}`, false);
      await repo.setMeta(`anchor:${mapId}`, undefined);
    } catch (err) {
      console.error("hodos: failed to discard empty nested map", err);
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
    clearHistory();
    set({
      currentMapId: mapId,
      mapPath: path,
      nodes: nodes.map(fromDbNode),
      edges: edges.map(fromDbEdge),
      editingNodeId: null,
      lastDeletion: null,
      versePickerNodeId: null,
      canUndo: false,
      canRedo: false,
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

  /* ---------------- Group sharing (live collaboration) ---------------- */

  /** Presence display name for the signed-in user. */
  async function currentDisplayName(): Promise<string> {
    const client = getBrowserClient();
    const res = await client?.auth.getUser();
    const u = res?.data.user;
    const meta = (u?.user_metadata ?? {}) as { name?: string };
    return meta.name || u?.email?.split("@")[0] || "Member";
  }

  /**
   * Merge inbound remote rows (from a peer's push or the seed fetch) into the
   * local map, last-write-wins by `updatedAt` — the same rule the single-user
   * cloud sync uses. Rows are written to Dexie WITHOUT being marked dirty (so
   * they never bounce back out), and, when they belong to the map on screen,
   * patched straight into the live view. A bubble the local user is actively
   * editing or dragging is left untouched.
   */
  async function applyRemoteRows(
    incomingNodes: DbNode[],
    incomingEdges: DbEdge[],
  ) {
    if (!incomingNodes.length && !incomingEdges.length) return;
    try {
      await db.transaction("rw", db.nodes, db.edges, async () => {
        for (const n of incomingNodes) {
          const existing = await db.nodes.get(n.id);
          if (!existing || existing.updatedAt < n.updatedAt)
            await db.nodes.put(n);
        }
        for (const e of incomingEdges) {
          const existing = await db.edges.get(e.id);
          if (!existing || existing.updatedAt < e.updatedAt)
            await db.edges.put(e);
        }
      });
    } catch (err) {
      console.error("hodos: remote merge failed", err);
    }

    const s = get();
    const curMap = s.currentMapId;
    let nextNodes = s.nodes;
    let changedNodes = false;
    let nextLocks = s.remoteLocks;
    let locksChanged = false;
    for (const n of incomingNodes) {
      if (n.mapId !== curMap) continue;
      // Filter self-echoes and stale writes via the shared updatedAt clock.
      if (n.updatedAt <= (updatedAtById.get(n.id) ?? 0)) continue;
      if (s.editingNodeId === n.id || dirtyNodeIds.has(n.id)) continue;
      updatedAtById.set(n.id, n.updatedAt);
      mapIdById.set(n.id, n.mapId);
      if (!createdAtById.has(n.id)) createdAtById.set(n.id, n.createdAt);
      if (n.deletedAt) {
        const before = nextNodes.length;
        nextNodes = nextNodes.filter((x) => x.id !== n.id);
        if (nextNodes.length !== before) changedNodes = true;
        if (nextLocks[n.id]) {
          nextLocks = { ...nextLocks };
          delete nextLocks[n.id];
          locksChanged = true;
        }
      } else {
        const live = fromDbNode(n);
        const idx = nextNodes.findIndex((x) => x.id === n.id);
        if (idx === -1) {
          nextNodes = [...nextNodes, live];
        } else {
          const prev = nextNodes[idx];
          nextNodes = nextNodes.map((x) =>
            x.id === n.id
              ? ({ ...live, selected: prev.selected } as HodosNode)
              : x,
          );
        }
        changedNodes = true;
      }
    }

    let nextEdges = s.edges;
    let changedEdges = false;
    for (const e of incomingEdges) {
      if (e.mapId !== curMap) continue;
      if (e.updatedAt <= (updatedAtById.get(e.id) ?? 0)) continue;
      if (dirtyEdgeIds.has(e.id)) continue;
      updatedAtById.set(e.id, e.updatedAt);
      mapIdById.set(e.id, e.mapId);
      if (!createdAtById.has(e.id)) createdAtById.set(e.id, e.createdAt);
      if (e.deletedAt) {
        const before = nextEdges.length;
        nextEdges = nextEdges.filter((x) => x.id !== e.id);
        if (nextEdges.length !== before) changedEdges = true;
      } else {
        const live = fromDbEdge(e);
        const idx = nextEdges.findIndex((x) => x.id === e.id);
        if (idx === -1) nextEdges = [...nextEdges, live];
        else
          nextEdges = nextEdges.map((x) =>
            x.id === e.id ? { ...live, selected: x.selected } : x,
          );
        changedEdges = true;
      }
    }

    if (changedNodes || changedEdges || locksChanged) {
      set({
        ...(changedNodes ? { nodes: nextNodes } : {}),
        ...(changedEdges ? { edges: nextEdges } : {}),
        ...(locksChanged ? { remoteLocks: nextLocks } : {}),
      });
      if (changedNodes) void refreshChildMapIds();
    }
  }

  /** Announce that this member started/stopped editing a bubble. */
  function broadcastEditLock(nodeId: string, editing: boolean) {
    if (!activeGroupId || !sessionMe) return;
    broadcastLock({
      nodeId,
      editing,
      userId: sessionMe.userId,
      name: sessionMe.name,
      color: sessionMe.color,
    });
  }

  /**
   * Apply a peer's edit lock/unlock. On a simultaneous grab of the SAME bubble,
   * the lower user id wins deterministically (both clients compute the same
   * result), so exactly one editor survives — the other yields its editor.
   */
  function applyRemoteLock(p: EditLock & { editing: boolean }) {
    const s = get();
    if (p.editing) {
      if (s.editingNodeId === p.nodeId && sessionMe) {
        if (p.userId < sessionMe.userId) {
          // Peer wins the tie — release our editor and let theirs stand.
          set({ editingNodeId: null });
          broadcastEditLock(p.nodeId, false);
        } else {
          // We win — ignore their claim; they'll yield on their side.
          return;
        }
      }
      set({
        remoteLocks: {
          ...s.remoteLocks,
          [p.nodeId]: {
            nodeId: p.nodeId,
            userId: p.userId,
            name: p.name,
            color: p.color,
          },
        },
      });
    } else if (s.remoteLocks[p.nodeId]?.userId === p.userId) {
      const next = { ...s.remoteLocks };
      delete next[p.nodeId];
      set({ remoteLocks: next });
    }
  }

  /** Open the realtime channel and seed the shared canvas from the cloud. */
  async function enterGroupSession(info: GroupCanvasInfo) {
    if (!isCloudEnabled()) return;
    const client = getBrowserClient();
    const res = await client?.auth.getUser();
    const user = res?.data.user;
    if (!user) return; // collaboration requires a signed-in identity
    const me: GroupMemberMeta = {
      userId: user.id,
      name: await currentDisplayName(),
      color: colorForUser(user.id),
    };
    activeGroupId = info.groupId;
    activeGroupCanvasId = info.canvasId;
    sessionMe = me;
    set({
      groupSession: {
        groupId: info.groupId,
        canvasId: info.canvasId,
        inviteCode: info.inviteCode,
        groupName: info.groupName,
        canvasName:
          get().canvases.find((c) => c.id === info.canvasId)?.name ??
          DEFAULT_MAP_NAME,
        role: info.role,
      },
      groupMembersOnline: [me],
      remoteCursors: {},
    });
    try {
      const { nodes, edges } = await fetchGroupContent(info.canvasId);
      await applyRemoteRows(nodes, edges);
    } catch (err) {
      console.error("hodos: group seed failed", err);
    }
    openGroupChannel(info.groupId, info.canvasId, me, {
      onRows: (n, e) => void applyRemoteRows(n, e),
      onPresence: (members) => {
        // Drop cursors + edit locks held by anyone who has left, so a peer
        // that disconnects mid-edit can never wedge a bubble locked.
        const online = new Set(members.map((m) => m.userId));
        const s = get();
        const remoteCursors = Object.fromEntries(
          Object.entries(s.remoteCursors).filter(([, c]) =>
            online.has(c.userId),
          ),
        );
        const remoteLocks = Object.fromEntries(
          Object.entries(s.remoteLocks).filter(([, l]) => online.has(l.userId)),
        );
        set({ groupMembersOnline: members, remoteCursors, remoteLocks });
      },
      onCursor: (c) =>
        set({ remoteCursors: { ...get().remoteCursors, [c.userId]: c } }),
      onLock: (l) => applyRemoteLock(l),
    });
  }

  /** Tear down the active session (leaving a group canvas or signing out). */
  function exitGroupSession() {
    if (!activeGroupId) return;
    // Release any lock we hold so peers aren't left staring at a stale badge.
    if (get().editingNodeId) broadcastEditLock(get().editingNodeId!, false);
    closeGroupChannel();
    activeGroupId = null;
    activeGroupCanvasId = null;
    sessionMe = null;
    set({
      groupSession: null,
      groupMembersOnline: [],
      remoteCursors: {},
      remoteLocks: {},
    });
  }

  /** Enter or exit a session so it matches the canvas now on screen. */
  async function syncGroupSessionForCanvas(canvasId: string) {
    const info = groupByCanvasId.get(canvasId);
    if (info) {
      if (activeGroupCanvasId !== info.canvasId) {
        exitGroupSession();
        await enterGroupSession(info);
      }
    } else if (activeGroupId) {
      exitGroupSession();
    }
  }

  /** Write the whole group-canvas registry to IndexedDB. */
  async function persistGroupRegistry() {
    const stored: Record<string, StoredGroupCanvas> = {};
    for (const [canvasId, info] of groupByCanvasId) {
      stored[canvasId] = {
        groupId: info.groupId,
        inviteCode: info.inviteCode,
        groupName: info.groupName,
        role: info.role,
      };
    }
    await repo.setMeta("groups", stored);
  }

  /**
   * Register one of a group's shared studies locally: remember which group it
   * belongs to, and put it in the canvas registry so it has a card, a name and
   * a place in the Library.
   */
  async function registerGroupCanvas(
    group: GroupRow,
    canvasId: string,
    canvasName: string,
    opts: { sharedByMe?: boolean } = {},
  ) {
    const info: GroupCanvasInfo = {
      canvasId,
      groupId: group.id,
      inviteCode: group.invite_code,
      groupName: group.name,
      role: group.role ?? "member",
    };
    groupByCanvasId.set(canvasId, info);
    await persistGroupRegistry();

    const existing = get().canvases.find((c) => c.id === canvasId);
    if (existing) {
      // A study created inside the group takes the group's name for it; one
      // brought in from a personal library keeps the name its owner gave it.
      const patch: Partial<CanvasEntry> = {};
      if (existing.groupId !== group.id) patch.groupId = group.id;
      if (opts.sharedByMe && !existing.sharedByMe) patch.sharedByMe = true;
      if (!opts.sharedByMe && existing.name !== canvasName)
        patch.name = canvasName;
      // Registering is also how a refresh confirms what's already true —
      // touching an unchanged row would churn the registry's sync clock.
      if (Object.keys(patch).length) touchCanvas(canvasId, patch);
    } else {
      const now = Date.now();
      persistCanvases([
        ...get().canvases,
        {
          id: canvasId,
          name: canvasName,
          createdAt: now,
          openedAt: now,
          updatedAt: now,
          groupId: group.id,
          ...(opts.sharedByMe ? { sharedByMe: true } : {}),
        },
      ]);
    }
  }

  /**
   * Forget that a canvas is shared. The local study is untouched — this only
   * severs the link, so it stops mirroring and falls back onto the shelves.
   */
  async function unregisterGroupCanvas(canvasId: string) {
    groupByCanvasId.delete(canvasId);
    await persistGroupRegistry();
    if (activeGroupCanvasId === canvasId) exitGroupSession();
  }

  /** Write the registry to state and to IndexedDB in one move. */
  function persistCanvases(canvases: CanvasEntry[]) {
    set({ canvases });
    if (!ephemeralMode) void repo.setMeta("canvases", canvases);
  }

  /**
   * Patch one registry entry. `organisational` edits (shelf, tags, name, pin,
   * archive) bump `updatedAt`, which is what cloud sync compares when two
   * devices disagree; a bare "I opened it" doesn't, so merely visiting a canvas
   * on one device can't overwrite real organisation done on another.
   */
  function touchCanvas(
    id: string,
    patch: Partial<CanvasEntry>,
    opts: { organisational?: boolean } = {},
  ) {
    const now = Date.now();
    const organisational = opts.organisational ?? true;
    let changed = false;
    const canvases = get().canvases.map((c) => {
      if (c.id !== id) return c;
      changed = true;
      const next = { ...c, ...patch };
      if (organisational) next.updatedAt = now;
      // Undefined means "drop this" — keep the stored row lean rather than
      // carrying a graveyard of nulls into the cloud snapshot.
      for (const key of Object.keys(patch) as (keyof CanvasEntry)[]) {
        if (patch[key] === undefined) delete next[key];
      }
      return next;
    });
    if (!changed) return;
    persistCanvases(canvases);
  }

  /**
   * Load persisted group-canvas records into the in-memory registry. Records
   * written before a group could hold more than one study are keyed by group
   * id and carry the group's name under `name` — back then the canvas id WAS
   * the group id, so the key is both.
   */
  async function loadGroupRegistry() {
    const stored =
      (await repo.getMeta<
        Record<string, StoredGroupCanvas & { name?: string }>
      >("groups")) ?? {};
    groupByCanvasId.clear();
    let migrated = false;
    for (const [canvasId, meta] of Object.entries(stored)) {
      if (!meta) continue;
      const legacy = !meta.groupId;
      if (legacy) migrated = true;
      groupByCanvasId.set(canvasId, {
        canvasId,
        groupId: meta.groupId ?? canvasId,
        inviteCode: meta.inviteCode ?? "",
        groupName: meta.groupName ?? meta.name ?? "Group",
        role: meta.role ?? "member",
      });
      // The pre-multi-canvas registry never marked the canvas as a group one.
      if (legacy && get().canvases.some((c) => c.id === canvasId))
        touchCanvas(canvasId, { groupId: meta.groupId ?? canvasId });
    }
    if (migrated) await persistGroupRegistry();
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
    tourActive: false,
    currentMapId: ROOT_MAP_ID,
    mapPath: [{ id: ROOT_MAP_ID, label: DEFAULT_MAP_NAME }],
    childMapIds: new Set<string>(),
    anchorNodeId: null,
    pendingNav: null,
    canvases: normalizeCanvases(null, {
      id: ROOT_MAP_ID,
      name: DEFAULT_MAP_NAME,
    }),
    shelves: [],
    libraryOpen: false,
    libraryGroupFocus: null,
    activeCanvasId: ROOT_MAP_ID,
    bibleVersion: DEFAULT_VERSION,
    colorTheme: DEFAULT_THEME,
    canUndo: false,
    canRedo: false,
    streak: EMPTY_STREAK,
    streakCelebration: null,
    groupSession: null,
    myGroups: [],
    groupMembersOnline: [],
    remoteCursors: {},
    remoteLocks: {},

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
          // Canvas registry — migrate from the legacy single `mapName`, then
          // widen any `{ id, name }` rows written before the Library existed.
          const legacyName =
            (await repo.getMeta<string>("mapName")) ?? DEFAULT_MAP_NAME;
          const storedCanvases = await repo.getMeta<unknown>("canvases");
          const canvases = normalizeCanvases(storedCanvases, {
            id: ROOT_MAP_ID,
            name: legacyName,
          });
          const shelves = normalizeShelves(await repo.getMeta("shelves"));
          // Persist the widened shape once so later writes aren't re-migrating.
          if (!Array.isArray(storedCanvases) || needsWidening(storedCanvases))
            void repo.setMeta("canvases", canvases);
          const savedActive =
            (await repo.getMeta<string>("activeCanvas")) ?? ROOT_MAP_ID;
          const active = canvases.some((c) => c.id === savedActive)
            ? savedActive
            : ROOT_MAP_ID;
          const activeName =
            canvases.find((c) => c.id === active)?.name ?? legacyName;

          // Streak — drop it to 0 if a day (or more) lapsed since the last
          // bubble, and persist the reset so it can't resurrect on next load.
          const storedStreak =
            (await repo.getMeta<StreakState>("streak")) ?? EMPTY_STREAK;
          const reconciledStreak = reconcileStreak(storedStreak, localDayKey());
          if (reconciledStreak !== storedStreak)
            void repo.setMeta("streak", reconciledStreak);

          set({
            canvases,
            shelves,
            activeCanvasId: active,
            mapName: activeName,
            hintsDismissed: !!(await repo.getMeta<boolean>("hintsDismissed")),
            bibleVersion:
              (await repo.getMeta<string>("bibleVersion")) ?? DEFAULT_VERSION,
            colorTheme:
              (await repo.getMeta<string>("colorTheme")) ?? DEFAULT_THEME,
            streak: reconciledStreak,
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
          await loadGroupRegistry();
          void syncGroupSessionForCanvas(active);
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
      // History: snapshot before a deletion, or ONCE at the start of a drag
      // gesture (positions stream while dragging, so coalesce to one step).
      const draggingNow = changes.some(
        (c) => c.type === "position" && c.dragging === true,
      );
      const dropNow = changes.some(
        (c) => c.type === "position" && c.dragging === false,
      );
      if (removed.length) pushHistory();
      else if (draggingNow && !midDrag) {
        pushHistory();
        midDrag = true;
      }
      if (dropNow) midDrag = false;
      const removedNodes = removed.length
        ? get().nodes.filter((n) => removed.includes(n.id))
        : [];
      set({ nodes: applyNodeChanges(changes, get().nodes) });
      for (const id of removed) {
        deletedNodeIds.add(id);
        dirtyNodeIds.delete(id);
        if (get().editingNodeId === id) {
          set({ editingNodeId: null });
          if (activeGroupId) broadcastEditLock(id, false);
        }
      }
      moved.forEach((id) => dirtyNodeIds.add(id));
      if (removedNodes.length) recordDeletion(removedNodes, []);
      if (removed.length || moved.length) scheduleFlush();
    },

    onEdgesChange(changes) {
      const removed = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      if (removed.length) pushHistory();
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
      pushHistory();
      // A line drawn between two verse bubbles is a scripture cross-reference —
      // label it as such automatically. Anything else stays a manual link.
      const ns = get().nodes;
      const src = ns.find((n) => n.id === connection.source);
      const tgt = ns.find((n) => n.id === connection.target);
      const kind: EdgeKind =
        src?.type === "verse" && tgt?.type === "verse" ? "crossref" : "manual";
      const edge: HodosEdge = {
        id: uuidv7(),
        source: connection.source,
        target: connection.target,
        type: kind,
      };
      createdAtById.set(edge.id, Date.now());
      set({ edges: [...get().edges, edge] });
      dirtyEdgeIds.add(edge.id);
      scheduleFlush();
      track("edge_drawn", { kind });
    },

    createNode(type, position) {
      pushHistory();
      const prevEditing = get().editingNodeId;
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
      if (activeGroupId) {
        if (prevEditing) broadcastEditLock(prevEditing, false);
        broadcastEditLock(id, true);
      }
      markNodeDirty(id);
      noteBubblePlaced();
      track("bubble_created", { type });
      return id;
    },

    updateNodeData(id, data) {
      pushHistory();
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
      // Someone else is typing in this bubble — refuse to open its editor.
      if (id) {
        const lock = get().remoteLocks[id];
        if (lock && lock.userId !== sessionMe?.userId) return;
      }
      const prev = get().editingNodeId;
      if (prev === id) return;
      set({ editingNodeId: id });
      if (activeGroupId) {
        if (prev) broadcastEditLock(prev, false);
        if (id) broadcastEditLock(id, true);
      }
    },

    changeNodeType(id, to) {
      pushHistory();
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
      pushHistory();
      set({
        edges: get().edges.map((e) => (e.id === id ? { ...e, type: kind } : e)),
      });
      dirtyEdgeIds.add(id);
      scheduleFlush();
    },

    reverseEdge(id) {
      pushHistory();
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
      pushHistory();
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
      pushHistory();
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
      noteBubblePlaced();
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
      get().renameCanvas(get().activeCanvasId, name);
    },

    dismissHints() {
      set({ hintsDismissed: true });
      if (!ephemeralMode) void repo.setMeta("hintsDismissed", true);
    },

    setTourActive(v) {
      set({ tourActive: v });
    },

    duplicateNode(id) {
      const src = get().nodes.find((n) => n.id === id);
      if (!src) return null;
      pushHistory();
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
      noteBubblePlaced();
      track("bubble_created", { type: src.type as string, via: "duplicate" });
      return newId;
    },

    addNoteNode({ type, data, parentId }) {
      pushHistory();
      const ns = get().nodes;
      const parent =
        parentId != null ? ns.find((n) => n.id === parentId) : undefined;
      // A child lands to the right of its topic, stacked under earlier children;
      // a free-floating bubble drops below the current map so it never overlaps.
      let position: { x: number; y: number };
      if (parent) {
        const siblings = get().edges.filter(
          (e) => e.source === parent.id && e.type === "manual",
        ).length;
        position = {
          x: parent.position.x + 380,
          y: parent.position.y + siblings * 150,
        };
      } else if (ns.length) {
        let maxY = -Infinity;
        let xAtMax = 0;
        for (const n of ns)
          if (n.position.y > maxY) {
            maxY = n.position.y;
            xAtMax = n.position.x;
          }
        position = { x: xAtMax, y: maxY + 200 };
      } else {
        position = { x: 0, y: 0 };
      }

      const nodeId = uuidv7();
      const now = Date.now();
      createdAtById.set(nodeId, now);
      const node = { id: nodeId, type, position, data } as HodosNode;
      set({ nodes: [...get().nodes, node] });
      markNodeDirty(nodeId);

      if (parent) {
        const edge: HodosEdge = {
          id: uuidv7(),
          source: parent.id,
          target: nodeId,
          type: "manual",
        };
        createdAtById.set(edge.id, now);
        set({ edges: [...get().edges, edge] });
        dirtyEdgeIds.add(edge.id);
        scheduleFlush();
      }

      noteBubblePlaced();
      // Deliberately NOT auto-naming the map here: a bubble added from the notes
      // view (often a deep sub-point) shouldn't rename the whole document.
      track("bubble_created", { type, via: "notes" });
      return nodeId;
    },

    restoreLastDeletion() {
      const del = get().lastDeletion;
      if (!del) return;
      pushHistory();
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

    undo() {
      if (!undoStack.length) return false;
      const snap = undoStack.pop() as HistorySnap;
      redoStack.push({ nodes: get().nodes, edges: get().edges });
      applyHistorySnapshot(snap);
      set({ canUndo: undoStack.length > 0, canRedo: true });
      track("history", { action: "undo" });
      return true;
    },

    redo() {
      if (!redoStack.length) return false;
      const snap = redoStack.pop() as HistorySnap;
      undoStack.push({ nodes: get().nodes, edges: get().edges });
      applyHistorySnapshot(snap);
      set({ canUndo: true, canRedo: redoStack.length > 0 });
      track("history", { action: "redo" });
      return true;
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
      await discardCurrentIfEmpty();
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

    createCanvas(shelfId) {
      const id = uuidv7();
      const now = Date.now();
      persistCanvases([
        ...get().canvases,
        {
          id,
          name: DEFAULT_MAP_NAME,
          createdAt: now,
          openedAt: now,
          updatedAt: now,
          ...(shelfId ? { shelfId } : {}),
        },
      ]);
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
      await discardCurrentIfEmpty();
      const { nodes, edges } = await repo.loadLive(id);
      const name =
        get().canvases.find((c) => c.id === id)?.name ?? DEFAULT_MAP_NAME;
      applyMap(id, [{ id, label: name }], nodes, edges);
      set({ activeCanvasId: id, mapName: name, anchorNodeId: null });
      if (!ephemeralMode) void repo.setMeta("activeCanvas", id);
      // Arriving IS opening — this is what the Library sorts "Recent" by.
      touchCanvas(id, { openedAt: Date.now() }, { organisational: false });
      await refreshChildMapIds();
      await syncGroupSessionForCanvas(id);
    },

    /* ---------------- The Library ---------------- */

    openLibrary(groupId) {
      if (ephemeralMode || get().pendingNav) return;
      set({
        libraryOpen: true,
        libraryGroupFocus: groupId ?? null,
        editingNodeId: null,
        versePickerNodeId: null,
      });
      track("library_opened", { canvases: get().canvases.length });
      void get().refreshGroups();
    },

    closeLibrary() {
      set({ libraryOpen: false, libraryGroupFocus: null });
    },

    clearLibraryGroupFocus() {
      set({ libraryGroupFocus: null });
    },

    renameCanvas(id, name) {
      const trimmed = name.trim().slice(0, 120) || DEFAULT_MAP_NAME;
      touchCanvas(id, { name: trimmed });
      // A shared study is named for everyone at once.
      if (groupByCanvasId.has(id)) {
        void renameGroupCanvasRow(id, trimmed);
        if (get().groupSession?.canvasId === id)
          set({
            groupSession: { ...get().groupSession!, canvasName: trimmed },
          });
      }
      // Renaming the canvas in view also retitles the top bar and the root crumb.
      if (id === get().activeCanvasId) {
        set({
          mapName: trimmed,
          mapPath: get().mapPath.map((c, i) =>
            i === 0 ? { ...c, label: trimmed } : c,
          ),
        });
        if (!ephemeralMode) void repo.setMeta("mapName", trimmed);
      }
    },

    setCanvasShelf(id, shelfId) {
      touchCanvas(id, { shelfId: shelfId ?? undefined });
    },

    toggleCanvasTag(id, tag) {
      const clean = tag.trim().slice(0, 32).toLowerCase();
      if (!clean) return;
      const current = get().canvases.find((c) => c.id === id)?.tags ?? [];
      const next = current.includes(clean)
        ? current.filter((t) => t !== clean)
        : [...current, clean].slice(0, MAX_TAGS_PER_CANVAS);
      touchCanvas(id, { tags: next.length ? next : undefined });
    },

    setCanvasPinned(id, pinned) {
      touchCanvas(id, { pinned: pinned || undefined });
    },

    setCanvasArchived(id, archived) {
      touchCanvas(id, { archivedAt: archived ? Date.now() : undefined });
      track("canvas_archived", { archived: archived ? "yes" : "no" });
      // You can't stay standing in a study you just put away. From inside the
      // Library the swap happens straight away — the shelves are covering the
      // canvas, so the fly-over cinematic would play to an empty room, and
      // racing it against a card click could switch twice.
      if (archived && id === get().activeCanvasId) {
        const next = get().canvases.find((c) => c.id !== id && !c.archivedAt);
        if (!next) return;
        if (get().libraryOpen) void get().switchCanvas(next.id);
        else if (!get().pendingNav)
          set({ pendingNav: { kind: "canvas", id: next.id } });
      }
    },

    createShelf(name) {
      const id = uuidv7();
      const trimmed = name.trim().slice(0, 60) || "New shelf";
      const shelves = [
        ...get().shelves,
        { id, name: trimmed, order: get().shelves.length },
      ];
      set({ shelves });
      if (!ephemeralMode) void repo.setMeta("shelves", shelves);
      return id;
    },

    renameShelf(id, name) {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) return;
      const shelves = get().shelves.map((s) =>
        s.id === id ? { ...s, name: trimmed } : s,
      );
      set({ shelves });
      if (!ephemeralMode) void repo.setMeta("shelves", shelves);
    },

    deleteShelf(id) {
      const shelves = get()
        .shelves.filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i }));
      set({ shelves });
      if (!ephemeralMode) void repo.setMeta("shelves", shelves);
      // Emptying a shelf never touches the studies on it — they fall back to
      // unshelved, which is the whole point of archiving over deleting.
      const now = Date.now();
      const canvases = get().canvases.map((c) =>
        c.shelfId === id ? { ...c, shelfId: undefined, updatedAt: now } : c,
      );
      persistCanvases(canvases);
    },

    setShelfSequential(id, sequential) {
      const shelves = get().shelves.map((s) =>
        s.id === id ? { ...s, sequential: sequential || undefined } : s,
      );
      set({ shelves });
      if (!ephemeralMode) void repo.setMeta("shelves", shelves);
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
        const now = Date.now();
        const cleared: CanvasEntry[] = [
          {
            id,
            name: DEFAULT_MAP_NAME,
            createdAt: now,
            openedAt: now,
            updatedAt: now,
          },
        ];
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

      // If we deleted the canvas in view, move to a neighbour. From the canvas
      // that's a slide (the existing transition flushes — now a no-op — loads
      // it, and re-frames); from inside the Library it's an immediate swap,
      // since the shelves are covering the screen and a card click could
      // otherwise race the cinematic into switching twice.
      if (wasActive) {
        if (get().libraryOpen) await get().switchCanvas(remaining[0].id);
        else if (!get().pendingNav)
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

    setColorTheme(id) {
      set({ colorTheme: id });
      if (!ephemeralMode) void repo.setMeta("colorTheme", id);
    },

    dismissStreakCelebration() {
      set({ streakCelebration: null });
    },

    async rehydrate() {
      if (ephemeralMode) return;
      const stored = await repo.getMeta<unknown>("canvases");
      const canvases = stored
        ? normalizeCanvases(stored, {
            id: ROOT_MAP_ID,
            name: get().mapName,
          })
        : get().canvases;
      const shelves = normalizeShelves(await repo.getMeta("shelves"));
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
      const colorTheme =
        (await repo.getMeta<string>("colorTheme")) ?? get().colorTheme;
      const { nodes, edges } = await repo.loadLive(active);
      applyMap(active, [{ id: active, label: name }], nodes, edges);
      set({
        canvases,
        shelves,
        activeCanvasId: active,
        mapName: name,
        bibleVersion,
        colorTheme,
        anchorNodeId: null,
      });
      await refreshChildMapIds();
      await loadGroupRegistry();
      void syncGroupSessionForCanvas(active);
    },

    async createGroup(name) {
      if (!isCloudEnabled()) return null;
      const g = await createGroupRpc(name, await currentDisplayName());
      if (!g) return null;
      set({ myGroups: [g, ...get().myGroups.filter((x) => x.id !== g.id)] });
      // A room with nothing on the table is a dead end — open with one study,
      // named for the group, ready to be worked on together.
      await get().createGroupCanvas(g.id, g.name);
      set({ libraryOpen: true, libraryGroupFocus: g.id });
      track("group_created", {});
      return g;
    },

    async joinGroup(code) {
      if (!isCloudEnabled())
        return { group: null, error: "Cloud isn't enabled." };
      const { group, error } = await joinGroupByCode(
        code,
        await currentDisplayName(),
      );
      if (!group) return { group: null, error };
      await get().refreshGroups();
      set({ libraryOpen: true, libraryGroupFocus: group.id });
      track("group_joined", {});
      return { group, error: null };
    },

    async renameGroup(groupId, name) {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) return;
      const ok = await renameGroupRpc(groupId, trimmed);
      if (!ok) return;
      set({
        myGroups: get().myGroups.map((g) =>
          g.id === groupId ? { ...g, name: trimmed } : g,
        ),
      });
      for (const [canvasId, info] of groupByCanvasId) {
        if (info.groupId === groupId)
          groupByCanvasId.set(canvasId, { ...info, groupName: trimmed });
      }
      await persistGroupRegistry();
      if (get().groupSession?.groupId === groupId)
        set({ groupSession: { ...get().groupSession!, groupName: trimmed } });
    },

    async refreshGroups() {
      if (ephemeralMode || !isCloudEnabled()) return;
      const client = getBrowserClient();
      const res = await client?.auth.getUser();
      if (!res?.data.user) {
        set({ myGroups: [] });
        return;
      }
      const [groups, rows] = await Promise.all([
        listMyGroups(),
        listGroupCanvases(),
      ]);
      // A failed round trip says nothing about what is or isn't shared — keep
      // what we have rather than reconciling against silence.
      if (!groups || !rows) return;
      set({ myGroups: groups });
      const byId = new Map(groups.map((g) => [g.id, g]));

      // Anything a member has shared since we last looked gets a local home,
      // so it has a card in the Library and can be opened like any study.
      const seen = new Set<string>();
      for (const row of rows as GroupCanvasRow[]) {
        const group = byId.get(row.group_id);
        if (!group) continue;
        seen.add(row.id);
        const mine = get().canvases.find((c) => c.id === row.id);
        await registerGroupCanvas(group, row.id, row.name, {
          sharedByMe: mine?.sharedByMe,
        });
      }

      // …and anything unshared, or belonging to a group we've left, stops
      // being a group study. A study we brought in ourselves stays put; one
      // that was the group's goes with it.
      for (const canvasId of [...groupByCanvasId.keys()]) {
        if (seen.has(canvasId)) continue;
        await unregisterGroupCanvas(canvasId);
        const entry = get().canvases.find((c) => c.id === canvasId);
        if (!entry) continue;
        if (entry.sharedByMe)
          touchCanvas(canvasId, { groupId: undefined, sharedByMe: undefined });
        else await get().deleteCanvas(canvasId);
      }

      // One standing subscription, so a study a member shares appears here
      // without a reload. Set up on the first successful refresh only.
      if (!watchingGroupCanvases) {
        watchingGroupCanvases = true;
        subscribeGroupCanvases(() => void get().refreshGroups());
      }
    },

    async createGroupCanvas(groupId, name) {
      if (!isCloudEnabled()) return null;
      const group = get().myGroups.find((g) => g.id === groupId);
      if (!group) return null;
      const canvasId = uuidv7();
      const title = (name ?? "").trim().slice(0, 120) || DEFAULT_MAP_NAME;
      const row = await shareCanvasRow(groupId, canvasId, title);
      if (!row) return null;
      await registerGroupCanvas(group, canvasId, title);
      set({
        myGroups: get().myGroups.map((g) =>
          g.id === groupId
            ? { ...g, canvas_count: (g.canvas_count ?? 0) + 1 }
            : g,
        ),
      });
      return canvasId;
    },

    async shareCanvasWithGroup(canvasId, groupId) {
      if (!isCloudEnabled()) return null;
      const group = get().myGroups.find((g) => g.id === groupId);
      if (!group) return null;
      const entry = get().canvases.find((c) => c.id === canvasId);
      if (!entry || entry.groupId) return null;

      // Every reader's first canvas is called `root`. Sharing one under that
      // name would land on top of the recipient's own — so it takes a real id
      // before it goes anywhere.
      let id = canvasId;
      if (id === ROOT_MAP_ID) {
        id = uuidv7();
        await rekeyCanvas(canvasId, id);
      }

      const row = await shareCanvasRow(groupId, id, entry.name);
      if (!row) return null;
      await registerGroupCanvas(group, id, entry.name, { sharedByMe: true });

      // Hand over what's already on the map — the whole tree, not just the
      // root — in chunks, so a long study doesn't go up as one vast request.
      await flushPending();
      const { nodes, edges } = await collectCanvasRows(id);
      const CHUNK = 150;
      for (let i = 0; i < nodes.length || i < edges.length; i += CHUNK) {
        await pushGroupRows(
          groupId,
          id,
          nodes.slice(i, i + CHUNK),
          edges.slice(i, i + CHUNK),
          [],
          [],
        );
      }
      for (const n of nodes) updatedAtById.set(n.id, n.updatedAt);
      for (const e of edges) updatedAtById.set(e.id, e.updatedAt);

      set({
        myGroups: get().myGroups.map((g) =>
          g.id === groupId
            ? { ...g, canvas_count: (g.canvas_count ?? 0) + 1 }
            : g,
        ),
      });
      // Standing in the study when it's shared? Then the session starts now.
      if (get().activeCanvasId === id) await syncGroupSessionForCanvas(id);
      track("canvas_shared", {});
      return id;
    },

    async unshareCanvas(canvasId) {
      const info = groupByCanvasId.get(canvasId);
      if (!info) return;
      const entry = get().canvases.find((c) => c.id === canvasId);
      await unregisterGroupCanvas(canvasId);
      await unshareCanvasRow(canvasId);
      set({
        myGroups: get().myGroups.map((g) =>
          g.id === info.groupId
            ? { ...g, canvas_count: Math.max(0, (g.canvas_count ?? 1) - 1) }
            : g,
        ),
      });
      // A study of my own comes back to my shelves; one that was the group's
      // has nowhere left to be.
      if (entry?.sharedByMe)
        touchCanvas(canvasId, { groupId: undefined, sharedByMe: undefined });
      else if (entry) await get().deleteCanvas(canvasId);
    },

    async leaveGroup(groupId) {
      if (activeGroupId === groupId) exitGroupSession();
      await leaveGroupRpc(groupId);
      set({ myGroups: get().myGroups.filter((g) => g.id !== groupId) });

      for (const [canvasId, info] of [...groupByCanvasId]) {
        if (info.groupId !== groupId) continue;
        await unregisterGroupCanvas(canvasId);
        const entry = get().canvases.find((c) => c.id === canvasId);
        if (!entry) continue;
        // What I brought in is mine to keep; what the group made goes.
        if (entry.sharedByMe)
          touchCanvas(canvasId, { groupId: undefined, sharedByMe: undefined });
        else await get().deleteCanvas(canvasId);
      }
      track("group_left", {});
    },

    publishCursor(x, y) {
      if (!activeGroupId || !sessionMe) return;
      broadcastCursor({ ...sessionMe, x, y });
    },

    async refreshGroupSession() {
      if (ephemeralMode) return;
      const client = getBrowserClient();
      const res = await client?.auth.getUser();
      if (!res?.data.user) {
        exitGroupSession();
        unsubscribeGroupCanvases();
        watchingGroupCanvases = false;
        set({ myGroups: [] });
        return;
      }
      await get().refreshGroups();
      await syncGroupSessionForCanvas(get().activeCanvasId);
    },
  };
});
