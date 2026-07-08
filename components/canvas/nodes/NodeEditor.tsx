"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  correctAtBoundary,
  correctText,
  isWordBoundary,
} from "@/lib/autocorrect";

/**
 * Inline autosize editor used inside bubbles. Blur or Escape saves;
 * Cmd/Ctrl+Enter saves and exits. `nodrag`/`nowheel` keep React Flow
 * gestures off while typing.
 *
 * When `autoCorrect` is on (the default) it fixes common typos and
 * capitalisation as each word is finished — phone-keyboard style — with a
 * one-step Backspace revert. Pass `autoCorrect={false}` for fields where the
 * raw text matters (e.g. a word being looked up).
 */
export default function NodeEditor({
  value,
  placeholder,
  className,
  singleLine = false,
  autoCorrect = true,
  onCommit,
}: {
  value: string;
  placeholder: string;
  className: string;
  singleLine?: boolean;
  autoCorrect?: boolean;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [val, setVal] = useState(value);
  const committed = useRef(false);
  // Caret to restore after a controlled value swap (autocorrect edits the
  // string out from under the browser's own cursor bookkeeping).
  const pendingCaret = useRef<number | null>(null);
  // The most recent autocorrection, so a single Backspace can undo it. `end` is
  // the caret position right after the fix (past the boundary char that
  // triggered it) — Backspace only reverts while the caret still sits there.
  const lastFix = useRef<{
    from: string;
    to: string;
    at: number;
    end: number;
  } | null>(null);

  // Freshly created nodes are visibility:hidden until React Flow measures
  // them, and hidden elements refuse focus — retry across frames until it
  // sticks.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (document.activeElement !== el && tries++ < 30) {
        raf = requestAnimationFrame(tryFocus);
      } else {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Autosize to content
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [val]);

  // Restore the caret after an autocorrect-driven value change, before paint.
  useLayoutEffect(() => {
    if (pendingCaret.current == null) return;
    const el = ref.current;
    if (el) el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [val]);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    const raw = val.trim();
    onCommit(autoCorrect ? correctText(raw) : raw);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = singleLine ? e.target.value.replace(/\n/g, "") : e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    // A word is only fixed the instant its closing boundary is typed at the
    // caret — never on deletes or mid-word edits, which would fight the writer.
    const typedForward = raw.length === val.length + 1;
    if (autoCorrect && typedForward && isWordBoundary(raw[caret - 1])) {
      const fix = correctAtBoundary(raw, caret);
      if (fix) {
        lastFix.current = {
          from: fix.from,
          to: fix.to,
          at: fix.at,
          end: fix.caret,
        };
        pendingCaret.current = fix.caret;
        setVal(fix.text);
        return;
      }
    }
    lastFix.current = null;
    setVal(raw);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={val}
      placeholder={placeholder}
      spellCheck
      autoCapitalize={autoCorrect ? "sentences" : "off"}
      autoCorrect={autoCorrect ? "on" : "off"}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        // Backspace immediately after an autocorrection puts the original word
        // back (keeping the space you typed) — the same escape hatch a phone
        // keyboard gives you.
        if (e.key === "Backspace" && autoCorrect && lastFix.current) {
          const el = e.currentTarget;
          const { from, to, at, end } = lastFix.current;
          if (
            el.selectionStart === el.selectionEnd &&
            el.selectionStart === end &&
            val.slice(at, at + to.length) === to
          ) {
            e.preventDefault();
            const restored =
              val.slice(0, at) + from + val.slice(at + to.length);
            pendingCaret.current = at + from.length;
            lastFix.current = null;
            setVal(restored);
            return;
          }
        }
        lastFix.current = null;
        if (
          e.key === "Escape" ||
          (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ||
          (e.key === "Enter" && singleLine)
        ) {
          e.preventDefault();
          commit();
        }
      }}
      aria-label="Edit bubble text"
      className={`nodrag nowheel block resize-none overflow-hidden bg-transparent placeholder:text-ink-muted/70 focus:outline-none ${className}`}
    />
  );
}
