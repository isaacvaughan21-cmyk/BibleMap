import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/** A scripture cross-reference — dashed gold, slightly heavier. */
export default function CrossRefEdge({
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
  return <BaseEdge id={id} path={path} className="hodos-edge-crossref" />;
}
