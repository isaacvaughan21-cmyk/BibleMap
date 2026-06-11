import Reveal from "@/components/Reveal";

/** Hero — staggered entrance, soft gold aura, floating constellation accents. */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0 -z-[5]" aria-hidden="true" />

      {/* Soft gold aura behind the wordmark */}
      <div
        aria-hidden="true"
        className="pulse-glow pointer-events-none absolute left-1/2 top-1/3 -z-[4] h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--gold-soft)_0%,transparent_65%)] opacity-25 blur-2xl"
      />

      {/* Floating constellation accents */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[3] h-full w-full text-gold-soft"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g
          className="floaty"
          style={
            { "--float-amp": "6px", "--float-dur": "7s" } as React.CSSProperties
          }
        >
          <circle cx="170" cy="210" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="265" cy="300" r="2" fill="currentColor" opacity="0.5" />
          <path
            d="M 170 210 Q 220 235 265 300"
            stroke="var(--rule)"
            strokeWidth="1"
          />
        </g>
        <g
          className="floaty"
          style={
            {
              "--float-amp": "5px",
              "--float-dur": "8.5s",
              animationDelay: "-2.5s",
            } as React.CSSProperties
          }
        >
          <circle
            cx="1030"
            cy="190"
            r="2.5"
            fill="currentColor"
            opacity="0.6"
          />
          <circle cx="945" cy="285" r="2" fill="currentColor" opacity="0.45" />
          <path
            d="M 1030 190 Q 980 225 945 285"
            stroke="var(--rule)"
            strokeWidth="1"
          />
        </g>
        <g
          className="floaty"
          style={
            {
              "--float-amp": "4px",
              "--float-dur": "6.2s",
              animationDelay: "-4s",
            } as React.CSSProperties
          }
        >
          <circle cx="220" cy="620" r="2" fill="currentColor" opacity="0.5" />
          <circle
            cx="1000"
            cy="640"
            r="2.5"
            fill="currentColor"
            opacity="0.55"
          />
        </g>
      </svg>

      <div className="mx-auto max-w-content text-center">
        <Reveal y={36}>
          <h1 className="font-serif text-4xl leading-none text-ink md:text-[7.5rem]">
            Hodos
          </h1>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="h-px w-10 bg-gold/50" aria-hidden="true" />
            <p className="font-sans text-xs tracking-greek text-gold md:text-sm">
              ΟΔΟΣ — THE WAY, THE PATH
            </p>
            <span className="h-px w-10 bg-gold/50" aria-hidden="true" />
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <blockquote className="mx-auto mt-10 max-w-2xl">
            <p className="font-serif text-lg italic text-ink-soft md:text-xl">
              &ldquo;Your word is a lamp to my feet and a light to my
              path.&rdquo;
            </p>
            <cite className="mt-3 block font-sans text-2xs not-italic tracking-eyebrow text-ink-muted">
              — PSALM 119:105
            </cite>
          </blockquote>
        </Reveal>

        <Reveal delay={0.45}>
          <p className="mx-auto mt-10 max-w-2xl font-sans text-md leading-relaxed text-ink-soft">
            An infinite, zoomable mind map for Bible study — capture every
            question, connect every insight, and walk deeper into the Word than
            you ever have before.
          </p>
        </Reveal>

        <Reveal delay={0.6}>
          <div className="mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
            <a
              href="/app"
              target="_blank"
              rel="noopener"
              className="group rounded-full bg-gold px-8 py-4 font-sans text-sm font-medium text-parchment shadow-lg shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-xl hover:shadow-ink/15"
            >
              Try Hodos free{" "}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </a>
            <a
              href="#try"
              className="font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:text-gold"
            >
              SEE THE LIVE DEMO ↓
            </a>
          </div>
          <p className="mt-5 font-sans text-2xs text-ink-muted/80">
            Now in open beta — free while we build.
          </p>
        </Reveal>
      </div>

      {/* Scroll cue */}
      <Reveal
        delay={0.8}
        y={0}
        className="absolute bottom-10 left-0 right-0 text-center"
      >
        <span className="scroll-cue mx-auto block" aria-hidden="true" />
      </Reveal>
    </section>
  );
}
