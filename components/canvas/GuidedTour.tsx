"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "@/lib/store/canvas-store";
import * as repo from "@/lib/db/repo";
import { track } from "@/lib/analytics";

/**
 * The guided tour — a one-minute, learn-by-doing walk for brand-new readers.
 *
 * Not a slideshow: the reader builds a real first map (question → verse →
 * connection → dive → rise) and each step advances itself by watching the
 * store, so the tour never asks for something it can't see happen. Chrome
 * steps (Ask, the ··· menu) use a soft spotlight cut into a veil.
 *
 * Auto-starts once — after the welcome gate closes, on an empty canvas —
 * and is replayable forever from the ··· menu via START_TOUR_EVENT.
 */

/** Dispatch on window to (re)start the tour at step one. */
export const START_TOUR_EVENT = "hodos:start-tour";

const TOUR_META_KEY = "tourDone";
const ACCOUNT_KEY = "hodos.account";

/** The store facts each step's completion test reads. */
type TourSnap = {
  questionsWithText: number;
  versesWithRef: number;
  edgeCount: number;
  depth: number;
};

function computeSnap(s: {
  nodes: { type?: string; data: unknown }[];
  edges: unknown[];
  mapPath: unknown[];
}): TourSnap {
  let questionsWithText = 0;
  let versesWithRef = 0;
  for (const n of s.nodes) {
    const data = n.data as { content?: string; verseRef?: string };
    if (n.type === "question" && (data.content ?? "").trim()) {
      questionsWithText++;
    } else if (n.type === "verse" && data.verseRef) {
      versesWithRef++;
    }
  }
  return {
    questionsWithText,
    versesWithRef,
    edgeCount: s.edges.length,
    depth: s.mapPath.length,
  };
}

type Step = {
  id: string;
  /** "modal" = centered card over a veil; "action" = do-it-yourself card at
   *  the foot of the canvas; "spot" = spotlight on a piece of chrome. */
  kind: "modal" | "action" | "spot";
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  /** data-tour attribute to spotlight (spot steps, and the rise step). */
  target?: string;
  /** Auto-advance test — present on every action step. */
  done?: (now: TourSnap, base: TourSnap) => boolean;
  /** Short line shown with the gold check the moment `done` passes. */
  doneNote?: string;
  /** Manual-advance button label (modal + spot steps). */
  cta?: string;
};

const B = ({ children }: { children: React.ReactNode }) => (
  <b className="font-medium text-ink">{children}</b>
);

const STEPS: Step[] = [
  {
    id: "welcome",
    kind: "modal",
    eyebrow: "A ONE-MINUTE WALK",
    title: "Welcome to Hodos.",
    body: (
      <>
        A canvas where your questions and Scripture sit side by side, connected
        by your own hand. Walk the way once — you&rsquo;ll build your first real
        map as you go.
      </>
    ),
    cta: "Begin the walk",
  },
  {
    id: "question",
    kind: "action",
    eyebrow: "CREATE",
    title: "Every map begins with a question.",
    body: (
      <>
        <B>Double-click</B> anywhere on the parchment and choose <B>Question</B>
        . Type what you&rsquo;re wondering, then click away.
      </>
    ),
    done: (now, base) => now.questionsWithText > base.questionsWithText,
    doneNote: "Asked — that's the seed of the map.",
  },
  {
    id: "verse",
    kind: "action",
    eyebrow: "SCRIPTURE",
    title: "Now set the Word beside it.",
    body: (
      <>
        Double-click the parchment again — choose <B>Verse</B> this time, and
        find any passage that speaks to your question.
      </>
    ),
    done: (now, base) => now.versesWithRef > base.versesWithRef,
    doneNote: "Placed — Scripture is on the table.",
  },
  {
    id: "connect",
    kind: "action",
    eyebrow: "CONNECT",
    title: "Draw the line between them.",
    body: (
      <>
        Hover a bubble&rsquo;s edge until a small handle appears, then{" "}
        <B>drag</B> it onto the other bubble.
      </>
    ),
    done: (now, base) => now.edgeCount > base.edgeCount,
    doneNote: "Connected — this is the mapping in Bible mapping.",
  },
  {
    id: "dive",
    kind: "action",
    eyebrow: "GO DEEPER",
    title: "Every bubble holds a map inside.",
    body: (
      <>
        <B>Double-click a bubble</B> to dive into its own canvas — room to work
        out one thought without crowding the surface.
      </>
    ),
    done: (now) => now.depth > 1,
    doneNote: "You're inside the bubble's own map.",
  },
  {
    id: "rise",
    kind: "action",
    eyebrow: "RISE",
    title: "Every depth leads back out.",
    body: (
      <>
        Click the <B>‹</B> button in the top bar to rise to the map you came
        from.
      </>
    ),
    target: "back",
    done: (now) => now.depth === 1,
    doneNote: "Back on the surface — nothing lost.",
  },
  {
    id: "ask",
    kind: "spot",
    eyebrow: "STUDY",
    title: "Ask, and Scripture answers.",
    body: (
      <>
        <B>Ask Scripture</B> turns any question into real verses you can place
        on the map. Selecting a verse bubble also opens its cross-references in
        the study panel.
      </>
    ),
    target: "ask",
    cta: "Next",
  },
  {
    id: "menu",
    kind: "spot",
    eyebrow: "EVERYTHING ELSE",
    title: "One quiet menu holds the rest.",
    body: (
      <>
        The <B>Map of the Day</B>, your <B>Library</B> of studies, themes,
        translations, sharing — it all lives behind the ···.
      </>
    ),
    target: "menu",
    cta: "Almost there",
  },
  {
    id: "finale",
    kind: "modal",
    eyebrow: "THE WAY IS OPEN",
    title: "Walk it a little each day.",
    body: (
      <>
        Place one bubble a day and your lamp stays lit — the streak in the
        corner keeps count. Replay this walk anytime from the ··· menu.
      </>
    ),
    cta: "Begin mapping",
  },
];

export default function GuidedTour({
  yielding = false,
}: {
  /**
   * True while a picker, context menu, or modal the reader is mid-way through
   * is on screen. The coach card gets out of the way rather than competing
   * with it — the tour asks for these gestures, so it must never block them.
   */
  yielding?: boolean;
}) {
  const loaded = useCanvasStore((s) => s.loaded);
  const setTourActive = useCanvasStore((s) => s.setTourActive);
  const snap = useCanvasStore(useShallow(computeSnap));

  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const baseline = useRef<TourSnap>(snap);

  const begin = useCallback(
    (source: "auto" | "replay") => {
      baseline.current = computeSnap(useCanvasStore.getState());
      setFlash(false);
      setStepIndex(0);
      setTourActive(true);
      track("tour_start", { source });
    },
    [setTourActive],
  );

  const finish = useCallback(
    (completed: boolean, atStep: string) => {
      setStepIndex(null);
      setFlash(false);
      setTourActive(false);
      void repo.setMeta(TOUR_META_KEY, true);
      track(completed ? "tour_complete" : "tour_skip", { step: atStep });
    },
    [setTourActive],
  );

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i === null) return null;
      if (i >= STEPS.length - 1) {
        // Deferred so finish's side effects stay out of the state updater.
        setTimeout(() => finish(true, STEPS[STEPS.length - 1].id), 0);
        return i;
      }
      baseline.current = computeSnap(useCanvasStore.getState());
      return i + 1;
    });
  }, [finish]);

  // ---- Auto-start: once, after the gate closes, on an untouched canvas ----
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const maybeStart = (delay: number) => {
      try {
        if (!localStorage.getItem(ACCOUNT_KEY)) return; // gate is still up
      } catch {
        return;
      }
      void repo.getMeta<boolean>(TOUR_META_KEY).then((done) => {
        if (done || cancelled) return;
        const s = useCanvasStore.getState();
        const untouched =
          s.nodes.length === 0 &&
          s.edges.length === 0 &&
          s.canvases.length <= 1;
        if (!untouched) {
          // Not a brand-new reader — never auto-interrupt an existing map.
          void repo.setMeta(TOUR_META_KEY, true);
          return;
        }
        timer = setTimeout(() => {
          if (!cancelled) begin("auto");
        }, delay);
      });
    };

    maybeStart(700);
    // Fires when the welcome gate lets a new reader through (incl. guests).
    const onAccount = () => maybeStart(950); // after the gate's 560ms fade
    const onReplay = () => begin("replay");
    window.addEventListener("hodos:account-changed", onAccount);
    window.addEventListener(START_TOUR_EVENT, onReplay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("hodos:account-changed", onAccount);
      window.removeEventListener(START_TOUR_EVENT, onReplay);
    };
  }, [loaded, begin]);

  // ---- Auto-advance: the canvas itself confirms each action step ----
  const step = stepIndex === null ? null : STEPS[stepIndex];
  useEffect(() => {
    if (!step?.done || flash) return;
    if (step.done(snap, baseline.current)) setFlash(true);
  }, [snap, step, flash]);
  // Separate from the detector: its own re-run must not cancel the timer.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => {
      setFlash(false);
      next();
    }, 1250);
    return () => clearTimeout(t);
  }, [flash, next]);

  // ---- Spotlight: track the target element's rectangle ----
  const [spot, setSpot] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  /**
   * Left edge of the nearest right-hand panel the spotlit control can summon —
   * the study rail, or the ··· dropdown. An anchored card slides left of it, so
   * pointing AT a control never covers what the control opens. Both are always
   * measurable: the rail sits translated off-screen (left === viewport width)
   * when closed, and the dropdown is only in the DOM while open.
   */
  const [obstacleLeft, setObstacleLeft] = useState(Infinity);
  useEffect(() => {
    const measure = () => {
      let limit = Infinity;
      const panels = [
        document.querySelector('[data-tour-panel="rail"]'),
        document.querySelector('[role="menu"][aria-label="Map options"]'),
      ];
      for (const el of panels) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.left < window.innerWidth && r.left < limit) {
          limit = r.left;
        }
      }
      setObstacleLeft(limit);

      if (!step?.target) {
        setSpot(null);
        return;
      }
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot((prev) =>
        prev &&
        Math.abs(prev.top - r.top) < 1 &&
        Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    };
    measure();
    const iv = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(iv);
      window.removeEventListener("resize", measure);
    };
  }, [step?.target]);

  if (stepIndex === null || !step) return null;

  const pad = 7;
  const spotBox = spot && {
    top: spot.top - pad,
    left: spot.left - pad,
    width: spot.width + pad * 2,
    height: spot.height + pad * 2,
  };

  const progress = (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={stepIndex + 1}
      aria-label={`Tour step ${stepIndex + 1} of ${STEPS.length}`}
    >
      {STEPS.map((s, i) => (
        <span
          key={s.id}
          className={`h-[3px] rounded-full transition-all duration-500 ${
            i < stepIndex
              ? "w-3 bg-gold/50"
              : i === stepIndex
                ? "w-6 bg-gold"
                : "w-3 bg-rule"
          }`}
        />
      ))}
    </div>
  );

  const exitButton = (
    <button
      type="button"
      onClick={() => finish(false, step.id)}
      aria-label="End the tour"
      className="pointer-events-auto absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-parchment-2 hover:text-ink"
    >
      <svg width="9" height="9" viewBox="0 0 8 8" aria-hidden="true">
        <path
          d="M1 1l6 6M7 1L1 7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  const checkFlash = (
    <div className="tour-pop flex items-center gap-3 py-1.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M2.5 7.5L5.5 10.5L11.5 3.5"
            stroke="var(--gold)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="font-serif text-sm italic text-ink" role="status">
        {step.doneNote}
      </p>
    </div>
  );

  // ---- Centered modal steps (welcome + finale) ----
  if (step.kind === "modal") {
    const isFinale = step.id === "finale";
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="absolute inset-0 z-[70] flex items-center justify-center px-4"
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 backdrop-blur-[3px] ${
            isFinale ? "bg-parchment/60" : "bg-parchment/75"
          }`}
        />
        {!isFinale && (
          <div
            aria-hidden="true"
            className="dot-grid absolute inset-0 opacity-50"
          />
        )}
        {isFinale && <div aria-hidden="true" className="zoom-ring z-[71]" />}
        <div className="relative w-[min(420px,100%)] animate-fade-up rounded-2xl border border-rule bg-parchment px-8 py-8 text-center shadow-2xl shadow-ink/20">
          {exitButton}
          <p className="font-sans text-2xs tracking-eyebrow text-gold">
            {step.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-xl leading-snug text-ink">
            {step.title}
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-sans text-xs leading-relaxed text-ink-muted">
            {step.body}
          </p>
          <button
            type="button"
            onClick={next}
            autoFocus
            className="group mt-6 w-full rounded-full bg-gold py-3 font-sans text-sm font-medium text-parchment shadow-md shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15"
          >
            {step.cta}{" "}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </button>
          {!isFinale && (
            <button
              type="button"
              onClick={() => finish(false, step.id)}
              className="mt-3 font-sans text-2xs text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              Maybe later
            </button>
          )}
          <div className="mt-5 flex justify-center">{progress}</div>
        </div>
      </div>
    );
  }

  // ---- Spotlight cutout + pulsing halo (spot steps, and "rise") ----
  const spotlight = spotBox && (
    <>
      <div
        aria-hidden="true"
        className="tour-spot pointer-events-none absolute z-[60] rounded-full"
        style={spotBox}
      />
      <div
        aria-hidden="true"
        className="tour-halo pointer-events-none absolute z-[61] rounded-full border border-gold/70"
        style={spotBox}
      />
    </>
  );

  // ---- Coach card ----
  // Spot steps anchor beneath their target (both live in the top bar);
  // action steps rest at the foot of the canvas, fading during dives.
  const cardWidth = 400;
  const anchored = !!(step.kind === "spot" && spotBox);
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const spotCenterX = spotBox ? spotBox.left + spotBox.width / 2 : 0;
  // Centre under the target, then pull left of anything that panel opened.
  const rightLimit = Math.min(viewportW - 12, obstacleLeft - 16);
  const cardLeft = spotBox
    ? Math.max(
        12,
        Math.min(spotCenterX - cardWidth / 2, rightLimit - cardWidth),
      )
    : 0;
  const cardStyle: React.CSSProperties =
    anchored && spotBox
      ? {
          top: spotBox.top + spotBox.height + 16,
          left: cardLeft,
          width: cardWidth,
        }
      : {};
  // Once the card has stepped aside, the notch can no longer reach its target.
  const notchX = spotCenterX - cardLeft - 5;
  const showNotch = anchored && notchX >= 20 && notchX <= cardWidth - 20;

  return (
    <>
      {spotlight}
      {/* The card never eats a canvas gesture: the surface is click-through and
          only its own controls take pointer events. A double-click that lands
          on it still reaches the parchment and creates a bubble. */}
      <div
        role="dialog"
        aria-label={step.title}
        className={`dive-dim tour-card pointer-events-none absolute z-[62] ${
          anchored
            ? ""
            : "bottom-6 left-1/2 w-[min(420px,calc(100%-2rem))] -translate-x-1/2"
        } ${yielding ? "tour-card-yield" : ""}`}
        style={cardStyle}
      >
        {/* The entrance animation lives on its own element: `fade-up` fills
            `both`, so leaving it on the positioned wrapper would pin that
            wrapper's opacity and transform forever — clobbering both the
            yield and the -translate-x-1/2 centring. */}
        <div className="relative animate-fade-up">
          {/* Notch pointing up at the spotlit control */}
          {showNotch && (
            <span
              aria-hidden="true"
              className="absolute -top-[5px] h-2.5 w-2.5 rotate-45 border-l border-t border-rule bg-parchment"
              style={{ left: notchX }}
            />
          )}
          <div className="relative rounded-2xl border border-rule bg-parchment/95 px-6 py-5 shadow-xl shadow-ink/10 backdrop-blur-md">
            {exitButton}
            <p className="font-sans text-2xs tracking-eyebrow text-gold">
              {step.eyebrow}
            </p>
            {flash ? (
              <div className="mt-2 min-h-[3.5rem]">{checkFlash}</div>
            ) : (
              <div className="mt-2 min-h-[3.5rem]">
                <h2 className="font-serif text-md leading-snug text-ink">
                  {step.title}
                </h2>
                <p className="mt-1.5 font-sans text-xs leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              {progress}
              {step.cta ? (
                <button
                  type="button"
                  onClick={next}
                  autoFocus
                  className="group pointer-events-auto rounded-full bg-gold px-4 py-1.5 font-sans text-xs font-medium text-parchment shadow-sm shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink"
                >
                  {step.cta}{" "}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </button>
              ) : (
                !flash && (
                  <button
                    type="button"
                    onClick={next}
                    className="pointer-events-auto font-sans text-2xs text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    Skip this step
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
