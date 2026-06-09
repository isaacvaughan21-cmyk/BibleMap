import Link from "next/link";

/** Fixed, translucent top nav. */
export default function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/60 bg-parchment/70 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-content items-center justify-between px-gutter md:px-gutter-lg"
      >
        {/* Left: wordmark */}
        <Link href="#hero" className="flex items-baseline gap-2">
          <span className="font-serif text-md text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </Link>

        {/* Center: coming soon */}
        <div className="hidden items-center gap-3 md:flex" aria-hidden="true">
          <span className="h-px w-8 bg-gold/50" />
          <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
            COMING SOON
          </span>
          <span className="h-px w-8 bg-gold/50" />
        </div>

        {/* Right: join link */}
        <Link
          href="#cta"
          className="group relative font-sans text-xs tracking-eyebrow text-gold transition-colors hover:text-ink"
        >
          JOIN WAITLIST
          <span
            aria-hidden="true"
            className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full"
          />
        </Link>
      </nav>
    </header>
  );
}
