"use client";

import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
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
 * The scroll-zoom is the signature feature, so it plays on every screen size
 * (mobile included). We intentionally do not gate on prefers-reduced-motion —
 * the zoom is gentle and spring-eased.
 */

const VIEWBOX = 1000;

export default function ScrollDemo() {
  return <AnimatedDemo />;
}

/* ------------------------------------------------------------------ */
/* Scroll-driven zoom                                                 */
/* ------------------------------------------------------------------ */
function AnimatedDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  // Smoothing so the zoom glides rather than tracking scroll 1:1. Overdamped
  // (no overshoot) for a calm, floaty feel.
  const p = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 24,
    mass: 0.55,
  });

  // Camera stays centered on the focus bubble and only zooms — pure zoom (no
  // pan) reads much smoother. We drive the SVG *viewBox* (not a <g> transform):
  // framer can't apply a transform string to an SVG <g>. Smaller viewBox = in.
  //
  // The zoom is GEOMETRIC (scale = PEAK^p), i.e. a constant multiplicative
  // zoom rate. A linear scale would make the dive visibly accelerate; geometric
  // feels like falling at a steady speed.
  const scale = useTransform(p, (v) => Math.pow(PEAK_SCALE, v));
  const size = useTransform(scale, (s) => VIEWBOX / s);
  const minX = useTransform(size, (w) => FOCUS.x - w / 2);
  const minY = useTransform(size, (h) => FOCUS.y - h / 2);
  const viewBox = useMotionTemplate`${minX} ${minY} ${size} ${size}`;

  const svgRef = useRef<SVGSVGElement>(null);
  useMotionValueEvent(viewBox, "change", (v) => {
    svgRef.current?.setAttribute("viewBox", v);
  });

  // Cross-fade the two depths as the focus bubble fills the screen.
  const outerOpacity = useTransform(p, [0, 0.5, 0.7], [1, 1, 0]);
  const innerOpacity = useTransform(p, [0.55, 0.78, 1], [0, 1, 1]);

  // "Opening" pulse ring on the focus bubble as we enter it. Animate the radius
  // (not a transform) to avoid SVG transform-origin pitfalls.
  const ringOpacity = useTransform(p, [0.32, 0.5, 0.66], [0, 0.9, 0]);
  const ringR = useTransform(p, [0.32, 0.66], [26, 110]);

  // UI overlays.
  const hintOpacity = useTransform(p, [0, 0.12], [1, 0]);
  const endOpacity = useTransform(p, [0.84, 0.97], [0, 1]);

  return (
    <section id="demo" className="relative bg-parchment">
      {/* Intro — normal flow, scrolls away before the zoom pins */}
      <div className="relative px-gutter pt-rhythm md:px-gutter-lg md:pt-rhythm-lg">
        <div className="dot-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-content text-center">
          <p className="font-sans text-2xs tracking-eyebrow text-gold">
            THE CANVAS
          </p>
          <h2 className="mt-4 font-serif text-2xl text-ink md:text-xl">
            One question. A map without edges.
          </h2>
          <p className="mx-auto mt-4 max-w-md font-sans text-base text-ink-soft">
            Every question, verse, and note lives on one canvas — and any bubble
            opens into a whole map of its own.
          </p>
        </div>
      </div>

      {/* Pinned zoom stage — slightly shorter runway on mobile */}
      <div ref={wrapRef} className="relative h-[300vh] md:h-[400vh]">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
          <div className="dot-grid absolute inset-0" aria-hidden="true" />

          <svg
            ref={svgRef}
            className="h-full w-full"
            viewBox={`${FOCUS.x - VIEWBOX / 2} ${FOCUS.y - VIEWBOX / 2} ${VIEWBOX} ${VIEWBOX}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
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
