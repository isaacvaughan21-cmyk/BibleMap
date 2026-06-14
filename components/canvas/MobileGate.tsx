"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-is-mobile";

/**
 * Gates the canvas by viewport. Hodos's canvas is a sprawling, spatial
 * workspace — it wants a desktop's room and a pointer to feel right, so on a
 * phone we don't open it at all. The landing page and the Journal stay fully
 * available on mobile; only the canvas waits for a bigger screen.
 *
 * Blocking by RENDER (not just hiding with `md:` classes) means the heavy
 * canvas — React Flow, IndexedDB, cloud sync — never mounts on a phone, and a
 * phone visitor never reaches the sign-in gate. While the viewport size is
 * still unknown we show bare parchment, identical to the canvas's own loading
 * state, so nothing flashes before we know which screen this is.
 */
export default function MobileGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) track("mobile_blocked");
  }, [isMobile]);

  // Not measured yet — neutral parchment (the canvas loads onto the same bg,
  // so on desktop this is seamless; on mobile it never reveals the canvas).
  if (isMobile === undefined) {
    return <div className="h-full w-full bg-parchment" />;
  }

  if (isMobile) return <DesktopOnly />;

  return <>{children}</>;
}

/** The "come back on a desktop" screen — same parchment atmosphere as the gate. */
function DesktopOnly() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-parchment px-gutter py-12 text-center">
      <div
        aria-hidden="true"
        className="dot-grid absolute inset-0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pulse-glow pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--gold-soft)_0%,transparent_65%)] opacity-20 blur-2xl"
      />

      <div className="relative z-10 flex w-full max-w-sm animate-fade-up flex-col items-center">
        {/* Wordmark + beta chip — mirrors the WelcomeGate */}
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-serif text-lg text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
          <span className="ml-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-px font-sans text-2xs tracking-eyebrow text-gold">
            V0 BETA
          </span>
        </div>

        {/* A monitor holding a tiny verse-map — the canvas waits on a screen */}
        <svg
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="mt-9 h-14 w-14 text-gold"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="5"
            y="9"
            width="54"
            height="37"
            rx="3"
            className="opacity-70"
          />
          <path d="M24 54h16M29 46v8M35 46v8" className="opacity-50" />
          <circle cx="23" cy="27" r="3.5" fill="currentColor" stroke="none" />
          <circle cx="42" cy="21" r="2.5" />
          <circle cx="41" cy="36" r="2.5" />
          <path d="M26 26l13-4M25 29l13 6" className="opacity-60" />
        </svg>

        <h1 className="mt-7 font-serif text-2xl leading-snug text-ink">
          Made for a bigger canvas.
        </h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-muted">
          Hodos spreads your study of Scripture across an endless, spatial
          canvas — it&rsquo;s built for a desktop&rsquo;s room and a pointer to
          draw every question, verse, and connection. Open it on a computer to
          start mapping.
        </p>
        <p className="mt-5 font-sans text-2xs tracking-eyebrow text-gold">
          A MOBILE VERSION IS ON THE WAY
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3">
          <Link
            href="/"
            className="group w-full rounded-full bg-gold py-3.5 font-sans text-sm font-medium text-parchment shadow-md shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15"
          >
            Back to home{" "}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <Link
            href="/blog"
            className="w-full rounded-full border border-ink/15 py-3.5 font-sans text-sm font-medium text-ink-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold"
          >
            Read the Journal
          </Link>
        </div>
      </div>
    </div>
  );
}
