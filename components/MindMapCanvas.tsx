"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { MIND_MAP, type MindMapDepth } from "@/lib/mindmap-data";

/**
 * The signature interaction.
 *
 * A single fixed SVG sits behind every section. As the user scrolls, one root
 * <g> element receives a scale + translate transform that zooms from the hero
 * map into a focus node, revealing the next section's map nested inside it.
 *
 * Performance contract (see spec §4):
 *  - One SVG, no per-frame DOM mutation beyond the root transform.
 *  - `will-change: transform` lives only on the root <g>.
 *  - <=12 labels per depth.
 *  - Disabled under prefers-reduced-motion (static hero map) and on mobile.
 */

const VIEWBOX = 1000; // shared 0 0 1000 1000 coordinate space

/** Map scrollYProgress (0..1) to the camera path defined per depth. */
function useCamera(scrollYProgress: MotionValue<number>) {
  const last = MIND_MAP.length - 1;
  // Evenly distribute section keyframes across scroll progress.
  const stops = MIND_MAP.map((_, i) => i / last);
  const scales = MIND_MAP.map((d) => d.camera.scale);
  const xs = MIND_MAP.map((d) => d.camera.x);
  const ys = MIND_MAP.map((d) => d.camera.y);

  const scale = useTransform(scrollYProgress, stops, scales);
  const camX = useTransform(scrollYProgress, stops, xs);
  const camY = useTransform(scrollYProgress, stops, ys);

  return { scale, camX, camY, stops };
}

export default function MindMapCanvas() {
  const prefersReduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  // Scope the zoom to >=768px and to users who allow motion.
  useEffect(() => {
    if (prefersReduced) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [prefersReduced]);

  if (!enabled) return <StaticHeroCanvas />;
  return <AnimatedCanvas />;
}

/* ------------------------------------------------------------------ */
/* Animated (desktop, motion-OK)                                      */
/* ------------------------------------------------------------------ */
function AnimatedCanvas() {
  const { scrollYProgress } = useScroll();
  const { scale, camX, camY, stops } = useCamera(scrollYProgress);

  // Smooth the raw scroll value so the zoom doesn't feel jittery.
  const smooth = { stiffness: 80, damping: 24, mass: 0.6 };
  const sScale = useSpring(scale, smooth);
  const sX = useSpring(camX, smooth);
  const sY = useSpring(camY, smooth);

  // Translate so the camera target sits at the viewBox center (500,500),
  // then scale around that point: translate(center) scale(s) translate(-cam).
  const transform = useTransform([sScale, sX, sY], ([s, x, y]) => {
    const half = VIEWBOX / 2;
    return `translate(${half}px, ${half}px) scale(${s}) translate(${-(x as number)}px, ${-(y as number)}px)`;
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <motion.g style={{ transform, willChange: "transform" }}>
          {MIND_MAP.map((depth, i) => (
            <DepthGroup
              key={depth.depth}
              depth={depth}
              index={i}
              stops={stops}
              scrollYProgress={scrollYProgress}
            />
          ))}
        </motion.g>
      </svg>
    </div>
  );
}

/** One section's map. Label opacity peaks at its section and fades +/- one stop. */
function DepthGroup({
  depth,
  index,
  stops,
  scrollYProgress,
}: {
  depth: MindMapDepth;
  index: number;
  stops: number[];
  scrollYProgress: MotionValue<number>;
}) {
  const stop = stops[index];
  const span = 1 / (MIND_MAP.length - 1); // distance between stops

  // Peak opacity at this depth's stop, fading to 0 half a stop away.
  const opacity = useTransform(
    scrollYProgress,
    [stop - span * 0.6, stop, stop + span * 0.6],
    index === 0 ? [1, 1, 0] : [0, 1, 0]
  );

  const nodeById = new Map(depth.nodes.map((n) => [n.id, n]));
  // Stroke width must shrink as depth scale grows so lines stay ~hairline.
  const sw = 0.6 / depth.camera.scale;
  const dotR = 1.6 / depth.camera.scale;

  return (
    <motion.g data-depth={depth.depth} style={{ opacity }}>
      {/* hairline arcs */}
      {depth.links.map((link, li) => {
        const a = nodeById.get(link.from);
        const b = nodeById.get(link.to);
        if (!a || !b) return null;
        // gentle quadratic curve between nodes
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.12;
        return (
          <path
            key={li}
            d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={sw}
          />
        );
      })}

      {/* nodes + labels */}
      {depth.nodes.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={dotR}
            fill={n.focus ? "var(--gold)" : "var(--gold-soft)"}
          />
          <text
            x={n.x}
            y={n.y - dotR * 2.2}
            textAnchor="middle"
            fill="var(--ink-muted)"
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: `${10 / depth.camera.scale}px`,
              letterSpacing: `${0.2 / depth.camera.scale}px`,
            }}
          >
            {n.label}
          </text>
        </g>
      ))}
    </motion.g>
  );
}

/* ------------------------------------------------------------------ */
/* Static fallback (mobile + reduced motion) — hero map only          */
/* ------------------------------------------------------------------ */
function StaticHeroCanvas() {
  const hero = MIND_MAP[0];
  const nodeById = new Map(hero.nodes.map((n) => [n.id, n]));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-70"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <g>
          {hero.links.map((link, li) => {
            const a = nodeById.get(link.from);
            const b = nodeById.get(link.to);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.12;
            return (
              <path
                key={li}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                fill="none"
                stroke="var(--rule)"
                strokeWidth={0.6}
              />
            );
          })}
          {hero.nodes.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={2.4}
                fill={n.focus ? "var(--gold)" : "var(--gold-soft)"}
              />
              <text
                x={n.x}
                y={n.y - 8}
                textAnchor="middle"
                fill="var(--ink-muted)"
                style={{
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  fontSize: "13px",
                }}
              >
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
