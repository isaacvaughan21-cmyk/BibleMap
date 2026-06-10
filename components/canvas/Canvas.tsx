"use client";

import { useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SAMPLE_EDGES, SAMPLE_NODES, type HodosNode } from "@/lib/sample-map";
import TopBar from "./TopBar";
import RightRail from "./RightRail";
import CanvasControls from "./CanvasControls";
import CommandPalette from "./CommandPalette";
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

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const [nodes, , onNodesChange] = useNodesState<HodosNode>(SAMPLE_NODES);
  const [edges, , onEdgesChange] = useEdgesState(SAMPLE_EDGES);
  const [railOpen, setRailOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-parchment">
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
        deleteKeyCode={null}
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
          bgColor="var(--parchment-2)"
          maskColor="color-mix(in srgb, var(--parchment) 78%, transparent)"
          nodeColor={minimapNodeColor}
          nodeStrokeColor="var(--rule)"
          nodeBorderRadius={8}
          className={railOpen ? "rail-open" : ""}
          aria-label="Map overview"
        />
      </ReactFlow>

      <TopBar
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((o) => !o)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <RightRail open={railOpen} />
      <CanvasControls railOpen={railOpen} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
