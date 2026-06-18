import { Position, type InternalNode } from "@xyflow/react";

/**
 * Floating edge routing — edges attach to the side of each bubble nearest the
 * other bubble, at the side midpoint (where the visible handles sit). This
 * means edges re-route live as nodes drag, and connections never need
 * persisted handle ids (the locked schema stores only source/target).
 */

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

function nodeRect(n: InternalNode): Rect {
  const { x, y } = n.internals.positionAbsolute;
  const w = n.measured?.width ?? 0;
  const h = n.measured?.height ?? 0;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function anchor(r: Rect, side: Position): { x: number; y: number } {
  switch (side) {
    case Position.Top:
      return { x: r.cx, y: r.y };
    case Position.Bottom:
      return { x: r.cx, y: r.y + r.h };
    case Position.Left:
      return { x: r.x, y: r.cy };
    case Position.Right:
      return { x: r.x + r.w, y: r.cy };
  }
}

export function floatingEdgeParams(source: InternalNode, target: InternalNode) {
  const s = nodeRect(source);
  const t = nodeRect(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const horizontal = Math.abs(dx) > Math.abs(dy);

  const sourcePos = horizontal
    ? dx > 0
      ? Position.Right
      : Position.Left
    : dy > 0
      ? Position.Bottom
      : Position.Top;
  const targetPos = horizontal
    ? dx > 0
      ? Position.Left
      : Position.Right
    : dy > 0
      ? Position.Top
      : Position.Bottom;

  const sa = anchor(s, sourcePos);
  const ta = anchor(t, targetPos);
  return { sx: sa.x, sy: sa.y, tx: ta.x, ty: ta.y, sourcePos, targetPos };
}

/** Outward unit normal of a bubble side — the direction pointing away from it. */
const SIDE_NORMAL: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
};

/** A short straight run into the arrow — longer than the arrowhead so the line
 * meets the dead centre of its back, perpendicular to the bubble's side. */
const ARROW_RUN = 16;

/**
 * A smooth curve whose control points sit on the OUTWARD NORMAL of each
 * bubble's attachment side, so the line leaves the source and arrives at the
 * target perpendicular to the bubble it touches. The final segment is a short
 * STRAIGHT run along the target's normal: the arrowhead therefore sits on a
 * straight line and the edge passes through the centre of its back, never
 * meeting it off to one side where the curve is still bending.
 */
export function floatingEdgePath(source: InternalNode, target: InternalNode) {
  const { sx, sy, tx, ty, sourcePos, targetPos } = floatingEdgeParams(
    source,
    target,
  );
  const sn = SIDE_NORMAL[sourcePos];
  const tn = SIDE_NORMAL[targetPos];
  const dist = Math.hypot(tx - sx, ty - sy) || 1;
  const bow = Math.min(Math.max(dist * 0.4, 30), 140); // control-point reach

  // The curve ends just outside the target side, travelling straight in along
  // the normal; the trailing line segment carries the arrowhead the rest of
  // the way so it lands square on the bubble.
  const ex = tx + tn.x * ARROW_RUN;
  const ey = ty + tn.y * ARROW_RUN;
  const c1x = sx + sn.x * bow;
  const c1y = sy + sn.y * bow;
  const c2x = ex + tn.x * bow;
  const c2y = ey + tn.y * bow;
  const path = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${ex},${ey} L ${tx},${ty}`;
  return { path, sx, sy, tx, ty };
}
