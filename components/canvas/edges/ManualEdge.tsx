import { BaseEdge, useInternalNode, type EdgeProps } from "@xyflow/react";
import { floatingEdgePath } from "@/lib/edge-routing";
import { ARROW_RULE } from "./EdgeMarkers";
import EdgeEnds from "./EdgeEnds";

/** A hand-drawn connection — a gentle hairline curve between the nearest sides. */
export default function ManualEdge({
  id,
  source,
  target,
  selected,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  // A smooth curve that leaves and enters each bubble perpendicular to its side.
  const { path, sx, sy, tx, ty } = floatingEdgePath(sourceNode, targetNode);
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
      <EdgeEnds
        id={id}
        source={source}
        target={target}
        sx={sx}
        sy={sy}
        tx={tx}
        ty={ty}
        selected={selected}
      />
    </>
  );
}
