/**
 * Plausible custom events. The script is injected in app/layout.tsx only when
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured; everything here no-ops
 * otherwise, so analytics can never break the canvas.
 */

declare global {
  interface Window {
    plausible?: (
      name: string,
      opts?: { props?: Record<string, string | number> },
    ) => void;
  }
}

export type AnalyticsEvent =
  | "bubble_created"
  | "bubble_opened"
  | "edge_drawn"
  | "crossref_added"
  | "session_minutes"
  | "map_size";

export function track(
  name: AnalyticsEvent,
  props?: Record<string, string | number>,
) {
  if (typeof window === "undefined") return;
  window.plausible?.(name, props ? { props } : undefined);
}
