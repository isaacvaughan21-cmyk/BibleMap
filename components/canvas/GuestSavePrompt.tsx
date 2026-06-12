"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { OPEN_GATE_EVENT } from "./WelcomeGate";

const ACCOUNT_KEY = "hodos.account";
const DISMISS_KEY = "hodos.guestPromptDismissed";
/** Fired by WelcomeGate when the local account changes (guest ↔ signed up). */
export const ACCOUNT_CHANGED_EVENT = "hodos:account-changed";
/** Bubbles a guest must place before we gently suggest an account. */
const WORK_THRESHOLD = 2;

/**
 * Once a guest has actually started mapping (a couple of bubbles), nudge them
 * — once — to create a free account so their work is saved. Quiet, dismissible,
 * and gone the moment they sign up.
 */
export default function GuestSavePrompt() {
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const [guest, setGuest] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume until we read

  const readState = () => {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      const acct = raw ? (JSON.parse(raw) as { guest?: boolean }) : null;
      setGuest(!!acct?.guest);
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setGuest(false);
    }
  };

  useEffect(() => {
    readState();
    const onChange = () => readState();
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChange);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — local dismissal only
    }
    setDismissed(true);
  };

  if (!guest || dismissed || nodeCount < WORK_THRESHOLD) return null;

  return (
    <div className="dive-dim absolute left-1/2 top-[4.5rem] z-30 flex -translate-x-1/2 items-center gap-3 animate-fade-up rounded-full border border-gold/40 bg-parchment/95 px-4 py-2 shadow-lg shadow-ink/10 backdrop-blur-md">
      <span className="font-sans text-2xs text-ink-soft">
        You&rsquo;re working as a guest — create a free account to save your
        work.
      </span>
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new Event(OPEN_GATE_EVENT));
          dismiss();
        }}
        className="shrink-0 rounded-full bg-gold px-3 py-1 font-sans text-2xs font-medium text-parchment transition-colors hover:bg-ink"
      >
        Create account
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
      >
        Not now
      </button>
    </div>
  );
}
