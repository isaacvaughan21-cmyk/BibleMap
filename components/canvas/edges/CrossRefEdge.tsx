import {
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { floatingEdgeParams } from "@/lib/edge-routing";
import { ARROW_GOLD } from "./EdgeMarkers";

/** A scripture cross-reference — dashed gold, slightly heavier, floating anchors. */
export default function CrossRefEdge({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = floatingEdgeParams(sourceNode, targetNode);
  // A straight chord between the nearest sides — so the arrow lines up exactly
  // with the line, its tip on the end and the line through the centre of its back.
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
        markerEnd={ARROW_GOLD}
        className="hodos-edge-crossref"
      />
      {/* endpoint caps — revealed on hover/selection */}
      <circle cx={sx} cy={sy} r={3} className="hodos-edge-cap" />
      <circle cx={tx} cy={ty} r={3} className="hodos-edge-cap" />
    </>
  );
}
