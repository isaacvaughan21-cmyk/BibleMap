"use client";

import dynamic from "next/dynamic";
import Reveal from "@/components/Reveal";

// React Flow is heavy — keep it out of the initial bundle; the skeleton
// holds the layout while the chunk loads.
const LandingCanvas = dynamic(() => import("@/components/LandingCanvas"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="h-[440px] w-full animate-pulse rounded-2xl bg-parchment-2/70 md:h-[520px]"
    />
  ),
});

/**
 * Live demo + primary conversion section — a REAL canvas the visitor can
 * touch, followed by the strongest CTA on the page.
 */
export default function LiveDemo() {
  return (
    <section
      id="try"
      className="relative px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="mx-auto max-w-content">
        <Reveal>
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-10 bg-gold/50" aria-hidden="true" />
            <p className="font-sans text-2xs tracking-eyebrow text-gold">
              LIVE DEMO — OPEN BETA
            </p>
            <span className="h-px w-10 bg-gold/50" aria-hidden="true" />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="mt-6 text-center font-serif text-2xl leading-tight text-ink md:text-xl">
            Don&rsquo;t take our word for it.
            <br className="hidden sm:block" /> Drag a bubble.
          </h2>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-2xl text-center font-sans text-md leading-relaxed text-ink-soft">
            This is the real canvas — pan it, move the bubbles, trace the gold
            cross-references. In the full app, any bubble opens into a whole map
            of its own.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-rule bg-parchment shadow-xl shadow-ink/5">
            <LandingCanvas />
          </div>
          <p
            className="mt-4 text-center font-sans text-2xs tracking-eyebrow text-ink-muted"
            aria-hidden="true"
          >
            DRAG A BUBBLE · DOUBLE-CLICK A VERSE TO DIVE IN
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-16 text-center">
            <a
              href="/app"
              target="_blank"
              rel="noopener"
              className="group inline-block rounded-full bg-gold px-8 py-4 font-sans text-sm font-medium text-parchment shadow-lg shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-xl hover:shadow-ink/15"
            >
              Try Hodos free{" "}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </a>
            <p className="mt-4 font-sans text-2xs text-ink-muted">
              Free during the open beta · No card required · Nothing to install
            </p>
            <a
              href="#cta"
              className="mt-3 inline-block font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:text-gold"
            >
              OR JOIN THE WAITLIST FOR UPDATES ↓
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
