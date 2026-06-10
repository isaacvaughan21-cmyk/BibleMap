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
