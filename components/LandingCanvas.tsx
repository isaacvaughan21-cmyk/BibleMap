"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  getNodesBounds,
  getViewportForBounds,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  LANDING_BRANCHES,
  LANDING_EDGES,
  LANDING_NODES,
  type LandingEdge,
  type LandingNode,
  type LandingNodeData,
} from "@/lib/landing-canvas-data";
import { easeInCubic, easeOutQuint } from "@/lib/easing";

/**
 * The live mini-canvas on the landing page — a real React Flow surface with
 * a handful of draggable bubbles from the Melchizedek map. Read-only in
 * spirit (no editing, no connecting), fully touchable in practice.
 *
 * One verse is marked `expandable`: double-clicking it dives into an isolated
 * branch map nested inside that bubble — the "a whole map inside one bubble"
 * payoff, the same gesture the full app uses.
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

/** Floating "Double-click me" affordance on an expandable verse bubble. */
function CtaBadge({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="floaty pointer-events-none absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 font-sans text-2xs font-medium tracking-eyebrow text-parchment shadow-md shadow-gold/30"
      style={
        { "--float-amp": "2.5px", "--float-dur": "2.6s" } as React.CSSProperties
      }
    >
      {label}
      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gold" />
    </span>
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
    <div
      className={`relative w-[250px] rounded-2xl border bg-parchment px-5 py-4 shadow-md shadow-ink/5 transition-shadow active:cursor-grabbing ${
        d.expandable
          ? "cursor-pointer border-gold/70 ring-1 ring-gold/30 hover:shadow-lg hover:shadow-gold/20"
          : "cursor-grab border-gold/40 hover:shadow-lg hover:shadow-gold/10"
      }`}
    >
      <Anchors />
      {d.expandable && d.cta && <CtaBadge label={d.cta} />}
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

function toFlowNodes(nodes: LandingNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as Record<string, unknown>,
  }));
}

function toFlowEdges(edges: LandingEdge[]): Edge[] {
  return edges.map((e) => ({
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

/** Peak zoom the camera reaches as it passes through a bubble's skin. */
const DIVE_PEAK = 2.8;

function LandingCanvasInner() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(LANDING_NODES),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(LANDING_EDGES),
  );
  // null = the root map; otherwise the id of the branch we've dived into.
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchTitle, setBranchTitle] = useState<string | null>(null);
  // Veil flashes as the camera passes through the bubble's skin.
  const [veiled, setVeiled] = useState(false);
  // Bumped on each dive so the gold threshold ring re-blooms.
  const [diveKey, setDiveKey] = useState(0);
  const running = useRef(false);
  // Guards against state updates / rAF after the section unmounts mid-dive
  // (e.g. the visitor clicks a nav link while the camera is flying).
  const alive = useRef(true);
  useEffect(() => {
    // Set on mount too: StrictMode (dev) runs the cleanup on its throwaway
    // first mount, which would otherwise leave this false for good.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const { setViewport, getViewport, getNodes, getInternalNode } =
    useReactFlow();

  // ---- The product's dive camera, ported 1:1 (see components/canvas/
  // Canvas.tsx FlowSurface). A custom rAF loop drives setViewport per frame:
  // geometric zoom (constant perceived rate) with the shared easings. ----
  const paneDims = useCallback(() => {
    const r = surfaceRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 600, h: r?.height ?? 460 };
  }, []);

  /** The world point at the screen center, and the current zoom. */
  const currentFocus = useCallback(() => {
    const vp = getViewport();
    const { w, h } = paneDims();
    return {
      x: (w / 2 - vp.x) / vp.zoom,
      y: (h / 2 - vp.y) / vp.zoom,
      zoom: vp.zoom,
    };
  }, [getViewport, paneDims]);

  /** Park the camera instantly with `f` at the screen center. */
  const jumpTo = useCallback(
    (f: { x: number; y: number }, zoom: number) => {
      const { w, h } = paneDims();
      setViewport(
        { x: w / 2 - f.x * zoom, y: h / 2 - f.y * zoom, zoom },
        { duration: 0 },
      );
    },
    [paneDims, setViewport],
  );

  /** Fly the camera: pan the focus and zoom GEOMETRICALLY with an easing. */
  const flyTo = useCallback(
    (
      to: { x: number; y: number; zoom: number },
      duration: number,
      ease: (t: number) => number,
    ) =>
      new Promise<void>((resolve) => {
        const from = currentFocus();
        const { w, h } = paneDims();
        const t0 = performance.now();
        const step = (now: number) => {
          if (!alive.current) return resolve();
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
      }),
    [currentFocus, paneDims, setViewport],
  );

  const waitMeasured = useCallback(async () => {
    const frame = () =>
      new Promise<void>((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < 14; i++) {
      await frame();
      if (!alive.current) return;
      const ns = getNodes();
      if (ns.length === 0 || ns.every((n) => (n.measured?.width ?? 0) > 0))
        return;
    }
  }, [getNodes]);

  /** Measured center of a bubble in the current map. */
  const bubbleCenter = useCallback(
    (id: string) => {
      const n = getInternalNode(id);
      if (!n) return null;
      return {
        x: n.internals.positionAbsolute.x + (n.measured?.width ?? 220) / 2,
        y: n.internals.positionAbsolute.y + (n.measured?.height ?? 64) / 2,
      };
    },
    [getInternalNode],
  );

  /** Where the camera should rest to frame the whole current map. */
  const restingTarget = useCallback(() => {
    const ns = getNodes();
    if (!ns.length) return { x: 0, y: 0, zoom: 1 };
    const b = getNodesBounds(ns);
    const { w, h } = paneDims();
    const vp = getViewportForBounds(b, w, h, 0.12, 1.75, 0.18);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, zoom: vp.zoom };
  }, [getNodes, paneDims]);

  /**
   * One map-to-map transition, modelled on the app's dive:
   *  - diving IN: accelerate into the bubble (zoom up to peak)
   *  - rising OUT: let the world fall away (zoom down)
   * then flash the veil at the threshold, swap maps, hold the `emergeId`
   * bubble at the SAME peak scale (seamless pass-through), bloom the ring,
   * and settle to frame the new map.
   */
  const transition = useCallback(
    async (
      firstLeg: { x: number; y: number; zoom: number },
      next: { nodes: LandingNode[]; edges: LandingEdge[] },
      emergeId: string,
      rise: boolean,
    ) => {
      setDiveKey((k) => k + 1);
      const veilTimer = window.setTimeout(
        () => {
          if (alive.current) setVeiled(true);
        },
        rise ? 340 : 440,
      );
      await flyTo(firstLeg, rise ? 560 : 720, easeInCubic);
      window.clearTimeout(veilTimer);
      if (!alive.current) return;
      setVeiled(true);
      setNodes(toFlowNodes(next.nodes));
      setEdges(toFlowEdges(next.edges));
      await waitMeasured();
      if (!alive.current) return;
      const emerge = bubbleCenter(emergeId);
      if (emerge) jumpTo(emerge, DIVE_PEAK);
      setVeiled(false);
      await flyTo(restingTarget(), rise ? 800 : 820, easeOutQuint);
    },
    [
      bubbleCenter,
      flyTo,
      jumpTo,
      restingTarget,
      setEdges,
      setNodes,
      waitMeasured,
    ],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (running.current) return;
      const data = node.data as LandingNodeData;
      if (!data.expandable) return;
      const branch = LANDING_BRANCHES[node.id];
      if (!branch) return;
      running.current = true;
      setBranchId(node.id);
      setBranchTitle(branch.title);
      const center = bubbleCenter(node.id) ?? currentFocus();
      void transition(
        { x: center.x, y: center.y, zoom: DIVE_PEAK },
        branch,
        branch.anchorId,
        false,
      ).finally(() => {
        running.current = false;
      });
    },
    [bubbleCenter, currentFocus, transition],
  );

  const goBack = useCallback(() => {
    if (running.current || !branchId) return;
    running.current = true;
    const exitId = branchId;
    setBranchId(null);
    setBranchTitle(null);
    const f = currentFocus();
    void transition(
      { x: f.x, y: f.y, zoom: Math.max(0.3, f.zoom * 0.4) },
      { nodes: LANDING_NODES, edges: LANDING_EDGES },
      exitId,
      true,
    ).finally(() => {
      running.current = false;
    });
  }, [branchId, currentFocus, transition]);

  return (
    // .landing-flow re-enables vertical touch scrolling over the canvas
    // (globals.css) so the section never traps the page on mobile.
    <div
      ref={surfaceRef}
      className="landing-flow relative h-[440px] w-full md:h-[520px]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 0.9 }}
        minZoom={0.12}
        maxZoom={DIVE_PEAK}
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

      {/* Back to the root map — only while inside a branch */}
      {branchId && (
        <button
          type="button"
          onClick={goBack}
          className="group absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-rule bg-parchment/90 px-4 py-2 font-sans text-2xs tracking-eyebrow text-ink-soft shadow-md shadow-ink/10 backdrop-blur-sm transition-colors hover:text-gold"
        >
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:-translate-x-0.5"
          >
            ←
          </span>
          BACK TO THE MAP
        </button>
      )}

      {/* Depth crumb — which bubble we opened into */}
      {branchTitle && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-2xs tracking-eyebrow text-gold">
          INSIDE · {branchTitle}
        </div>
      )}

      {/* Gold threshold ring — blooms once as we pass through the bubble.
          Keyed by diveKey so each dive replays the one-shot bloom; it plays
          to completion independently of the (briefer) veil. */}
      {diveKey > 0 && <span key={diveKey} className="zoom-ring z-10" />}

      {/* Cross-fade veil for the dive */}
      <div
        aria-hidden="true"
        className={`zoom-veil pointer-events-none absolute inset-0 z-10 ${
          veiled ? "opacity-100" : "opacity-0"
        }`}
      />

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
