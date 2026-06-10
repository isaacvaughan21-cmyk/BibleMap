/** Shown only when the map has zero bubbles. */
export default function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center">
      <div
        className="floaty flex items-baseline gap-3"
        style={
          { "--float-amp": "4px", "--float-dur": "6s" } as React.CSSProperties
        }
      >
        <span className="font-serif text-2xl text-ink">Hodos</span>
        <span className="font-sans text-xs tracking-greek text-gold">ΟΔΟΣ</span>
      </div>
      <p className="font-serif text-md italic text-ink-muted">
        Double-click anywhere to begin
      </p>
      <span className="scroll-cue mt-1 block" aria-hidden="true" />
    </div>
  );
}
