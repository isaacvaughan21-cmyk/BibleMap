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

        {/* Center: beta status */}
        <div className="hidden items-center gap-3 md:flex" aria-hidden="true">
          <span className="h-px w-8 bg-gold/50" />
          <span className="flex items-center gap-2 font-sans text-2xs tracking-eyebrow text-ink-muted">
            <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-gold" />
            NOW IN OPEN BETA
          </span>
          <span className="h-px w-8 bg-gold/50" />
        </div>

        {/* Right: waitlist link + try-free pill */}
        <div className="flex items-center gap-6">
          <Link
            href="#cta"
            className="group relative hidden font-sans text-xs tracking-eyebrow text-gold transition-colors hover:text-ink sm:inline-block"
          >
            JOIN WAITLIST
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full"
            />
          </Link>
          <a
            href="/app"
            target="_blank"
            rel="noopener"
            className="rounded-full bg-gold px-4 py-2 font-sans text-2xs font-medium tracking-eyebrow text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15"
          >
            TRY IT FREE
          </a>
        </div>
      </nav>
    </header>
  );
}
