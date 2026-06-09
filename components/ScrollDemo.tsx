"use client";

import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
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
import Reveal from "@/components/Reveal";

/**
 * Scroll-driven infinite-zoom demo — the signature interaction.
 *
 * Motion design:
 *  - On first view, hairline arcs DRAW themselves between bubbles, which fade
 *    in with a stagger — the map feels like it's being thought into existence.
 *  - Every bubble drifts on a slow ambient float (CSS, GPU-cheap), so the
 *    canvas always feels alive, never frozen.
 *  - Scrolling dives the camera into the glowing focus bubble (geometric zoom,
 *    constant speed). A gold ring blooms as you pass through it.
 *  - The inner map cascades in node-by-node as you arrive — a map unfolding
 *    inside a single thought.
 *
 * Plays on every screen size. CSS animations auto-disable under
 * prefers-reduced-motion (see globals.css).
 */

const VIEWBOX = 1000;

export default function ScrollDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  // Overdamped spring — calm glide, no overshoot, slightly more responsive
  // than scroll 1:1 so the dive feels piloted rather than dragged.
  const p = useSpring(scrollYProgress, {
    stiffness: 75,
    damping: 26,
    mass: 0.5,
  });

  // Pure geometric zoom (scale = PEAK^p) centered on the focus bubble,
  // driven through the SVG viewBox (framer can't transform an SVG <g>).
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
  const innerLinkOpacity = useTransform(p, [0.55, 0.8, 1], [0, 1, 1]);

  // Gold ring blooms outward as the camera passes through the bubble.
  const ringOpacity = useTransform(p, [0.32, 0.5, 0.66], [0, 0.9, 0]);
  const ringR = useTransform(p, [0.32, 0.66], [26, 110]);

  // UI overlays.
  const hintOpacity = useTransform(p, [0, 0.12], [1, 0]);
  const endOpacity = useTransform(p, [0.84, 0.97], [0, 1]);
  const endY = useTransform(p, [0.84, 0.97], [14, 0]);

  return (
    <section id="demo" className="relative bg-parchment">
      {/* Intro — normal flow, scrolls away before the zoom pins */}
      <div className="relative px-gutter pt-rhythm md:px-gutter-lg md:pt-rhythm-lg">
        <div className="dot-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-content text-center">
          <Reveal>
            <p className="font-sans text-2xs tracking-eyebrow text-gold">
              THE CANVAS
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-4 font-serif text-2xl text-ink md:text-xl">
              One question. A map without edges.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-4 max-w-md font-sans text-base text-ink-soft">
              Every question, verse, and note lives on one canvas — and any
              bubble opens into a whole map of its own.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Pinned zoom stage — slightly shorter runway on mobile */}
      <div ref={wrapRef} className="relative h-[300vh] md:h-[400vh]">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
          <div className="dot-grid absolute inset-0" aria-hidden="true" />
          {/* Soft vignette for depth — eye settles toward the center */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,var(--parchment-2)_125%)]"
          />

          <svg
            ref={svgRef}
            className="h-full w-full"
            viewBox={`${FOCUS.x - VIEWBOX / 2} ${FOCUS.y - VIEWBOX / 2} ${VIEWBOX} ${VIEWBOX}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="focus-glow">
                <stop
                  offset="0%"
                  stopColor="var(--gold-soft)"
                  stopOpacity="0.5"
                />
                <stop
                  offset="100%"
                  stopColor="var(--gold-soft)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>

            {/* ---------------- Outer depth ---------------- */}
            <motion.g style={{ opacity: outerOpacity }}>
              {/* breathing halo behind the focus bubble */}
              <circle
                cx={FOCUS.x}
                cy={FOCUS.y}
                r={56}
                fill="url(#focus-glow)"
                className="pulse-glow"
              />

              {/* hairline arcs draw themselves in on first view */}
              <DrawnLinks
                nodes={OUTER_NODES}
                links={OUTER_LINKS}
                strokeScale={1}
              />

              {/* gold ring blooming open as we dive through */}
              <motion.circle
                cx={FOCUS.x}
                cy={FOCUS.y}
                r={ringR}
                fill="none"
                stroke="var(--gold)"
                strokeWidth={1}
                style={{ opacity: ringOpacity }}
              />

              {/* bubbles fade in staggered, then drift forever */}
              {OUTER_NODES.map((n, i) => (
                <motion.g
                  key={n.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.25 + i * 0.09,
                    ease: "easeOut",
                  }}
                >
                  <g
                    className="floaty"
                    style={
                      {
                        "--float-amp": "3px",
                        "--float-dur": `${4.6 + (i % 4) * 0.9}s`,
                        animationDelay: `${-i * 0.7}s`,
                      } as React.CSSProperties
                    }
                  >
                    <Bubble node={n} fontUnits={15} />
                  </g>
                </motion.g>
              ))}
            </motion.g>

            {/* ---------------- Inner depth ---------------- */}
            {/* halo behind the inner hub */}
            <motion.g style={{ opacity: innerLinkOpacity }}>
              <circle
                cx={FOCUS.x}
                cy={FOCUS.y}
                r={7}
                fill="url(#focus-glow)"
                className="pulse-glow"
              />
              <Links
                nodes={INNER_NODES}
                links={INNER_LINKS}
                strokeScale={PEAK_SCALE}
              />
            </motion.g>

            {/* inner bubbles cascade in one by one as we arrive */}
            {INNER_NODES.map((n, i) => (
              <InnerBubble key={n.id} node={n} index={i} p={p} />
            ))}
          </svg>

          {/* Scroll hint */}
          <motion.div
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 text-center"
          >
            <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
              SCROLL TO ZOOM IN
            </p>
            <span className="scroll-cue mx-auto mt-2 block" />
          </motion.div>

          {/* End caption — rises in once we're deep inside */}
          <motion.div
            style={{ opacity: endOpacity, y: endY }}
            className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 text-center"
          >
            <div className="mx-auto inline-block rounded-2xl bg-parchment/75 px-6 py-3 backdrop-blur-sm">
              <p className="mx-auto max-w-md font-serif text-md italic text-ink-soft">
                Open any bubble and there&rsquo;s a whole map inside.
              </p>
              <p className="mt-1 font-sans text-2xs tracking-eyebrow text-ink-muted">
                IT NEVER RUNS OUT
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Inner bubbles — cascading reveal driven by zoom progress           */
/* ------------------------------------------------------------------ */
function InnerBubble({
  node,
  index,
  p,
}: {
  node: DemoNode;
  index: number;
  p: MotionValue<number>;
}) {
  const start = 0.52 + index * 0.045;
  const opacity = useTransform(
    p,
    [start, Math.min(start + 0.14, 0.99)],
    [0, 1]
  );
  return (
    <motion.g style={{ opacity }}>
      <g
        className="floaty"
        style={
          {
            "--float-amp": "0.3px",
            "--float-dur": `${5 + (index % 3) * 1.1}s`,
            animationDelay: `${-index * 0.9}s`,
          } as React.CSSProperties
        }
      >
        <Bubble node={node} fontUnits={15 / PEAK_SCALE} />
      </g>
    </motion.g>
  );
}

/* ------------------------------------------------------------------ */
/* Links                                                              */
/* ------------------------------------------------------------------ */
function linkPath(a: DemoNode, b: DemoNode) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.1;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

/** Static hairline arcs (inner depth — revealed by group opacity). */
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
        return (
          <path
            key={i}
            d={linkPath(a, b)}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={sw}
          />
        );
      })}
    </g>
  );
}

/** Arcs that draw themselves in on first view (outer depth). */
function DrawnLinks({
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
        return (
          <motion.path
            key={i}
            d={linkPath(a, b)}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={sw}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{
              pathLength: {
                duration: 1.2,
                delay: 0.15 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              },
              opacity: { duration: 0.3, delay: 0.15 + i * 0.08 },
            }}
          />
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Bubble — pill sized to its label                                   */
/* ------------------------------------------------------------------ */
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
        strokeDasharray={
          isNote ? `${fontUnits * 0.4} ${fontUnits * 0.3}` : undefined
        }
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
