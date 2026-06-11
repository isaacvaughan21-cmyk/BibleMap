"use client";

import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  LANDING_EDGES,
  LANDING_NODES,
  type LandingNodeData,
} from "@/lib/landing-canvas-data";

/**
 * The live mini-canvas on the landing page — a real React Flow surface with
 * a handful of draggable bubbles from the Melchizedek map. Read-only in
 * spirit (no editing, no connecting), fully touchable in practice.
 */

/* Invisible handles so edges have anchor points on custom nodes. */
function Anchors() {
  const cls = "!pointer-events-none !opacity-0";
  return (
    <>
      <Handle type="target" position={Position.Top} className={cls} />
      <Handle type="source" position={Position.Bottom} className={cls} />
    </>
  );
}

function QuestionBubble({ data }: NodeProps) {
  const d = data as LandingNodeData;
  return (
    <div className="w-[225px] cursor-grab rounded-2xl border border-rule bg-parchment px-5 py-4 shadow-md shadow-ink/5 transition-shadow hover:shadow-lg hover:shadow-ink/10 active:cursor-grabbing">
      <Anchors />
      <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        QUESTION
      </p>
      <p className="mt-1.5 font-serif text-sm leading-snug text-ink">
        {d.text}
      </p>
    </div>
  );
}

function VerseBubble({ data }: NodeProps) {
  const d = data as LandingNodeData;
  return (
    <div className="w-[250px] cursor-grab rounded-2xl border border-gold/40 bg-parchment px-5 py-4 shadow-md shadow-ink/5 transition-shadow hover:shadow-lg hover:shadow-gold/10 active:cursor-grabbing">
      <Anchors />
      <p className="flex items-center gap-2 font-sans text-2xs tracking-eyebrow text-gold">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
        {d.ref}
      </p>
      <p className="mt-2 font-serif text-xs leading-relaxed text-ink-soft">
        {d.text}
      </p>
    </div>
  );
}

function NoteBubble({ data }: NodeProps) {
  const d = data as LandingNodeData;
  return (
    <div className="w-[230px] cursor-grab rounded-2xl border border-dashed border-rule bg-parchment-2/80 px-5 py-4 shadow-sm transition-shadow hover:shadow-md hover:shadow-ink/5 active:cursor-grabbing">
      <Anchors />
      <p className="font-serif text-xs italic leading-relaxed text-ink-muted">
        {d.text}
      </p>
    </div>
  );
}

const nodeTypes = {
  question: QuestionBubble,
  verse: VerseBubble,
  note: NoteBubble,
};

const initialNodes: Node[] = LANDING_NODES.map((n) => ({
  id: n.id,
  type: n.type,
  position: n.position,
  data: n.data as Record<string, unknown>,
}));

const initialEdges: Edge[] = LANDING_EDGES.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  type: "default",
  focusable: false,
  style:
    e.kind === "crossref"
      ? {
          stroke: "var(--gold)",
          strokeWidth: 1.5,
          strokeDasharray: "6 5",
          opacity: 0.75,
        }
      : { stroke: "var(--rule)", strokeWidth: 1.5 },
}));

/** +/− zoom pills, bottom-right — echoes the full app's control cluster. */
function ZoomControls() {
  const { zoomIn, zoomOut } = useReactFlow();
  const btn =
    "flex h-8 w-8 items-center justify-center font-sans text-sm text-ink-soft transition-colors hover:bg-parchment-2 hover:text-gold";
  return (
    <div className="absolute bottom-3 right-3 z-10 flex overflow-hidden rounded-full border border-rule bg-parchment shadow-md shadow-ink/10">
      <button
        type="button"
        aria-label="Zoom out"
        className={btn}
        onClick={() => zoomOut({ duration: 200 })}
      >
        −
      </button>
      <span aria-hidden="true" className="my-2 w-px bg-rule" />
      <button
        type="button"
        aria-label="Zoom in"
        className={btn}
        onClick={() => zoomIn({ duration: 200 })}
      >
        +
      </button>
    </div>
  );
}

function LandingCanvasInner() {
  return (
    // .landing-flow re-enables vertical touch scrolling over the canvas
    // (globals.css) so the section never traps the page on mobile.
    <div className="landing-flow relative h-[440px] w-full md:h-[520px]">
      <ReactFlow
        defaultNodes={initialNodes}
        defaultEdges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 0.9 }}
        minZoom={0.12}
        maxZoom={1.75}
        zoomOnScroll={false}
        preventScrolling={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        nodesConnectable={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--rule)"
          style={{ opacity: 0.55 }}
        />
      </ReactFlow>
      <ZoomControls />
      {/* Soft vignette, same token-based class as the app canvas */}
      <div
        aria-hidden="true"
        className="canvas-vignette pointer-events-none absolute inset-0"
      />
    </div>
  );
}

export default function LandingCanvas() {
  return (
    <ReactFlowProvider>
      <LandingCanvasInner />
    </ReactFlowProvider>
  );
}
