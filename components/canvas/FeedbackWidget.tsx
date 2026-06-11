"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitFeedback } from "@/app/actions/submit-feedback";

/**
 * Beta feedback — a quiet pill beside the control cluster that opens a small
 * composer. Also opened by the top bar's SEND FEEDBACK link.
 */
export default function FeedbackWidget({
  open,
  onOpenChange,
  railOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  railOpen: boolean;
}) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    | { phase: "compose" }
    | { phase: "sent" }
    | { phase: "error"; message: string }
  >({ phase: "compose" });
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setState({ phase: "compose" });
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const send = () => {
    startTransition(async () => {
      const result = await submitFeedback({ message, email });
      if (result.status === "success") {
        setState({ phase: "sent" });
        setMessage("");
      } else if (result.status === "invalid") {
        setState({ phase: "error", message: result.message });
      } else if (result.status === "rate_limited") {
        setState({
          phase: "error",
          message: "Easy there — try again in a little while.",
        });
      } else {
        setState({
          phase: "error",
          message:
            "Couldn't send right now. Your note is still here — try again.",
        });
      }
    });
  };

  return (
    <div
      className={`dive-dim absolute bottom-4 z-30 transition-all duration-300 ${
        railOpen ? "right-[492px]" : "right-40"
      }`}
    >
      {open && (
        <div className="absolute bottom-12 right-0 w-80 animate-fade-up rounded-2xl border border-rule bg-parchment p-4 shadow-xl shadow-ink/10">
          {state.phase === "sent" ? (
            <div className="py-4 text-center">
              <p className="font-serif text-sm text-ink">
                Thank you — it&rsquo;s on its way.
              </p>
              <p className="mt-1 font-sans text-2xs text-ink-muted">
                Every note is read.
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-3 rounded-full border border-rule px-4 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
                SEND FEEDBACK
              </p>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="What's working? What's missing?"
                className="mt-2 w-full resize-none rounded-lg border border-rule bg-parchment-2/50 px-3 py-2 font-serif text-sm text-ink placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
                aria-label="Feedback message"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional, for a reply)"
                className="mt-2 w-full rounded-lg border border-rule bg-parchment-2/50 px-3 py-1.5 font-sans text-xs text-ink placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
                aria-label="Email for a reply (optional)"
              />
              {state.phase === "error" && (
                <p
                  className="mt-2 font-sans text-2xs text-ink-soft"
                  role="alert"
                >
                  {state.message}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || message.trim().length < 3}
                  className="rounded-full bg-gold px-4 py-1.5 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-gold"
                >
                  {pending ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-rule/80 bg-parchment/85 px-4 py-2 font-sans text-2xs text-ink-muted shadow-md shadow-ink/5 backdrop-blur-md transition-colors hover:border-gold hover:text-gold"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1.5 8.5V2.5A1 1 0 0 1 2.5 1.5h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4l-2.5 2.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        Send feedback
      </button>
    </div>
  );
}
