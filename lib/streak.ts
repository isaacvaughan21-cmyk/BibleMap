/**
 * Daily study streak — the user keeps a streak alive by placing at least one
 * bubble each day. Pure date math + encouragement copy, so the store and the
 * badge UI share one source of truth and stay testable.
 *
 * Days are keyed by the user's LOCAL calendar date (YYYY-MM-DD), so a streak
 * turns over at the reader's midnight, not UTC's.
 */

export type StreakState = {
  /** Consecutive days with at least one bubble placed (0 = no live streak). */
  count: number;
  /** Longest streak ever reached — a quiet personal best. */
  best: number;
  /** Local date (YYYY-MM-DD) of the most recent bubble, or null if never. */
  lastDay: string | null;
};

export const EMPTY_STREAK: StreakState = { count: 0, best: 0, lastDay: null };

/** Local calendar date as YYYY-MM-DD. */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole-day difference a − b, parsing both as local midnights. */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = new Date(ay, am - 1, ad).getTime();
  const tb = new Date(by, bm - 1, bd).getTime();
  return Math.round((ta - tb) / 86_400_000);
}

export type StreakStatus =
  | "none" // never started, or broken and reset
  | "active" // a bubble has already been placed today
  | "atRisk"; // alive (placed yesterday) but nothing placed yet today

/** Where the streak stands relative to `today` — drives the badge's tone. */
export function streakStatus(s: StreakState, today: string): StreakStatus {
  if (s.count === 0 || !s.lastDay) return "none";
  if (s.lastDay === today) return "active";
  if (dayDiff(today, s.lastDay) === 1) return "atRisk";
  return "none"; // two+ days lapsed — the streak is broken
}

/**
 * Reconcile a stored streak with the present day. A streak whose last bubble is
 * older than yesterday has lapsed, so its count drops to 0 (the personal best
 * is always preserved). Pure — returns the same object when nothing changes.
 */
export function reconcileStreak(s: StreakState, today: string): StreakState {
  if (!s.lastDay) return s;
  const diff = dayDiff(today, s.lastDay);
  if (diff <= 1) return s; // today or yesterday → still alive
  if (s.count === 0) return s; // already reset
  return { count: 0, best: s.best, lastDay: s.lastDay };
}

/**
 * Fold a bubble placed today into the streak. The first bubble of a new day
 * either extends an unbroken streak (+1) or starts a fresh one (1); later
 * bubbles the same day change nothing. Pure.
 */
export function advanceStreak(
  s: StreakState,
  today: string,
): { next: StreakState; changed: boolean } {
  if (s.lastDay === today) return { next: s, changed: false };
  const consecutive = s.lastDay != null && dayDiff(today, s.lastDay) === 1;
  const count = consecutive ? s.count + 1 : 1;
  const best = Math.max(s.best, count);
  return { next: { count, best, lastDay: today }, changed: true };
}

/* ------------------------------------------------------------------ */
/* Words of encouragement                                              */
/* ------------------------------------------------------------------ */

/** Day counts that earn their own line when first reached. */
const MILESTONES = new Set([3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365]);

export function isMilestone(count: number): boolean {
  return MILESTONES.has(count) || (count > 100 && count % 100 === 0);
}

/** The line shown the moment a placement advances the streak (a small toast). */
export function celebrationFor(count: number): string {
  switch (count) {
    case 1:
      return "Day one. Every journey starts with a single step.";
    case 3:
      return "Three days running — a habit is taking root.";
    case 7:
      return "A full week in the Word. Beautifully kept.";
    case 14:
      return "Two weeks strong. Keep pressing on.";
    case 21:
      return "Twenty-one days — the way is becoming yours.";
    case 30:
      return "Thirty days of faithful study. Remarkable.";
    case 50:
      return "Fifty days of seeking. What a discipline.";
    case 75:
      return "Seventy-five days. Steady and unhurried.";
    case 100:
      return "One hundred days. The Word dwells in you richly.";
    case 365:
      return "A whole year, day by day. Extraordinary.";
    default:
      if (isMilestone(count))
        return `${count} days, faithfully kept. Keep going.`;
      return `${count} days running. Well done — keep walking the way.`;
  }
}

/** Rotating affirmations once today's bubble is already in. Stable per-day. */
const ACTIVE_LINES = [
  "You showed up today. Keep walking the way.",
  "One more day in the Word — well done.",
  "Faithful in little. This is how maps grow.",
  "Today's study is done. The lamp stays lit.",
  "Another step on the path. Keep going.",
];

/** Encouragement for the streak popover, given where the streak stands today. */
export function encouragementFor(status: StreakStatus, count: number): string {
  if (status === "none") {
    return "Place a bubble today to begin a streak. Small steps, faithfully kept.";
  }
  if (status === "atRisk") {
    return "Your streak is still burning — place one bubble today to keep it alive.";
  }
  return ACTIVE_LINES[count % ACTIVE_LINES.length];
}
