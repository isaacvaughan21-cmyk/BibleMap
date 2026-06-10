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

import { useCanvasStore } from "@/lib/store/canvas-store";
import type { EdgeKind, NodeKind } from "@/lib/types";
import TopBar from "./TopBar";
import RightRail from "./RightRail";
import CanvasControls from "./CanvasControls";
import CommandPalette from "./CommandPalette";
import ContextMenu, { type MenuTarget } from "./ContextMenu";
import CreatePicker from "./CreatePicker";
import EmptyState from "./EmptyState";
import QuestionNode from "./nodes/QuestionNode";
import VerseNode from "./nodes/VerseNode";
import NoteNode from "./nodes/NoteNode";
import ManualEdge from "./edges/ManualEdge";
import CrossRefEdge from "./edges/CrossRefEdge";

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
  const [railOpen, setRailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Cmd-K (mac) / Ctrl-K (win) toggles the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    >
      {/* Chrome first in DOM — tab order: top bar → rail → controls → canvas */}
      <TopBar
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((o) => !o)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <RightRail open={railOpen} />
      <CanvasControls railOpen={railOpen} />

      <main className="absolute inset-0" aria-label="Map canvas">
        {loaded && (
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
          />
        )}
        {loaded && nodes.length === 0 && <EmptyState />}
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
            createNode(type, { x: picker.fx, y: picker.fy });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
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

  /** Click a bubble → edit it inline (shift-click stays multi-select). */
  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (e.shiftKey) return;
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
