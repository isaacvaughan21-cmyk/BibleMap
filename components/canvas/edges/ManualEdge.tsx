import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { floatingEdgeParams } from "@/lib/edge-routing";
import { ARROW_RULE } from "./EdgeMarkers";

/** A hand-drawn connection — hairline rule between the nearest sides. */
export default function ManualEdge({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = floatingEdgeParams(sourceNode, targetNode);
  // Straight chord so the arrow aligns exactly with the line.
  const [path] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={ARROW_RULE}
        className="hodos-edge-manual"
      />
      {/* endpoint caps — revealed on hover/selection */}
      <circle cx={sx} cy={sy} r={3} className="hodos-edge-cap" />
      <circle cx={tx} cy={ty} r={3} className="hodos-edge-cap" />
    </>
  );
}
