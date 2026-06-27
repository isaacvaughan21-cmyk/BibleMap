"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  encouragementFor,
  localDayKey,
  streakStatus,
  type StreakStatus,
} from "@/lib/streak";

/**
 * Bottom-left study-streak badge — a lamp that stays lit while the reader
 * places at least one bubble a day ("Your word is a lamp to my feet"). It pops
 * a line of encouragement the moment a placement carries the streak forward,
 * and a click opens a small panel with the count, the personal best, and a
 * nudge to keep going.
 */
export default function StreakBadge() {
  const streak = useCanvasStore((s) => s.streak);
  const celebration = useCanvasStore((s) => s.streakCelebration);
  const dismiss = useCanvasStore((s) => s.dismissStreakCelebration);

  const [open, setOpen] = useState(false);
  // A brief glow on the lamp the moment the streak advances.
  const [pulse, setPulse] = useState(false);
  // Re-derive "today" on a timer so a streak placed yesterday flips to
  // "at risk" if the app is left open across midnight.
  const [today, setToday] = useState(() => localDayKey());

  const status = streakStatus(streak, today);

  // Auto-dismiss the celebration toast after a few seconds (longer for a
  // milestone, which deserves a beat). Also lights the lamp.
  useEffect(() => {
    if (!celebration) return;
    setPulse(true);
    const glow = setTimeout(() => setPulse(false), 1400);
    const hide = setTimeout(dismiss, celebration.milestone ? 7000 : 5000);
    return () => {
      clearTimeout(glow);
      clearTimeout(hide);
    };
  }, [celebration, dismiss]);

  // Keep "today" fresh without a tight interval — once a minute is plenty.
  useEffect(() => {
    const id = setInterval(() => setToday(localDayKey()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Close the panel on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const lit = status === "active";
  const count = streak.count;

  return (
    <div className="dive-dim absolute left-4 top-[4.25rem] z-30">
      {/* Celebration — words of encouragement on a fresh-day placement. */}
      {celebration && (
        <div
          role="status"
          className="absolute left-0 top-11 w-64 animate-fade-up rounded-xl border border-gold/40 bg-parchment px-4 py-3 shadow-xl shadow-ink/10"
        >
          <p className="flex items-center gap-2 font-sans text-2xs tracking-eyebrow text-gold">
            <Flame lit className="h-3.5 w-3.5" />
            {celebration.count}-DAY STREAK
          </p>
          <p className="mt-1.5 font-serif text-sm italic leading-snug text-ink-soft">
            {celebration.message}
          </p>
        </div>
      )}

      {/* The streak panel — count, best, encouragement. */}
      {open && !celebration && (
        <>
          <div
            className="fixed inset-0 z-0"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Study streak"
            className="absolute left-0 top-11 z-10 w-64 animate-fade-up rounded-xl border border-rule bg-parchment p-4 shadow-xl shadow-ink/10"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-2xs tracking-eyebrow text-ink-muted">
                STUDY STREAK
              </span>
              {streak.best > 0 && (
                <span className="font-sans text-2xs text-ink-muted">
                  Best {streak.best}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-serif text-2xl text-ink tabular-nums">
                {count}
              </span>
              <span className="font-sans text-xs text-ink-muted">
                {count === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="mt-1.5 font-serif text-sm italic leading-snug text-ink-soft">
              {encouragementFor(status, count)}
            </p>
          </div>
        </>
      )}

      {/* The pill itself. */}
      <button
        type="button"
        onClick={() => {
          if (celebration) dismiss();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={
          count > 0
            ? `Study streak: ${count} ${count === 1 ? "day" : "days"}${
                status === "atRisk" ? " — place a bubble today to keep it" : ""
              }`
            : "Study streak — place a bubble to begin"
        }
        title="Daily study streak"
        className={`flex items-center gap-1.5 rounded-full border bg-parchment/85 py-1 pl-2 pr-3 shadow-md shadow-ink/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 ${
          status === "atRisk"
            ? "border-gold/70 streak-breathe"
            : "border-rule/80 hover:border-gold/60"
        }`}
      >
        <Flame
          lit={lit || pulse}
          className={`h-4 w-4 transition-transform duration-300 ${
            pulse ? "scale-125" : ""
          }`}
        />
        <span
          className={`font-sans text-xs font-medium tabular-nums ${
            count > 0 ? "text-ink" : "text-ink-muted"
          }`}
        >
          {count > 0 ? count : "Start"}
        </span>
      </button>
    </div>
  );
}

/** A small lamp-flame — gold and glowing when lit, hollow ink when not. */
function Flame({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`${lit ? "text-gold" : "text-ink-muted"} ${className ?? ""}`}
    >
      <path
        d="M7 1.2c.4 2.1-1.6 2.7-1.6 4.6 0 .6.3 1.1.7 1.4-.1-1.3.9-2 1.4-2.6.5.8 1.7 1.6 1.7 3.1A3.2 3.2 0 0 1 7 12.8a3.2 3.2 0 0 1-2.2-5.5C3.3 8.6 3.2 10.4 4 11.6 2.4 10.9 1.4 9.3 1.4 7.5c0-3.4 4-3.6 5.6-6.3Z"
        fill={lit ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
