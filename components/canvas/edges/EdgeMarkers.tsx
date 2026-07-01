/**
 * Arrowhead markers referenced by the custom edges (markerEnd). Rendered once
 * in the canvas so url(#id) resolves. The arrow sits at the path's target end,
 * its tip on the line end and the line running through the centre of its back.
 *
 * markerUnits="userSpaceOnUse" gives the arrow a fixed size and a predictable
 * reference point — the stroke-width-scaled default offsets the marker so the
 * line meets a corner rather than the centre of the back.
 *
 * The arrowhead is filled with `context-stroke` so it always inherits the
 * colour of the line it caps — which each theme tints (--edge-line /
 * --edge-accent, see app/globals.css). That keeps the arrow matched to its
 * line in every theme and state (it warms to the accent on hover/selection
 * with the stroke), so arrows never wash out against a themed background.
 */
export const ARROW_GOLD = "url(#hodos-arrow-accent)";
export const ARROW_RULE = "url(#hodos-arrow-line)";

function Arrow({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="14"
      markerHeight="14"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      {/* tip at (9,5); flat back from (1,1)–(1,9) centred on the axis y=5.
          context-stroke = the capped line's stroke colour (falls back to a
          visible ink tone where the keyword is unsupported). */}
      <path d="M1 1 L9 5 L1 9 Z" style={{ fill: "context-stroke" }} />
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
        <Arrow id="hodos-arrow-accent" />
        <Arrow id="hodos-arrow-line" />
      </defs>
    </svg>
  );
}
