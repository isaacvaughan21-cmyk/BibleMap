import { BaseEdge, useInternalNode, type EdgeProps } from "@xyflow/react";
import { curvedEdgePath, floatingEdgeParams } from "@/lib/edge-routing";
import { ARROW_RULE } from "./EdgeMarkers";

/** A hand-drawn connection — a gentle hairline curve between the nearest sides. */
export default function ManualEdge({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = floatingEdgeParams(sourceNode, targetNode);
  // A gentle curve that straightens into the target so the arrow stays aligned.
  const path = curvedEdgePath(sx, sy, tx, ty);
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
