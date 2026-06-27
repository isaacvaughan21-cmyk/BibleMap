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
import type { DailyMap } from "@/lib/daily-map";

/**
 * A read-only render of a daily map — a real React Flow surface (pan + zoom,
 * no editing), modelled on the landing's LandingCanvas. The bubbles reuse the
 * app's visual language (parchment, gold, serif) via the shared CSS tokens, so
 * the preview looks exactly like the canvas it copies into.
 */

type BubbleData = {
  kind: "question" | "verse" | "note";
  text?: string;
  ref?: string;
  emphasis?: boolean;
};

/* Invisible handles so edges have anchor points on the custom nodes. */
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
  const d = data as BubbleData;
  return (
    <div className="floaty w-[240px] rounded-2xl border border-rule bg-parchment px-5 py-4 shadow-md shadow-ink/5">
      <Anchors />
      <p className="flex items-center gap-2 font-sans text-2xs tracking-eyebrow text-ink-muted">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-serif text-2xs leading-none text-gold">
          ?
        </span>
        QUESTION
      </p>
      <p className="mt-2 font-serif text-sm leading-snug text-ink">{d.text}</p>
    </div>
  );
}

function VerseBubble({ data }: NodeProps) {
  const d = data as BubbleData;
  return (
    <div
      className={`floaty relative w-[260px] rounded-2xl border border-l-[3px] border-l-gold bg-parchment px-5 py-4 shadow-md shadow-ink/5 ${
        d.emphasis ? "border-gold/70 ring-1 ring-gold/30" : "border-gold/40"
      }`}
    >
      <Anchors />
      <p className="flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.14em] text-gold">
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
  const d = data as BubbleData;
  return (
    <div className="floaty w-[240px] rounded-2xl border border-dashed border-rule bg-parchment-2/80 px-5 py-4 shadow-sm">
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

function toFlowNodes(map: DailyMap): Node[] {
  return map.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      kind: n.type,
      text: n.type === "verse" ? n.verseText : n.content,
      ref: n.verseRef,
      emphasis: n.id === "anchor",
    } as BubbleData,
    draggable: true,
  }));
}

function toFlowEdges(map: DailyMap): Edge[] {
  return map.edges.map((e) => ({
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
}

/** +/− zoom pills, bottom-right — echoes the app's control cluster. */
function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
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
        aria-label="Fit map to view"
        className={`${btn} text-xs tracking-eyebrow`}
        onClick={() => fitView({ duration: 300, padding: 0.18 })}
      >
        ⤢
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

function DailyMapViewInner({ map }: { map: DailyMap }) {
  return (
    <div className="landing-flow relative h-full w-full">
      <ReactFlow
        nodes={toFlowNodes(map)}
        edges={toFlowEdges(map)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.75}
        zoomOnScroll={false}
        preventScrolling={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        nodesConnectable={false}
        elementsSelectable={false}
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
      <div
        aria-hidden="true"
        className="canvas-vignette pointer-events-none absolute inset-0"
      />
    </div>
  );
}

export default function DailyMapView({ map }: { map: DailyMap }) {
  return (
    <ReactFlowProvider>
      <DailyMapViewInner map={map} />
    </ReactFlowProvider>
  );
}
