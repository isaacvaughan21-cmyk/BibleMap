/**
 * Shared easing curves for the dive-into-a-bubble motion.
 *
 * The canvas dive (components/canvas/Canvas.tsx) and the landing demos
 * (ScrollDemo, LandingCanvas) all use these so the zoom-through feels
 * identical everywhere: a fall that accelerates, then a long soft landing.
 */

/** Fall in with gathering speed. */
export const easeInCubic = (t: number) => t * t * t;

/** Arrive with a long, soft landing. */
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/** Symmetric ease for lateral moves (canvas-to-canvas). */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * The dive as a single 0→1 curve, for scroll-driven playback where the fall
 * and the landing are one continuous motion. Mirrors the canvas dive: an
 * easeInCubic fall up to the threshold (where you pass through the bubble),
 * then an easeOutQuint settle into the depths. Continuous and monotonic.
 */
const THRESHOLD = 0.55; // scroll fraction at which the camera passes through
const AT_THRESHOLD = 0.62; // zoom-progress reached at the threshold
export const diveCurve = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (p < THRESHOLD) {
    return easeInCubic(p / THRESHOLD) * AT_THRESHOLD;
  }
  return (
    AT_THRESHOLD +
    easeOutQuint((p - THRESHOLD) / (1 - THRESHOLD)) * (1 - AT_THRESHOLD)
  );
};
