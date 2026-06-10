import {
  BaseEdge,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { floatingEdgeParams } from "@/lib/edge-routing";

/** A scripture cross-reference — dashed gold, slightly heavier, floating anchors. */
export default function CrossRefEdge({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = floatingEdgeParams(
    sourceNode,
    targetNode,
  );
  const [path] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
    curvature: 0.3,
  });
  return (
    <>
      <BaseEdge id={id} path={path} className="hodos-edge-crossref" />
      {/* endpoint caps — revealed on hover/selection */}
      <circle cx={sx} cy={sy} r={3} className="hodos-edge-cap" />
      <circle cx={tx} cy={ty} r={3} className="hodos-edge-cap" />
    </>
  );
}
