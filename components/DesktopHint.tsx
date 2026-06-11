"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "hodos.desktopHintDismissed";

/**
 * A subtle, dismissible note shown only on small screens: Hodos is a spatial,
 * infinite canvas, so it simply has more room to breathe on a desktop. We say
 * so honestly rather than letting a phone visitor assume the cramped view is
 * all there is. Dismissal is remembered per device.
 */
export default function DesktopHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — worst case it shows again next visit
    }
  };

  if (!show) return null;

  return (
    <div
      role="note"
      // Sits just under the fixed 64px nav; mobile only.
      className="fixed inset-x-0 top-16 z-40 flex items-center justify-center gap-3 border-b border-gold/20 bg-parchment-2/90 px-gutter py-2 backdrop-blur-md md:hidden"
    >
      <span
        aria-hidden="true"
        className="pulse-glow h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
      />
      <p className="font-sans text-2xs leading-snug text-ink-muted">
        Hodos is built for a big canvas —{" "}
        <span className="text-ink-soft">best explored on desktop.</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss desktop tip"
        className="-mr-1 ml-1 shrink-0 rounded-full p-1 font-sans text-sm leading-none text-ink-muted transition-colors hover:text-gold"
      >
        ×
      </button>
    </div>
  );
}
