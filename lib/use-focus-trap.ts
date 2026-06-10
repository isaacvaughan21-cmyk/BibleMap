"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps Tab cycling inside an open dialog and returns focus to the
 * previously focused element when it closes.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((f) => !f.hasAttribute("disabled"));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !el.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !el.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [ref, active]);
}
