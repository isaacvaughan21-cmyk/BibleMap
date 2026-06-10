import { Handle, Position } from "@xyflow/react";

const SIDES = [
  { position: Position.Top, id: "t" },
  { position: Position.Right, id: "r" },
  { position: Position.Bottom, id: "b" },
  { position: Position.Left, id: "l" },
] as const;

/**
 * A source + target handle on each side of a node, hidden until the node is
 * hovered or selected (see .react-flow__handle overrides in globals.css).
 * Edges route via floating geometry (lib/edge-routing.ts), so handle ids are
 * never persisted — these exist for the connect gesture.
 */
export default function NodeHandles() {
  return (
    <>
      {SIDES.flatMap(({ position, id }) => [
        <Handle
          key={`s-${id}`}
          type="source"
          position={position}
          id={`s-${id}`}
        />,
        <Handle
          key={`t-${id}`}
          type="target"
          position={position}
          id={`t-${id}`}
        />,
      ])}
    </>
  );
}
