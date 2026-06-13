"use client";

import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Draggable endpoint grips for a selected edge — grab either end and drop it on
 * another bubble to re-attach the connection there. (React Flow's built-in edge
 * reconnection doesn't play well with our floating-geometry edges, so we drive
 * it ourselves: pointer capture on the grip, then elementFromPoint on release.)
 */
export default function EdgeEnds({
  id,
  source,
  target,
  sx,
  sy,
  tx,
  ty,
  selected,
}: {
  id: string;
  source: string;
  target: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  selected?: boolean;
}) {
  const reconnectEdge = useCanvasStore((s) => s.reconnectEdge);
  const { screenToFlowPosition } = useReactFlow();
  const [dragEnd, setDragEnd] = useState<null | "source" | "target">(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  if (!selected) return null;

  const start = (which: "source" | "target") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragEnd(which);
    setGhost(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const move = (e: React.PointerEvent) => {
    if (!dragEnd) return;
    setGhost(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const finish = (e: React.PointerEvent) => {
    if (!dragEnd) return;
    const overId = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".react-flow__node")
      ?.getAttribute("data-id");
    const which = dragEnd;
    setDragEnd(null);
    setGhost(null);
    if (!overId) return;
    const conn =
      which === "source"
        ? { source: overId, target }
        : { source, target: overId };
    if (conn.source === conn.target) return;
    reconnectEdge(
      { id, source, target },
      { ...conn, sourceHandle: null, targetHandle: null },
    );
  };

  const sGrip = dragEnd === "source" && ghost ? ghost : { x: sx, y: sy };
  const tGrip = dragEnd === "target" && ghost ? ghost : { x: tx, y: ty };

  return (
    <g>
      {dragEnd && ghost && (
        <line
          x1={sGrip.x}
          y1={sGrip.y}
          x2={tGrip.x}
          y2={tGrip.y}
          stroke="var(--gold)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}
      <circle
        cx={sGrip.x}
        cy={sGrip.y}
        r={6}
        className="hodos-edge-grip"
        onPointerDown={start("source")}
        onPointerMove={move}
        onPointerUp={finish}
      />
      <circle
        cx={tGrip.x}
        cy={tGrip.y}
        r={6}
        className="hodos-edge-grip"
        onPointerDown={start("target")}
        onPointerMove={move}
        onPointerUp={finish}
      />
    </g>
  );
}
