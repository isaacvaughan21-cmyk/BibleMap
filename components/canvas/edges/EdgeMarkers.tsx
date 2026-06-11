/**
 * Arrowhead markers referenced by the custom edges (markerEnd). Rendered once
 * in the canvas so url(#id) resolves. The arrow sits at the path's target end,
 * pointing toward the derived bubble.
 */
export const ARROW_GOLD = "url(#hodos-arrow-gold)";
export const ARROW_RULE = "url(#hodos-arrow-rule)";

export default function EdgeMarkers() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute" }}
    >
      <defs>
        <marker
          id="hodos-arrow-gold"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto-start-reverse"
        >
          <path d="M1 1 L9 5 L1 9 Z" style={{ fill: "var(--gold)" }} />
        </marker>
        <marker
          id="hodos-arrow-rule"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M1 1 L9 5 L1 9 Z" style={{ fill: "var(--ink-muted)" }} />
        </marker>
      </defs>
    </svg>
  );
}
