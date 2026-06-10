"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import "@xyflow/react/dist/style.css";

import { track } from "@/lib/analytics";
import { useCanvasStore } from "@/lib/store/canvas-store";
import * as repo from "@/lib/db/repo";
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
import HelpOverlay from "./HelpOverlay";
import ImportDialog from "./ImportDialog";
import VersePicker from "./VersePicker";
import QuestionNode from "./nodes/QuestionNode";
import VerseNode from "./nodes/VerseNode";
import NoteNode from "./nodes/NoteNode";
import ManualEdge from "./edges/ManualEdge";
import CrossRefEdge from "./edges/CrossRefEdge";
import type { VerseNodeType } from "@/lib/types";

const nodeTypes = {
  question: QuestionNode,
  verse: VerseNode,
  note: NoteNode,
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
    default:
      return "var(--rule)";
  }
}

const MENU_WIDTH = 192;
const MENU_HEIGHT = 180;

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
      load: s.load,
    })),
  );
  const reloadFromDb = useCanvasStore((s) => s.reloadFromDb);
  const versePickerNodeId = useCanvasStore((s) => s.versePickerNodeId);
  const setVersePicker = useCanvasStore((s) => s.setVersePicker);
  const [railOpen, setRailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [importPending, setImportPending] = useState<HodosExport | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
      setToast("That file doesn't look like a Hodos map (.hodos.json).");
    }
  }, []);

  const finishImport = useCallback(
    async (mode: "merge" | "replace") => {
      if (!importPending) return;
      if (mode === "merge") await repo.importMerge(importPending);
      else await repo.importReplace(importPending);
      await reloadFromDb();
      setImportPending(null);
      setToast(mode === "merge" ? "Map merged." : "Map replaced.");
    },
    [importPending, reloadFromDb],
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

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault(); // keep the browser menu off the canvas
    setMenu(null);
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeOverlays = useCallback(() => {
    setMenu(null);
    setPicker(null);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative h-dvh w-full overflow-hidden bg-parchment"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImportFile(file);
      }}
    >
      {/* Chrome first in DOM — tab order: top bar → rail → controls → canvas */}
      <TopBar
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((o) => !o)}
        onOpenPalette={() => setPaletteOpen(true)}
        onFeedback={() => setFeedbackOpen((o) => !o)}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onHelp={() => setHelpOpen(true)}
      />
      <RightRail open={railOpen} selectedVerse={selectedVerse} />
      <CanvasControls railOpen={railOpen} />
      <FeedbackWidget
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        railOpen={railOpen}
      />

      <main className="absolute inset-0" aria-label="Map canvas">
        {loaded && loadError && <RecoveryScreen />}
        {loaded && !loadError && (
          <FlowSurface
            railOpen={railOpen}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={closeOverlays}
            onOpenPicker={setPicker}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            setEditing={setEditing}
            onOpenVersePicker={setVersePicker}
          />
        )}
        {loaded && !loadError && nodes.length === 0 && <EmptyState />}
      </main>

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
          onPickVerse={(id) => {
            setVersePicker(id);
            closeMenu();
          }}
          onDelete={(target) => {
            if (target.kind === "node") {
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

      {/* Quiet toast */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-full border border-rule bg-parchment px-5 py-2 font-sans text-xs text-ink-soft shadow-lg shadow-ink/10">
          {toast}
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
  onNodeContextMenu: (e: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu: (e: React.MouseEvent, edge: Edge) => void;
  onPaneContextMenu: (e: React.MouseEvent | MouseEvent) => void;
  onPaneClick: () => void;
  onOpenPicker: (p: PickerState) => void;
  setEditing: (id: string | null) => void;
  onOpenVersePicker: (id: string) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();

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
   */
  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (e.shiftKey) return;
      if (node.type === "verse") {
        if (!(node.data as { verseRef?: string }).verseRef) {
          props.onOpenVersePicker(node.id);
        }
        return;
      }
      props.setEditing(node.id);
    },
    [props],
  );

  /**
   * Dropping a connection on a bubble's BODY (not a handle) still connects —
   * handle-precision shouldn't be required to draw a line.
   */
  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        isValid: boolean | null;
        fromNode: Node | null;
        fromHandle: { type: string | null } | null;
      },
    ) => {
      if (connectionState.isValid) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const nodeEl = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest(".react-flow__node");
      const overId = nodeEl?.getAttribute("data-id");
      const fromId = connectionState.fromNode?.id;
      if (!overId || !fromId || overId === fromId) return;
      const reversed = connectionState.fromHandle?.type === "target";
      props.onConnect({
        source: reversed ? overId : fromId,
        target: reversed ? fromId : overId,
        sourceHandle: null,
        targetHandle: null,
      });
    },
    [props],
  );

  return (
    <div className="h-full w-full" onDoubleClick={onDoubleClick}>
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={props.onConnect}
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
        onConnectEnd={onConnectEnd}
        onlyRenderVisibleElements={props.nodes.length > 150}
        onNodeContextMenu={props.onNodeContextMenu}
        onEdgeContextMenu={props.onEdgeContextMenu}
        onPaneContextMenu={props.onPaneContextMenu}
        onPaneClick={props.onPaneClick}
        onMoveStart={props.onPaneClick}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--rule)"
          style={{ opacity: 0.55 }}
        />
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
      </ReactFlow>
    </div>
  );
}
