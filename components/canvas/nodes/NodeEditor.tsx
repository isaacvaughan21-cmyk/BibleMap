"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Inline autosize editor used inside bubbles. Blur or Escape saves;
 * Cmd/Ctrl+Enter saves and exits. `nodrag`/`nowheel` keep React Flow
 * gestures off while typing.
 */
export default function NodeEditor({
  value,
  placeholder,
  className,
  singleLine = false,
  onCommit,
}: {
  value: string;
  placeholder: string;
  className: string;
  singleLine?: boolean;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [val, setVal] = useState(value);
  const committed = useRef(false);

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

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(val.trim());
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={val}
      placeholder={placeholder}
      onChange={(e) =>
        setVal(singleLine ? e.target.value.replace(/\n/g, "") : e.target.value)
      }
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
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
      className={`nodrag nowheel block resize-none overflow-hidden bg-transparent placeholder:text-ink-muted/50 focus:outline-none ${className}`}
    />
  );
}
