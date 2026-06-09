"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  FOCUS,
  INNER_LINKS,
  INNER_NODES,
  OUTER_LINKS,
  OUTER_NODES,
  PEAK_SCALE,
  type DemoLink,
  type DemoNode,
} from "@/lib/demo-map-data";

/**
 * Scroll-driven infinite-zoom demo.
 *
 * A tall wrapper pins a full-screen canvas (`sticky`). Scroll progress through
 * the wrapper drives a single zoom transform on one SVG <g>: the outer map of
 * verses + comments zooms into the focus bubble, which cross-fades into a whole
 * new map nested inside it — demoing the endlessly scrollable canvas.
 *
 * Scoped to >=768px + motion-OK. Otherwise a static outer map is shown.
 */

const VIEWBOX = 1000;

export default function ScrollDemo() {
  const prefersReduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (prefersReduced) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [prefersReduced]);

  if (!enabled) return <StaticDemo />;
  return <AnimatedDemo />;
}

/* ------------------------------------------------------------------ */
/* Animated (desktop, motion-OK)                                      */
/* ------------------------------------------------------------------ */
function AnimatedDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  // Light smoothing so the zoom glides rather than tracking scroll 1:1.
  const p = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    mass: 0.5,
  });

  // Camera: pan from map center to the focus bubble while scaling up.
  const cx = useTransform(p, [0, 1], [500, FOCUS.x]);
  const cy = useTransform(p, [0, 1], [500, FOCUS.y]);
  const scale = useTransform(p, [0, 1], [1, PEAK_SCALE]);

  // translate(center) scale(s) translate(-camera)
  const half = VIEWBOX / 2;
  const negCx = useTransform(cx, (v) => -v);
  const negCy = useTransform(cy, (v) => -v);
  const transform = useMotionTemplate`translate(${half}px, ${half}px) scale(${scale}) translate(${negCx}px, ${negCy}px)`;

  // Cross-fade the two depths.
  const outerOpacity = useTransform(p, [0, 0.4, 0.62], [1, 1, 0]);
  const innerOpacity = useTransform(p, [0.42, 0.66, 1], [0, 1, 1]);

  // "Opening" pulse ring on the focus bubble mid-zoom. Animate the radius
  // (not a transform) to avoid SVG transform-origin pitfalls.
  const ringOpacity = useTransform(p, [0.28, 0.45, 0.6], [0, 0.9, 0]);
  const ringR = useTransform(p, [0.28, 0.6], [26, 92]);

  // UI overlays.
  const hintOpacity = useTransform(p, [0, 0.08], [1, 0]);
  const endOpacity = useTransform(p, [0.82, 0.96], [0, 1]);

  return (
    <section id="demo" ref={wrapRef} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-parchment">
        <div className="dot-grid absolute inset-0" aria-hidden="true" />

        {/* Section label */}
        <div className="pointer-events-none absolute left-0 right-0 top-24 z-10 text-center">
          <p className="font-sans text-2xs tracking-eyebrow text-gold">
            THE CANVAS
          </p>
          <p className="mt-3 font-serif text-lg text-ink md:text-xl">
            One question. A map without edges.
          </p>
        </div>

        <svg
          className="h-full w-full"
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <motion.g style={{ transform, willChange: "transform" }}>
            {/* Outer depth */}
            <motion.g style={{ opacity: outerOpacity }}>
              <Links nodes={OUTER_NODES} links={OUTER_LINKS} strokeScale={1} />
              {/* opening pulse around the focus bubble */}
              <motion.circle
                cx={FOCUS.x}
                cy={FOCUS.y}
                r={ringR}
                fill="none"
                stroke="var(--gold)"
                strokeWidth={1}
                style={{ opacity: ringOpacity }}
              />
              {OUTER_NODES.map((n) => (
                <Bubble key={n.id} node={n} fontUnits={15} />
              ))}
            </motion.g>

            {/* Inner depth (nested inside the focus bubble) */}
            <motion.g style={{ opacity: innerOpacity }}>
              <Links
                nodes={INNER_NODES}
                links={INNER_LINKS}
                strokeScale={PEAK_SCALE}
              />
              {INNER_NODES.map((n) => (
                <Bubble key={n.id} node={n} fontUnits={15 / PEAK_SCALE} />
              ))}
            </motion.g>
          </motion.g>
        </svg>

        {/* Scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 text-center"
        >
          <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
            SCROLL TO ZOOM IN
          </p>
          <span className="mx-auto mt-2 block h-6 w-px bg-gold/50" />
        </motion.div>

        {/* End caption — revealed once we're deep in */}
        <motion.div
          style={{ opacity: endOpacity }}
          className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 text-center"
        >
          <p className="mx-auto max-w-md px-gutter font-sans text-sm text-ink-soft">
            Open any bubble and there&rsquo;s a whole map inside.{" "}
            <span className="text-ink-muted">It never runs out.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Static fallback (mobile + reduced motion)                          */
/* ------------------------------------------------------------------ */
function StaticDemo() {
  return (
    <section
      id="demo"
      className="relative overflow-hidden bg-parchment px-gutter py-rhythm md:px-gutter-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-content text-center">
        <p className="font-sans text-2xs tracking-eyebrow text-gold">
          THE CANVAS
        </p>
        <h2 className="mt-4 font-serif text-2xl text-ink">
          One question. A map without edges.
        </h2>
        <p className="mx-auto mt-4 max-w-md font-sans text-base text-ink-soft">
          Every question, verse, and note lives on one canvas — and any bubble
          opens into a whole map of its own.
        </p>

        <div className="relative mx-auto mt-12 aspect-square max-w-md">
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            aria-hidden="true"
          >
            <Links nodes={OUTER_NODES} links={OUTER_LINKS} strokeScale={1} />
            {OUTER_NODES.map((n) => (
              <Bubble key={n.id} node={n} fontUnits={20} />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shared primitives                                                  */
/* ------------------------------------------------------------------ */
function Links({
  nodes,
  links,
  strokeScale,
}: {
  nodes: DemoNode[];
  links: DemoLink[];
  strokeScale: number;
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sw = 0.7 / strokeScale;
  return (
    <g>
      {links.map((l, i) => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.1;
        return (
          <path
            key={i}
            d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={sw}
          />
        );
      })}
    </g>
  );
}

/** A pill bubble: rounded rect sized to its label, with centered text. */
function Bubble({ node, fontUnits }: { node: DemoNode; fontUnits: number }) {
  const padX = fontUnits * 0.9;
  const w = node.label.length * fontUnits * 0.54 + padX * 2;
  const h = fontUnits * 2.1;
  const x = node.x - w / 2;
  const y = node.y - h / 2;

  // Verse = gold stroke + filled dot. Note = dashed gold. Comment = rule stroke.
  const isVerse = node.kind === "verse";
  const isNote = node.kind === "note";
  const stroke = isVerse || isNote ? "var(--gold)" : "var(--rule)";
  const fill = isNote ? "var(--parchment-2)" : "var(--parchment)";

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        ry={h / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={(node.focus ? 1.4 : 0.8) / 1}
        strokeDasharray={isNote ? `${fontUnits * 0.4} ${fontUnits * 0.3}` : undefined}
      />
      {isVerse && (
        <circle
          cx={x + padX * 0.7}
          cy={node.y}
          r={fontUnits * 0.22}
          fill="var(--gold)"
        />
      )}
      <text
        x={isVerse ? node.x + fontUnits * 0.4 : node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={node.focus ? "var(--ink)" : "var(--ink-soft)"}
        style={{
          fontFamily: isVerse
            ? "var(--font-fraunces), Georgia, serif"
            : "var(--font-inter), system-ui, sans-serif",
          fontSize: `${fontUnits}px`,
          fontStyle: isNote ? "italic" : "normal",
        }}
      >
        {node.label}
      </text>
    </g>
  );
}
