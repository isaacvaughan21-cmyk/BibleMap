"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import "@xyflow/react/dist/style.css";

import { track } from "@/lib/analytics";
import { getVerseByParsed, parseRef } from "@/lib/bible";
import { easeInCubic, easeOutQuint, easeInOutCubic } from "@/lib/easing";
import { takeCrossRefDrag, useCanvasStore } from "@/lib/store/canvas-store";
import * as repo from "@/lib/db/repo";
import { CROSSREF_DRAG_TYPE } from "./CrossRefPanel";
import type { HodosExport } from "@/lib/db/repo";
import { downloadExport, parseImport } from "@/lib/map-io";
import { useCanvasShortcuts } from "@/lib/shortcuts";
import type { EdgeKind, NodeKind } from "@/lib/types";
import TopBar from "./TopBar";
import RightRail from "./RightRail";
import CanvasControls from "./CanvasControls";
import CommandPalette from "./CommandPalette";
import ContextMenu, { type MenuTarget } from "./ContextMenu";
import CreatePicker from "./CreatePicker";
import EmptyState from "./EmptyState";
import FeedbackWidget from "./FeedbackWidget";
import HintBar from "./HintBar";
import HelpOverlay from "./HelpOverlay";
import ImportDialog from "./ImportDialog";
import VersePicker from "./VersePicker";
import WelcomeGate from "./WelcomeGate";
import GuestSavePrompt from "./GuestSavePrompt";
import CloudSync from "./CloudSync";
import QuestionNode from "./nodes/QuestionNode";
import VerseNode from "./nodes/VerseNode";
import NoteNode from "./nodes/NoteNode";
import DefinitionNode from "./nodes/DefinitionNode";
import ManualEdge from "./edges/ManualEdge";
import CrossRefEdge from "./edges/CrossRefEdge";
import EdgeMarkers from "./edges/EdgeMarkers";
import type { VerseNodeType } from "@/lib/types";

const nodeTypes = {
  question: QuestionNode,
  verse: VerseNode,
  note: NoteNode,
  definition: DefinitionNode,
};

const edgeTypes = {
  manual: ManualEdge,
  crossref: CrossRefEdge,
};

/** Minimap echoes the node hierarchy: verses gold, questions ink, notes faint. */
function minimapNodeColor(node: Node): string {
  switch (node.type) {
    case "verse":
      return "var(--gold-soft)";
    case "question":
      return "var(--ink-muted)";
    case "definition":
      return "var(--ink-soft)";
    default:
      return "var(--rule)";
  }
}

const MENU_WIDTH = 192;
const MENU_HEIGHT = 180;

type ToastState = {
  text: string;
  action?: { label: string; run: () => void };
} | null;

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

type PickerState = { x: number; y: number; fx: number; fy: number };

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    loaded,
    loadError,
    onNodesChange,
    onEdgesChange,
    onConnect,
    createNode,
    setEditing,
    changeNodeType,
    changeEdgeKind,
    reverseEdge,
    reconnectEdge,
    updateNodeData,
    duplicateNode,
    load,
  } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      loaded: s.loaded,
      loadError: s.loadError,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      createNode: s.createNode,
      setEditing: s.setEditing,
      changeNodeType: s.changeNodeType,
      changeEdgeKind: s.changeEdgeKind,
      reverseEdge: s.reverseEdge,
      reconnectEdge: s.reconnectEdge,
      updateNodeData: s.updateNodeData,
      duplicateNode: s.duplicateNode,
      load: s.load,
    })),
  );
  const reloadFromDb = useCanvasStore((s) => s.reloadFromDb);
  const versePickerNodeId = useCanvasStore((s) => s.versePickerNodeId);
  const setVersePicker = useCanvasStore((s) => s.setVersePicker);
  // While a dive is in flight, the chrome fades back so the canvas is the star
  const diving = useCanvasStore((s) => !!s.pendingNav);
  const [railOpen, setRailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<string | undefined>();
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [importPending, setImportPending] = useState<HodosExport | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [verseDragActive, setVerseDragActive] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const addVerseWithCrossRef = useCanvasStore((s) => s.addVerseWithCrossRef);

  /** Re-fetch a verse bubble's text in another translation, keeping its ref. */
  const changeVerseVersion = useCallback(
    async (id: string, code: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node || node.type !== "verse") return;
      const parsed = parseRef(node.data.verseRef);
      if (!parsed) return;
      try {
        const { text } = await getVerseByParsed(parsed, code);
        updateNodeData(id, { verseText: text });
      } catch {
        setToast({ text: `Couldn't load that verse in ${code}.` });
      }
    },
    [nodes, updateNodeData],
  );

  useEffect(() => {
    load();
  }, [load]);

  // session_minutes — reported when the tab goes to the background.
  useEffect(() => {
    const start = Date.now();
    const report = () => {
      if (document.visibilityState !== "hidden") return;
      const minutes = Math.round((Date.now() - start) / 60_000);
      if (minutes >= 1) track("session_minutes", { minutes });
    };
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, []);

  useCanvasShortcuts({
    onPalette: () => setPaletteOpen((o) => !o),
    onToggleRail: () => setRailOpen((o) => !o),
    onHelp: () => setHelpOpen(true),
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Every deletion gets a one-shot "Restore" — never lose a thought to a slip.
  const lastDeletion = useCanvasStore((s) => s.lastDeletion);
  const restoreLastDeletion = useCanvasStore((s) => s.restoreLastDeletion);
  useEffect(() => {
    if (!lastDeletion) return;
    const n = lastDeletion.nodes.length;
    const e = lastDeletion.edges.length;
    const text =
      n > 0
        ? n === 1
          ? "Bubble deleted"
          : `${n} bubbles deleted`
        : e === 1
          ? "Connection deleted"
          : `${e} connections deleted`;
    setToast({
      text,
      action: {
        label: "Restore",
        run: () => {
          restoreLastDeletion();
          setToast({ text: "Restored." });
        },
      },
    });
  }, [lastDeletion, restoreLastDeletion]);

  // The cross-ref panel is contextual: selecting a verse bubble (with a
  // reference) surfaces the study rail.
  const selectedVerse =
    (nodes.filter((n) => n.selected && n.type === "verse")[0] as
      | VerseNodeType
      | undefined) ?? null;
  const selectedVerseKey =
    selectedVerse && selectedVerse.data.verseRef ? selectedVerse.id : null;
  useEffect(() => {
    if (selectedVerseKey) setRailOpen(true);
  }, [selectedVerseKey]);

  const handleExport = useCallback(async () => {
    downloadExport(await repo.exportData());
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      setImportPending(parseImport(await file.text()));
    } catch {
      setToast({
        text: "That file doesn't look like a Hodos map (.hodos.json).",
      });
    }
  }, []);

  const setMapName = useCanvasStore((s) => s.setMapName);
  const finishImport = useCallback(
    async (mode: "merge" | "replace") => {
      if (!importPending) return;
      if (mode === "merge") await repo.importMerge(importPending);
      else await repo.importReplace(importPending);
      if (importPending.name && mode === "replace") {
        setMapName(importPending.name);
      }
      await reloadFromDb();
      setImportPending(null);
      setToast({ text: mode === "merge" ? "Map merged." : "Map replaced." });
    },
    [importPending, reloadFromDb, setMapName],
  );

  /** Clamp a popover inside the canvas viewport. */
  const clampToViewport = useCallback((e: React.MouseEvent | MouseEvent) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const x = e.clientX - (bounds?.left ?? 0);
    const y = e.clientY - (bounds?.top ?? 0);
    return {
      x: Math.max(8, Math.min(x, (bounds?.width ?? 0) - MENU_WIDTH - 8)),
      y: Math.max(8, Math.min(y, (bounds?.height ?? 0) - MENU_HEIGHT - 8)),
    };
  }, []);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      setMenu({
        kind: "node",
        id: node.id,
        nodeType: node.type as NodeKind,
        ...clampToViewport(e),
      });
    },
    [clampToViewport],
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setMenu({
        kind: "edge",
        id: edge.id,
        edgeKind: (edge.type ?? "manual") as EdgeKind,
        ...clampToViewport(e),
      });
    },
    [clampToViewport],
  );

  /** Right-click a multi-selection → bulk actions. */
  const onSelectionContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const count = nodes.filter((n) => n.selected).length;
      if (count < 2) return;
      setMenu({ kind: "selection", count, ...clampToViewport(e) });
    },
    [nodes, clampToViewport],
  );

  /** Right-click on empty canvas → create picker, right where you clicked. */
  const { screenToFlowPosition } = useReactFlow();
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      setMenu(null);
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPicker({ ...clampToViewport(e), fx: flow.x, fy: flow.y });
    },
    [clampToViewport, screenToFlowPosition],
  );

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeOverlays = useCallback(() => {
    setMenu(null);
    setPicker(null);
  }, []);
  // A click on blank canvas also dismisses the study panel — clearing the
  // selection should clear what the selection summoned. (Panning, via
  // onMoveStart, only closes the transient popovers, not the panel.)
  const onPaneClick = useCallback(() => {
    closeOverlays();
    setRailOpen(false);
  }, [closeOverlays]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-dvh w-full overflow-hidden bg-parchment"
      data-diving={diving || undefined}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CROSSREF_DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setVerseDragActive(true);
        } else if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) {
          setDragActive(false);
          setVerseDragActive(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        setVerseDragActive(false);
        // A cross-reference dragged out of the study panel
        if (e.dataTransfer.types.includes(CROSSREF_DRAG_TYPE)) {
          const payload = takeCrossRefDrag();
          if (!payload) return;
          const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          payload.text
            .then((text) =>
              addVerseWithCrossRef(
                payload.sourceId,
                payload.verseRef,
                text,
                pos,
              ),
            )
            .catch(() => {
              setToast({ text: "Couldn't place that verse — try again." });
            });
          return;
        }
        const file = e.dataTransfer.files?.[0];
        if (file) handleImportFile(file);
      }}
    >
      {/* Chrome first in DOM — tab order: top bar → rail → controls → canvas */}
      <TopBar
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((o) => !o)}
        onOpenPalette={() => setPaletteOpen(true)}
        onFeedback={() => {
          setFeedbackDraft(undefined);
          setFeedbackOpen((o) => !o);
        }}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onHelp={() => setHelpOpen(true)}
        onRequestVersion={() => {
          setFeedbackDraft(
            "I'd like to study in the ____ translation — please add it to Hodos.",
          );
          setFeedbackOpen(true);
        }}
      />
      <RightRail open={railOpen} selectedVerse={selectedVerse} />
      <CanvasControls railOpen={railOpen} />
      <FeedbackWidget
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        railOpen={railOpen}
        initialMessage={feedbackDraft}
      />

      <main className="absolute inset-0" aria-label="Map canvas">
        {loaded && loadError && <RecoveryScreen />}
        {loaded && !loadError && (
          <FlowSurface
            railOpen={railOpen}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onSelectionContextMenu={onSelectionContextMenu}
            onPaneClick={onPaneClick}
            onMoveStart={closeOverlays}
            onOpenPicker={setPicker}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={reconnectEdge}
            setEditing={setEditing}
            onOpenVersePicker={setVersePicker}
          />
        )}
        {loaded && !loadError && nodes.length === 0 && <EmptyState />}
      </main>

      {!loadError && !toast && <HintBar />}

      {menu && (
        <ContextMenu
          target={menu}
          onChangeNodeType={(id, to) => {
            changeNodeType(id, to);
            closeMenu();
          }}
          onChangeEdgeKind={(id, kind) => {
            changeEdgeKind(id, kind);
            closeMenu();
          }}
          onChangeVerseVersion={(id, code) => {
            void changeVerseVersion(id, code);
            closeMenu();
          }}
          onReverseEdge={(id) => {
            reverseEdge(id);
            closeMenu();
          }}
          onPickVerse={(id) => {
            setVersePicker(id);
            closeMenu();
          }}
          onDuplicate={(id) => {
            duplicateNode(id);
            closeMenu();
          }}
          onDelete={(target) => {
            if (target.kind === "selection") {
              const ids = new Set(
                nodes.filter((n) => n.selected).map((n) => n.id),
              );
              onNodesChange(
                [...ids].map((id) => ({ type: "remove" as const, id })),
              );
              onEdgesChange(
                edges
                  .filter(
                    (e) => ids.has(e.source) || ids.has(e.target) || e.selected,
                  )
                  .map((e) => ({ type: "remove" as const, id: e.id })),
              );
            } else if (target.kind === "node") {
              onNodesChange([{ type: "remove", id: target.id }]);
              onEdgesChange(
                edges
                  .filter(
                    (e) => e.source === target.id || e.target === target.id,
                  )
                  .map((e) => ({ type: "remove" as const, id: e.id })),
              );
            } else {
              onEdgesChange([{ type: "remove", id: target.id }]);
            }
            closeMenu();
          }}
          onClose={closeMenu}
        />
      )}

      {picker && (
        <CreatePicker
          x={picker.x}
          y={picker.y}
          onPick={(type) => {
            const id = createNode(type, { x: picker.fx, y: picker.fy });
            if (type === "verse") {
              // Verses are chosen, not typed — straight into the picker.
              setEditing(null);
              setVersePicker(id);
            }
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {versePickerNodeId && (
        <VersePicker
          nodeId={versePickerNodeId}
          onClose={() => setVersePicker(null)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {importPending && (
        <ImportDialog
          data={importPending}
          onMerge={() => finishImport("merge")}
          onReplace={() => finishImport("replace")}
          onCancel={() => setImportPending(null)}
        />
      )}

      {/* Drag-a-verse affordance — quieter than the import dropzone */}
      {verseDragActive && (
        <div className="pointer-events-none absolute inset-3 z-50 rounded-2xl border-2 border-dashed border-gold/60" />
      )}

      {/* Drag-to-import affordance */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-gold bg-parchment/70 backdrop-blur-[2px]">
          <p className="font-serif text-md italic text-ink-soft">
            Drop a{" "}
            <span className="font-mono not-italic text-gold">.hodos.json</span>{" "}
            to import
          </p>
        </div>
      )}

      {/* v0 beta sign-up gate — first visit only */}
      <WelcomeGate />

      {/* Gentle one-time nudge for guests who've started working */}
      <GuestSavePrompt />

      {/* Mirrors a signed-in user's canvases to the cloud (no-op when off) */}
      <CloudSync />

      {/* Quiet toast */}
      {toast && (
        <div
          role="status"
          className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 animate-fade-up rounded-full border border-rule bg-parchment px-5 py-2 font-sans text-xs text-ink-soft shadow-lg shadow-ink/10"
        >
          {toast.text}
          {toast.action && (
            <>
              <span aria-hidden="true" className="h-3 w-px bg-rule" />
              <button
                type="button"
                onClick={toast.action.run}
                className="font-medium text-gold transition-colors hover:text-ink"
              >
                {toast.action.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shown when IndexedDB can't be opened. Never crash silently — offer the
 * last-good snapshot, a fresh start, or (after recovery) JSON re-import.
 */
function RecoveryScreen() {
  const recoverFromSnapshot = useCanvasStore((s) => s.recoverFromSnapshot);
  const startFresh = useCanvasStore((s) => s.startFresh);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setHasSnapshot(!!localStorage.getItem("hodos.snapshot"));
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-xl text-ink">Hodos</span>
        <span className="font-sans text-2xs tracking-greek text-gold">
          ΟΔΟΣ
        </span>
      </div>
      <p className="max-w-md font-serif text-md text-ink-soft">
        Your local map couldn&rsquo;t be opened.
      </p>
      <p className="max-w-md font-sans text-xs text-ink-muted">
        {hasSnapshot
          ? "A snapshot from your last good save is available."
          : "No local snapshot was found. If you exported a backup, you can re-import it after starting fresh."}
      </p>
      {failed && (
        <p className="font-sans text-xs text-ink-soft" role="alert">
          Snapshot recovery failed — starting fresh is still available.
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        {hasSnapshot && (
          <button
            type="button"
            onClick={async () => {
              const ok = await recoverFromSnapshot();
              if (!ok) setFailed(true);
            }}
            className="rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
          >
            Restore last snapshot
          </button>
        )}
        <button
          type="button"
          onClick={() => startFresh()}
          className="rounded-full border border-rule px-5 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold"
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}

/** The React Flow surface — split out so useReactFlow lives under the provider. */
function FlowSurface(props: {
  railOpen: boolean;
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useCanvasStore.getState>["onNodesChange"];
  onEdgesChange: ReturnType<typeof useCanvasStore.getState>["onEdgesChange"];
  onConnect: ReturnType<typeof useCanvasStore.getState>["onConnect"];
  onReconnect: ReturnType<typeof useCanvasStore.getState>["reconnectEdge"];
  onNodeContextMenu: (e: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu: (e: React.MouseEvent, edge: Edge) => void;
  onPaneContextMenu: (e: React.MouseEvent | MouseEvent) => void;
  onSelectionContextMenu: (e: React.MouseEvent) => void;
  onPaneClick: () => void;
  onMoveStart: () => void;
  onOpenPicker: (p: PickerState) => void;
  setEditing: (id: string | null) => void;
  onOpenVersePicker: (id: string) => void;
}) {
  const {
    screenToFlowPosition,
    setViewport,
    getNodes,
    getInternalNode,
    getViewport,
    fitView,
  } = useReactFlow();
  const surfaceRef = useRef<HTMLDivElement>(null);

  // ---- Nested-map zoom transition ----
  // The dive is the signature interaction, so it ALWAYS plays — even under
  // prefers-reduced-motion (which the Claude preview and OS "Reduce Motion"
  // force on). The landing's zoom demo drops the same gate for the same reason.
  //
  // The camera is driven by our own rAF loop (instant setViewport per frame):
  // custom easing, geometric zoom (constant perceived rate, like the landing),
  // and no dependence on React Flow's d3 transitions, which proved flaky here.
  const pendingNav = useCanvasStore((s) => s.pendingNav);
  const openNodeStore = useCanvasStore((s) => s.openNode);
  const goToMapStore = useCanvasStore((s) => s.goToMap);
  const switchCanvasStore = useCanvasStore((s) => s.switchCanvas);
  const clearPendingNav = useCanvasStore((s) => s.clearPendingNav);
  const selectOnlyStore = useCanvasStore((s) => s.selectOnly);
  const [veil, setVeil] = useState(false);
  const [ring, setRing] = useState(0);
  const [arriving, setArriving] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!pendingNav || running.current) return;
    running.current = true;
    const nav = pendingNav;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const frame = () =>
      new Promise<void>((r) => requestAnimationFrame(() => r()));

    const paneDims = () => {
      const r = surfaceRef.current?.getBoundingClientRect();
      return {
        w: r?.width ?? window.innerWidth,
        h: r?.height ?? window.innerHeight,
      };
    };

    /** The world point currently at the screen center, and the zoom. */
    const currentFocus = () => {
      const vp = getViewport();
      const { w, h } = paneDims();
      return {
        x: (w / 2 - vp.x) / vp.zoom,
        y: (h / 2 - vp.y) / vp.zoom,
        zoom: vp.zoom,
      };
    };

    /** Park the camera instantly with `focus` at the screen center. */
    const jumpTo = (focus: { x: number; y: number }, zoom: number) => {
      const { w, h } = paneDims();
      setViewport(
        { x: w / 2 - focus.x * zoom, y: h / 2 - focus.y * zoom, zoom },
        { duration: 0 },
      );
    };

    /**
     * Fly the camera: pan the focus point and zoom GEOMETRICALLY (scale
     * multiplies at a constant rate — the landing's `PEAK^p` law) with a
     * chosen easing curve.
     */
    const flyTo = (
      to: { x: number; y: number; zoom: number },
      duration: number,
      ease: (t: number) => number,
    ) =>
      new Promise<void>((resolve) => {
        const from = currentFocus();
        const { w, h } = paneDims();
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const e = ease(p);
          const zoom = from.zoom * Math.pow(to.zoom / from.zoom, e);
          const fx = from.x + (to.x - from.x) * e;
          const fy = from.y + (to.y - from.y) * e;
          setViewport(
            { x: w / 2 - fx * zoom, y: h / 2 - fy * zoom, zoom },
            { duration: 0 },
          );
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

    /** Wait until freshly swapped nodes carry real measurements. */
    const waitMeasured = async () => {
      for (let i = 0; i < 14; i++) {
        await frame();
        const ns = getNodes();
        if (ns.length === 0 || ns.every((n) => (n.measured?.width ?? 0) > 0)) {
          return;
        }
      }
    };

    /** Where the camera should come to rest for the current map. */
    const restingTarget = () => {
      const ns = getNodes();
      if (!ns.length) return { x: 0, y: 0, zoom: 1 };
      const b = getNodesBounds(ns);
      const { w, h } = paneDims();
      const vp = getViewportForBounds(b, w, h, 0.1, 1, 0.3);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, zoom: vp.zoom };
    };

    /** Measured center of a bubble. */
    const bubbleCenter = (id: string) => {
      const n = getInternalNode(id);
      if (!n) return null;
      return {
        x: n.internals.positionAbsolute.x + (n.measured?.width ?? 200) / 2,
        y: n.internals.positionAbsolute.y + (n.measured?.height ?? 60) / 2,
      };
    };

    (async () => {
      try {
        if (nav.kind === "open") {
          // 1 — the fall: accelerate into the heart of the bubble. A brief
          //     veil flash masks only the node-list swap at the very peak —
          //     no held breath, no blank dwell.
          const center = bubbleCenter(nav.id) ?? currentFocus();
          const veilTimer = setTimeout(() => setVeil(true), 620);
          await flyTo({ ...center, zoom: 8.5 }, 800, easeInCubic);
          setVeil(true);
          // 2 — swap worlds the instant we pass through the skin
          await openNodeStore(nav.id);
          clearTimeout(veilTimer);
          setArriving(true);
          await waitMeasured();
          // 3 — the child's anchor mirrors the bubble, so hold it at the SAME
          //     scale: passing through is seamless, never a blank gap
          const b = getNodesBounds(getNodes());
          const cc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          jumpTo(cc, 8.5);
          setRing((k) => k + 1); // gold ring blooms at the threshold
          setVeil(false);
          // 4 — pull back to reveal the new world, settling gently
          await flyTo(restingTarget(), 900, easeOutQuint);
        } else if (nav.kind === "goto") {
          // Rising out: remember which bubble we were inside
          const departedId = useCanvasStore.getState().currentMapId;
          // 1 — this world falls away beneath you (still visible, not blank)
          const f = currentFocus();
          const veilTimer = setTimeout(() => setVeil(true), 480);
          await flyTo(
            { x: f.x, y: f.y, zoom: Math.max(0.14, f.zoom * 0.34) },
            640,
            easeInCubic,
          );
          setVeil(true);
          // 2 — swap to the parent the instant we cross the threshold
          await goToMapStore(nav.index);
          clearTimeout(veilTimer);
          setArriving(true);
          await waitMeasured();
          // 3 — emerge OUT of the bubble you were just inside, at full scale
          const exited = bubbleCenter(departedId);
          const target = restingTarget();
          jumpTo(exited ?? target, exited ? 6 : target.zoom);
          setRing((k) => k + 1);
          setVeil(false);
          if (exited) selectOnlyStore(departedId); // halo marks where you were
          // 4 — …as the parent world settles around it
          await flyTo(target, 880, easeOutQuint);
        } else {
          // Canvas switch — pull back, scroll across the gap, dive into the
          // new one: a cinematic zoom-out → scroll-over → zoom-in.
          const f = currentFocus();
          const alt = Math.max(0.22, f.zoom * 0.26); // fly-over altitude
          const spanAlt = paneDims().w / alt;
          // 1 — zoom out from the current canvas
          await flyTo({ x: f.x, y: f.y, zoom: alt }, 480, easeInOutCubic);
          // 2 — scroll the current canvas off to the left at altitude
          await flyTo(
            { x: f.x + spanAlt, y: f.y, zoom: alt },
            380,
            easeInOutCubic,
          );
          // swap canvases while the gap (empty parchment) is on screen
          await switchCanvasStore(nav.id);
          setArriving(true);
          await waitMeasured();
          const target = restingTarget();
          // 3 — scroll the new canvas in from the right, still at altitude
          jumpTo({ x: target.x - spanAlt, y: target.y }, alt);
          await flyTo(
            { x: target.x, y: target.y, zoom: alt },
            420,
            easeInOutCubic,
          );
          // 4 — zoom in to settle on the new canvas
          await flyTo(target, 600, easeOutQuint);
        }
      } catch (err) {
        console.error("hodos: map transition failed", err);
        fitView({ duration: 0, padding: 0.3, maxZoom: 1 });
      } finally {
        // Always release — a thrown transition must never wedge navigation.
        setVeil(false);
        running.current = false;
        clearPendingNav();
        setTimeout(() => setArriving(false), 2000);
      }
    })();
  }, [
    pendingNav,
    getInternalNode,
    getNodes,
    getViewport,
    setViewport,
    fitView,
    openNodeStore,
    goToMapStore,
    switchCanvasStore,
    selectOnlyStore,
    clearPendingNav,
  ]);

  /** Double-click on empty canvas → create picker at the cursor. */
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      props.onOpenPicker({
        x: Math.max(8, Math.min(e.clientX - bounds.left, bounds.width - 200)),
        y: Math.max(8, Math.min(e.clientY - bounds.top, bounds.height - 190)),
        fx: flow.x,
        fy: flow.y,
      });
    },
    [screenToFlowPosition, props],
  );

  /**
   * Click a bubble → edit it inline (shift-click stays multi-select).
   * Verse bubbles are scripture: an empty one opens the verse picker, and a
   * filled one just selects (its text is never hand-edited).
   *
   * The action is deferred ~260ms so a DOUBLE-click (dive into the bubble's
   * map) never flashes the editor first.
   */
  const requestOpen = useCanvasStore((s) => s.requestOpen);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (e.shiftKey) return;
      // Clicks inside an active editor belong to the editor.
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (node.type === "verse") {
          if (!(node.data as { verseRef?: string }).verseRef) {
            props.onOpenVersePicker(node.id);
          }
          return;
        }
        props.setEditing(node.id);
      }, 260);
    },
    [props],
  );

  /** Double-click a bubble → dive into its own map. */
  const onNodeDoubleClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      // Double-click inside an active editor = native word-select.
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      requestOpen(node.id);
    },
    [requestOpen],
  );

  /**
   * The bubble a connection drag STARTED from — it's always the edge's source,
   * so the arrowhead points at whichever bubble you drag TO (a node exposes
   * both source and target handles, so React Flow's own source/target ordering
   * can't be trusted to match the drag direction).
   */
  const connectFrom = useRef<string | null>(null);
  const onConnectStart = useCallback(
    (_e: unknown, params: { nodeId: string | null }) => {
      connectFrom.current = params.nodeId;
    },
    [],
  );

  /** Normalize a handle-to-handle connection so the drag origin is the source. */
  const handleConnect = useCallback(
    (c: Connection) => {
      const from = connectFrom.current;
      if (from && c.source && c.target && c.source !== c.target) {
        const other = c.source === from ? c.target : c.source;
        props.onConnect({
          source: from,
          target: other,
          sourceHandle: null,
          targetHandle: null,
        });
      } else {
        props.onConnect(c);
      }
    },
    [props],
  );

  /**
   * Dropping a connection on a bubble's BODY (not a handle) still connects —
   * handle-precision shouldn't be required to draw a line. The origin bubble is
   * the source, so the arrow points at the bubble you dragged onto.
   */
  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        isValid: boolean | null;
        fromNode: Node | null;
      },
    ) => {
      connectFrom.current = null;
      if (connectionState.isValid) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const nodeEl = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest(".react-flow__node");
      const overId = nodeEl?.getAttribute("data-id");
      const fromId = connectionState.fromNode?.id;
      if (!overId || !fromId || overId === fromId) return;
      props.onConnect({
        source: fromId,
        target: overId,
        sourceHandle: null,
        targetHandle: null,
      });
    },
    [props],
  );

  return (
    <div
      ref={surfaceRef}
      className="relative h-full w-full"
      onDoubleClick={onDoubleClick}
    >
      <EdgeMarkers />
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={onConnectStart}
        onReconnect={props.onReconnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={8}
        zoomOnDoubleClick={false}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        connectionRadius={28}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{
          stroke: "var(--gold)",
          strokeWidth: 1.5,
          strokeDasharray: "7 5",
        }}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onConnectEnd={onConnectEnd}
        onlyRenderVisibleElements={props.nodes.length > 150}
        className={`${props.nodes.length > 150 ? "perf-mode" : ""} ${
          arriving ? "arriving" : ""
        }`}
        onNodeContextMenu={props.onNodeContextMenu}
        onEdgeContextMenu={props.onEdgeContextMenu}
        onPaneContextMenu={props.onPaneContextMenu}
        onSelectionContextMenu={props.onSelectionContextMenu}
        onPaneClick={props.onPaneClick}
        onMoveStart={props.onMoveStart}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--rule)"
          style={{ opacity: 0.55 }}
        />
        {/* An overview map only earns its place once there's a map to overview */}
        {props.nodes.length >= 3 && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="Map overview"
            bgColor="var(--parchment-2)"
            maskColor="color-mix(in srgb, var(--parchment) 78%, transparent)"
            nodeColor={minimapNodeColor}
            nodeStrokeColor="var(--rule)"
            nodeBorderRadius={8}
            className={props.railOpen ? "rail-open" : ""}
          />
        )}
      </ReactFlow>
      {/* Soft vignette — eye settles toward the center, same as the landing */}
      <div
        aria-hidden="true"
        className="canvas-vignette pointer-events-none absolute inset-0"
      />
      {/* Parchment veil for the zoom-into-a-bubble transition — a soft
          radial light, brightest where you pass through. Transition timing
          lives in .zoom-veil so it survives the reduced-motion override. */}
      <div
        aria-hidden="true"
        className={`zoom-veil pointer-events-none absolute inset-0 z-40 ${
          veil ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Gold ring blooming at the threshold between worlds */}
      {ring > 0 && (
        <div key={ring} aria-hidden="true" className="zoom-ring z-40" />
      )}
    </div>
  );
}
