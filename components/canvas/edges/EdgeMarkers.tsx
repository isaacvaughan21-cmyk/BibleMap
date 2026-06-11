/**
 * Arrowhead markers referenced by the custom edges (markerEnd). Rendered once
 * in the canvas so url(#id) resolves. The arrow sits at the path's target end,
 * its tip on the line end and the line running through the centre of its back.
 *
 * markerUnits="userSpaceOnUse" gives the arrow a fixed size and a predictable
 * reference point — the stroke-width-scaled default offsets the marker so the
 * line meets a corner rather than the centre of the back.
 */
export const ARROW_GOLD = "url(#hodos-arrow-gold)";
export const ARROW_RULE = "url(#hodos-arrow-rule)";

function Arrow({ id, fill }: { id: string; fill: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="13"
      markerHeight="13"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      {/* tip at (9,5); flat back from (1,1)–(1,9) centred on the axis y=5 */}
      <path d="M1 1 L9 5 L1 9 Z" style={{ fill }} />
    </marker>
  );
}

export default function EdgeMarkers() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute" }}
    >
      <defs>
        <Arrow id="hodos-arrow-gold" fill="var(--gold)" />
        <Arrow id="hodos-arrow-rule" fill="var(--ink-muted)" />
      </defs>
    </svg>
  );
}
