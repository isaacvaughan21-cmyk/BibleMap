"use client";

import { useEffect, useRef, useState } from "react";
import { SHORTCUTS } from "@/lib/shortcuts";
import { useFocusTrap } from "@/lib/use-focus-trap";

/** "?" overlay — every keyboard shortcut, platform-aware. */
export default function HelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [isMac, setIsMac] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close keyboard shortcuts"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        className="relative mx-auto mt-[14vh] w-[min(440px,calc(100%-2rem))] animate-fade-up rounded-2xl border border-rule bg-parchment px-6 py-5 shadow-2xl shadow-ink/20"
      >
        <div className="flex items-center justify-between border-b border-rule/70 pb-3">
          <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
            KEYBOARD SHORTCUTS
          </p>
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-sans text-2xs text-ink-muted">
            esc
          </kbd>
        </div>
        <ul className="divide-y divide-rule/50">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between py-2.5"
            >
              <span className="font-serif text-sm text-ink-soft">
                {s.label}
              </span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="rounded border border-rule bg-parchment-2/70 px-1.5 py-0.5 font-sans text-2xs text-ink-soft"
                  >
                    {k === "mod" ? (isMac ? "⌘" : "Ctrl") : k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
