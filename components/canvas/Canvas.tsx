"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SAMPLE_EDGES, SAMPLE_NODES, type HodosNode } from "@/lib/sample-map";
import TopBar from "./TopBar";
import RightRail from "./RightRail";
import CanvasControls from "./CanvasControls";
import CommandPalette from "./CommandPalette";
import ContextMenu, {
  type EdgeKind,
  type MenuTarget,
  type NodeKind,
} from "./ContextMenu";
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

/** Convert a node to another type, carrying its text across sensibly. */
function convertNode(node: HodosNode, to: NodeKind): HodosNode {
  const text =
    node.type === "verse"
      ? node.data.verseText || node.data.verseRef
      : node.data.content;
  const base = {
    id: node.id,
    position: node.position,
    selected: node.selected,
  };
  if (to === "verse") {
    return { ...base, type: "verse", data: { verseRef: "", verseText: text } };
  }
  return { ...base, type: to, data: { content: text } };
}

const MENU_WIDTH = 192;
const MENU_HEIGHT = 170;

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<HodosNode>(SAMPLE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(SAMPLE_EDGES);
  const [railOpen, setRailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const { deleteElements } = useReactFlow();

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

  /** Clamp a context menu inside the canvas viewport. */
  const menuPosition = useCallback((e: React.MouseEvent | MouseEvent) => {
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
        ...menuPosition(e),
      });
    },
    [menuPosition],
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setMenu({
        kind: "edge",
        id: edge.id,
        edgeKind: (edge.type ?? "manual") as EdgeKind,
        ...menuPosition(e),
      });
    },
    [menuPosition],
  );

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault(); // keep the browser menu off the canvas
    setMenu(null);
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const changeNodeType = useCallback(
    (id: string, to: NodeKind) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? convertNode(n, to) : n)));
      setMenu(null);
    },
    [setNodes],
  );

  const changeEdgeKind = useCallback(
    (id: string, kind: EdgeKind) => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, type: kind } : e)));
      setMenu(null);
    },
    [setEdges],
  );

  const deleteFromMenu = useCallback(
    (target: MenuTarget) => {
      // deleteElements cascade-removes edges attached to deleted nodes.
      deleteElements(
        target.kind === "node"
          ? { nodes: [{ id: target.id }] }
          : { edges: [{ id: target.id }] },
      );
      setMenu(null);
    },
    [deleteElements],
  );

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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={8}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={closeMenu}
          onMoveStart={closeMenu}
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
            className={railOpen ? "rail-open" : ""}
          />
        </ReactFlow>
        {nodes.length === 0 && <EmptyState />}
      </main>

      {menu && (
        <ContextMenu
          target={menu}
          onChangeNodeType={changeNodeType}
          onChangeEdgeKind={changeEdgeKind}
          onDelete={deleteFromMenu}
          onClose={closeMenu}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
