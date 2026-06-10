import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/** A hand-drawn connection — hairline rule, slight curve. */
export default function ManualEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3,
  });
  return (
    <>
      <BaseEdge id={id} path={path} className="hodos-edge-manual" />
      {/* endpoint caps — revealed on hover/selection */}
      <circle cx={sourceX} cy={sourceY} r={3} className="hodos-edge-cap" />
      <circle cx={targetX} cy={targetY} r={3} className="hodos-edge-cap" />
    </>
  );
}
