"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the viewport is phone-sized — below Tailwind's `md`
 * (< 768px), the same line `DesktopHint` and every `md:` utility draw.
 *
 * Returns `undefined` until mounted so the server render and the first client
 * render agree (no hydration mismatch). Callers should treat `undefined` as
 * "not measured yet" and show a neutral placeholder rather than guessing — a
 * phone visitor must never glimpse the desktop UI for a frame.
 */
const MOBILE_QUERY = "(max-width: 767.98px)";

export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
