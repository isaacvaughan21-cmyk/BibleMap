"use client";

import { useEffect, useRef, useState } from "react";
import VersePicker from "@/components/canvas/VersePicker";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { HodosNode, NodeKind } from "@/lib/types";

/**
 * Compose a new bubble from the /notes view. The caller turns the result into a
 * real canvas bubble (and, under a topic, a manual edge to it) plus a matching
 * row in the reading document. Verses reuse the canvas's full book→chapter→verse
 * picker; everything else is a short inline form.
 */
export interface AddNoteResult {
  type: NodeKind;
  data: HodosNode["data"];
  /** Display title for the outline row (verse ref / term). */
  title?: string;
  /** Display text for the outline row (verse text / content / meaning). */
  text?: string;
}

const KINDS: { value: NodeKind; label: string }[] = [
  { value: "verse", label: "Verse" },
  { value: "note", label: "Note" },
  { value: "question", label: "Question" },
  { value: "definition", label: "Definition" },
];

export default function AddNoteDialog({
  parentLabel,
  onSubmit,
  onClose,
}: {
  /** The topic this point will sit under, or null for a new section. */
  parentLabel: string | null;
  onSubmit: (result: AddNoteResult) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<NodeKind>("note");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  useFocusTrap(panelRef, kind !== "verse");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (kind !== "verse") firstFieldRef.current?.focus();
  }, [kind]);

  // Verses get the full picker; its commit creates the row directly.
  if (kind === "verse") {
    return (
      <VersePicker
        onClose={onClose}
        onCommit={({ verseRef, verseText }) => {
          onSubmit({
            type: "verse",
            data: { verseRef, verseText },
            title: verseRef,
            text: verseText,
          });
        }}
      />
    );
  }

  const canSubmit =
    kind === "definition" ? term.trim().length > 0 : content.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (kind === "definition") {
      onSubmit({
        type: "definition",
        data: { content: term.trim(), definition: meaning.trim() },
        title: term.trim(),
        text: meaning.trim(),
      });
    } else {
      onSubmit({
        type: kind,
        data: { content: content.trim() },
        text: content.trim(),
      });
    }
  };

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Add to notes"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        className="relative mx-auto mt-[14vh] w-[min(520px,calc(100%-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/20"
      >
        <div className="border-b border-rule/70 px-5 py-4">
          <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
            {parentLabel ? `Add a point under` : "Add a new section"}
          </p>
          {parentLabel && (
            <p className="mt-0.5 truncate font-serif text-md text-ink">
              {parentLabel}
            </p>
          )}
        </div>

        <div className="px-5 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`rounded-full px-3 py-1 font-sans text-2xs transition-colors ${
                  kind === k.value
                    ? "bg-gold text-parchment"
                    : "border border-rule text-ink-muted hover:border-gold hover:text-gold"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4">
          {kind === "definition" ? (
            <div className="space-y-3">
              <input
                ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Term — e.g. propitiation"
                className="w-full rounded-lg border border-rule bg-parchment px-3 py-2 font-serif text-md text-ink placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
              />
              <textarea
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="Meaning (optional)"
                rows={3}
                className="w-full resize-none rounded-lg border border-rule bg-parchment px-3 py-2 font-serif text-base text-ink-soft placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
              />
            </div>
          ) : (
            <textarea
              ref={firstFieldRef as React.RefObject<HTMLTextAreaElement>}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              placeholder={
                kind === "question"
                  ? "What's the question?"
                  : "Write your note…"
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-rule bg-parchment px-3 py-2 font-serif text-base text-ink-soft placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-rule/70 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-full bg-gold px-4 py-1.5 font-sans text-2xs font-medium text-parchment shadow-md shadow-gold/20 transition-all hover:bg-ink disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
