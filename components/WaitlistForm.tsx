"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { joinWaitlist, type WaitlistResult } from "@/app/actions/join-waitlist";

// window.plausible is declared once in lib/analytics.ts.
import "@/lib/analytics";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group shrink-0 rounded-full bg-gold px-6 py-3 font-sans text-sm font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15 disabled:opacity-60"
    >
      {pending ? (
        "Joining…"
      ) : (
        <>
          Join the Waitlist{" "}
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </>
      )}
    </button>
  );
}

export default function WaitlistForm() {
  const [state, formAction] = useFormState<WaitlistResult | null, FormData>(
    joinWaitlist,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Fire Plausible events on terminal states.
  useEffect(() => {
    if (!state) return;
    if (state.status === "success" || state.status === "duplicate") {
      window.plausible?.("waitlist_submit_success");
    } else {
      window.plausible?.("waitlist_submit_error");
    }
  }, [state]);

  // Success / duplicate → inline confirmation card, no navigation.
  if (state?.status === "success" || state?.status === "duplicate") {
    const message =
      state.status === "duplicate"
        ? "You're already on the list."
        : "You're on the list. We'll be in touch.";
    return (
      <div
        role="status"
        className="mx-auto max-w-md rounded-xl border border-rule bg-parchment px-8 py-10 text-center"
      >
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-gold text-gold">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-5 font-serif text-lg text-ink">{message}</p>
      </div>
    );
  }

  const errorMessage =
    state?.status === "invalid"
      ? state.message
      : state?.status === "rate_limited"
        ? "Too many attempts. Please try again in a few minutes."
        : state?.status === "error"
          ? "Something went wrong — try again."
          : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="mx-auto max-w-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="waitlist-email" className="sr-only">
            Email address
          </label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-invalid={errorMessage ? "true" : undefined}
            aria-describedby={errorMessage ? "waitlist-error" : undefined}
            className="w-full border-0 border-b border-ink-muted/40 bg-transparent px-1 py-2 font-sans text-base text-ink placeholder:text-ink-muted/60 focus:border-gold focus:outline-none focus:ring-0"
          />
        </div>
        <SubmitButton />
      </div>

      {errorMessage && (
        <p
          id="waitlist-error"
          role="alert"
          className="mt-3 font-sans text-xs text-gold"
        >
          {errorMessage}
        </p>
      )}

      <p className="mt-5 text-center font-sans text-2xs text-ink-muted">
        No spam. One email when we launch.
      </p>
    </form>
  );
}
