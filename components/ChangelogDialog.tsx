"use client";

import { useEffect, useRef, useState } from "react";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * A clickable version badge that opens a "what's new" dialog — the version
 * history. Lives on both the landing footer and the app top bar.
 *
 * `tone` matches the surface: "chip" is the gold pill used in the app chrome,
 * "muted" is the quiet footer text.
 */
export default function ChangelogDialog({
  tone = "muted",
  label,
}: {
  tone?: "chip" | "muted";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const text = label ?? `v${APP_VERSION}`;
  const trigger =
    tone === "chip"
      ? "rounded-full border border-gold/40 bg-gold/10 px-2 py-px font-sans text-2xs tracking-eyebrow text-gold transition-colors hover:border-gold hover:bg-gold/20"
      : "font-sans text-2xs text-ink-muted underline-offset-2 transition-colors hover:text-gold hover:underline";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={trigger}
        aria-haspopup="dialog"
        title="What's new"
      >
        {text}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="What's new in Hodos"
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
        >
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[2px]"
          />

          <div
            ref={panelRef}
            className="relative max-h-[80vh] w-[min(540px,100%)] overflow-y-auto rounded-2xl border border-rule bg-parchment px-7 py-7 shadow-2xl shadow-ink/20 sm:px-9"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-lg text-ink">
                  What&rsquo;s new
                </span>
                <span className="font-sans text-2xs tracking-greek text-gold">
                  ΟΔΟΣ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:text-ink"
              >
                CLOSE
              </button>
            </div>

            <ol className="mt-6 space-y-7">
              {CHANGELOG.map((release) => (
                <li key={release.version}>
                  <div className="flex items-baseline gap-3">
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-px font-sans text-2xs tracking-eyebrow text-gold">
                      v{release.version}
                    </span>
                    <span className="font-serif text-md text-ink">
                      {release.title}
                    </span>
                    <span className="ml-auto font-sans text-2xs text-ink-muted">
                      {release.date}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {release.changes.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-2.5 font-sans text-xs leading-relaxed text-ink-soft"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold"
                        />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
