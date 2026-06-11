"use client";

import { useEffect, useRef, useState } from "react";
import { joinBeta } from "@/app/actions/join-beta";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * v0 beta sign-up gate — shown over the canvas on first visit.
 *
 * There is no auth backend yet: the email is recorded for the beta list via
 * a server action, the password NEVER leaves this component (no transmit, no
 * store), and the "account" lives in localStorage so the gate shows once.
 * Real sign-in and cloud sync arrive with the account system.
 */

const ACCOUNT_KEY = "hodos.account";

/** Dispatch this to re-open the gate (e.g. a guest deciding to sign up). */
export const OPEN_GATE_EVENT = "hodos:open-gate";

type LocalAccount = {
  email: string | null;
  guest: boolean;
  plan: "beta";
  createdAt: number;
};

export default function WelcomeGate() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  useFocusTrap(panelRef, show && !leaving);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACCOUNT_KEY)) setShow(true);
    } catch {
      // storage unavailable (private mode etc.) — never lock the door
    }
    // A guest can come back for an account via the ··· menu
    const reopen = () => {
      setLeaving(false);
      setSubmitting(false);
      setShow(true);
    };
    window.addEventListener(OPEN_GATE_EVENT, reopen);
    return () => window.removeEventListener(OPEN_GATE_EVENT, reopen);
  }, []);

  const enter = (email: string | null) => {
    const account: LocalAccount = {
      email,
      guest: email === null,
      plan: "beta",
      createdAt: Date.now(),
    };
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } catch {
      // still let them in
    }
    track(email ? "beta_signup" : "beta_guest");
    setLeaving(true);
    setTimeout(() => setShow(false), 560);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const email = emailRef.current?.value.trim().toLowerCase() ?? "";
    const password = pwRef.current?.value ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      pwRef.current?.focus();
      return;
    }
    setSubmitting(true);
    // Email only — the password is checked here and never transmitted.
    const fd = new FormData();
    fd.append("email", email);
    try {
      const result = await joinBeta(fd);
      if (result.status === "invalid") {
        setError(result.message);
        setSubmitting(false);
        return;
      }
    } catch {
      // beta list is best-effort — never block the door on it
    }
    enter(email);
  };

  if (!show) return null;

  const inputCls =
    "w-full rounded-xl border border-rule bg-parchment-2/60 px-4 py-3 font-sans text-sm text-ink placeholder:text-ink-muted/50 focus:border-gold/60 focus:outline-none";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create your free Hodos account"
      className={`absolute inset-0 z-[80] flex items-center justify-center overflow-y-auto px-4 py-8 transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      // Canvas shortcuts listen on window (bubble phase) — keep Ctrl+K / "?"
      // from opening overlays beneath the gate. The focus trap uses capture,
      // so it is unaffected.
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Parchment veil — the canvas glows through, softly out of focus */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-parchment/85 backdrop-blur-md"
      />
      <div
        aria-hidden="true"
        className="dot-grid absolute inset-0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pulse-glow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--gold-soft)_0%,transparent_65%)] opacity-20 blur-2xl"
      />

      <div
        ref={panelRef}
        className="relative m-auto w-[min(440px,100%)] animate-fade-up rounded-2xl border border-rule bg-parchment px-7 py-8 shadow-2xl shadow-ink/20 sm:px-9"
      >
        {/* Wordmark + beta chip */}
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-serif text-lg text-ink">Hodos</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
          <span className="ml-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-px font-sans text-2xs tracking-eyebrow text-gold">
            V0 BETA
          </span>
        </div>

        <h1 className="mt-5 text-center font-serif text-xl leading-snug text-ink">
          The canvas is yours.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center font-sans text-xs leading-relaxed text-ink-muted">
          Create a free account to start mapping Scripture — every question,
          verse, and connection in one living map.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3" noValidate>
          <div>
            <label
              htmlFor="beta-email"
              className="mb-1.5 block font-sans text-2xs tracking-eyebrow text-ink-muted"
            >
              EMAIL
            </label>
            <input
              ref={emailRef}
              id="beta-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="beta-password"
              className="mb-1.5 block font-sans text-2xs tracking-eyebrow text-ink-muted"
            >
              PASSWORD
            </label>
            <div className="relative">
              <input
                ref={pwRef}
                id="beta-password"
                // No `name`: even a native form submit could never serialize
                // the password — it is read via ref and discarded.
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="8+ characters"
                className={`${inputCls} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:text-gold"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="font-sans text-xs text-gold">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="group !mt-5 w-full rounded-full bg-gold py-3.5 font-sans text-sm font-medium text-parchment shadow-md shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15 disabled:opacity-60"
          >
            {submitting ? (
              "Opening your canvas…"
            ) : (
              <>
                Create free account{" "}
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center font-sans text-2xs leading-relaxed text-ink-muted">
          Free during the open beta · No card required
          <br />
          Your maps live in your browser
        </p>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-rule/70" />
          <span className="font-sans text-2xs tracking-eyebrow text-ink-muted/70">
            OR
          </span>
          <span className="h-px flex-1 bg-rule/70" />
        </div>

        <button
          type="button"
          onClick={() => enter(null)}
          className="group w-full rounded-full border border-ink/15 bg-transparent py-3.5 font-sans text-sm font-medium text-ink-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold"
        >
          Continue as guest{" "}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </button>
        <p className="mt-2.5 text-center font-sans text-2xs text-ink-muted">
          No email needed — jump straight into the canvas
        </p>

        <p className="mt-5 text-center font-sans text-2xs leading-relaxed text-ink-muted/70">
          v0 beta — sign-in and cloud sync are on the way; for now your account
          lives on this device.
        </p>
      </div>
    </div>
  );
}
