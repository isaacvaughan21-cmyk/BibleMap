"use client";

import { useEffect, useState } from "react";

/**
 * Tracks prefers-reduced-motion. CSS animations are already disabled globally
 * (see globals.css); this hook covers React Flow's PROGRAMMATIC pan/zoom
 * animations, which are driven by d3 and ignore the media query.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
