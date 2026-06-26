"use client";

import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { askScripture } from "@/app/actions/ask-scripture";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import type {
  AskResult,
  FigureBlock,
  Testament,
  ValidatedCitation,
} from "@/lib/qa/types";

/**
 * "Ask Scripture" — a second mode of the study rail. A reader asks a natural-
 * language question and gets an answer grounded only in the Bible, with the
 * cited verses listed distinctly below the prose and addable to the canvas.
 */

const EXAMPLES = [
  "Who wrote the book of Romans?",
  "Who was Matthew?",
  "What does the Bible say about grace?",
];

export default function AskPanel({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [errored, setErrored] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  // Which testament topical verse searches draw from (default New).
  const [testament, setTestament] = useState<Testament>("NT");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The question's hub bubble on the canvas — created lazily on the first "add".
  const hubIdRef = useRef<string | null>(null);

  const createNode = useCanvasStore((s) => s.createNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setEditing = useCanvasStore((s) => s.setEditing);
  const addVerseWithCrossRef = useCanvasStore((s) => s.addVerseWithCrossRef);
  const bibleVersion = useCanvasStore((s) => s.bibleVersion);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(qRaw: string, t: Testament = testament) {
    const question = qRaw.trim();
    if (!question || busy) return;
    setBusy(true);
    setErrored(false);
    setResult(null);
    setAdded(new Set());
    hubIdRef.current = null; // a new question starts a fresh thread on the canvas
    setAsked(question);
    setInput(question);
    try {
      setResult(
        await askScripture({ question, version: bibleVersion, testament: t }),
      );
    } catch {
      setErrored(true);
    } finally {
      setBusy(false);
    }
  }

  // Switching testament re-runs the current question with the new scope.
  function changeTestament(t: Testament) {
    if (t === testament) return;
    setTestament(t);
    if (asked && !busy) submit(asked, t);
  }

  /** Create (once) the question hub bubble these citations thread off of. */
  function ensureHub(): string {
    if (hubIdRef.current) return hubIdRef.current;
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const id = createNode("question", center);
    updateNodeData(id, { content: asked });
    setEditing(null);
    hubIdRef.current = id;
    return id;
  }

  function addOne(c: ValidatedCitation) {
    if (added.has(c.ref)) return;
    const hub = ensureHub();
    const newId = addVerseWithCrossRef(hub, c.ref, c.text);
    setAdded((prev) => new Set(prev).add(c.ref));
    setTimeout(() => {
      fitView({
        nodes: [{ id: hub }, { id: newId }],
        duration: reducedMotion ? 0 : 500,
        padding: 0.4,
        maxZoom: 1,
      });
    }, 90);
  }

  function addAll(cites: ValidatedCitation[]) {
    const hub = ensureHub();
    const ids = [hub];
    for (const c of cites) {
      if (added.has(c.ref)) continue;
      ids.push(addVerseWithCrossRef(hub, c.ref, c.text));
    }
    setAdded((prev) => {
      const next = new Set(prev);
      for (const c of cites) next.add(c.ref);
      return next;
    });
    setTimeout(() => {
      fitView({
        nodes: ids.map((id) => ({ id })),
        duration: reducedMotion ? 0 : 500,
        padding: 0.3,
        maxZoom: 1,
      });
    }, 90);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Question input — pinned above the scrolling answer */}
      <div className="border-b border-rule/60 px-5 pb-3 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              } else if (e.key === "Escape") {
                onClose?.();
              }
            }}
            placeholder="Ask a question grounded in Scripture…"
            aria-label="Ask a question about the Bible"
            className="w-full resize-none rounded-lg border border-rule bg-parchment px-3 py-2 font-sans text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-gold focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-1.5"
              title="Which testament to search for verses"
            >
              <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink-muted/70">
                Testament
              </span>
              <div className="flex gap-0.5 rounded-full border border-rule p-0.5">
                <TestamentToggle
                  active={testament === "NT"}
                  onClick={() => changeTestament("NT")}
                >
                  New
                </TestamentToggle>
                <TestamentToggle
                  active={testament === "OT"}
                  onClick={() => changeTestament("OT")}
                >
                  Old
                </TestamentToggle>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-gold px-4 py-1.5 font-sans text-2xs tracking-eyebrow text-parchment transition-colors hover:bg-ink disabled:opacity-50"
            >
              {busy ? "Asking…" : "Ask"}
            </button>
          </div>
        </form>
      </div>

      {/* Answer / states */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {busy ? (
          <p className="px-5 py-8 text-center font-serif text-sm italic text-ink-muted">
            Searching the Scriptures…
          </p>
        ) : errored ? (
          <div className="px-5 py-8 text-center">
            <p className="font-serif text-sm italic text-ink-muted">
              Something went wrong reaching the assistant.
            </p>
            <button
              type="button"
              onClick={() => submit(asked || input)}
              className="mt-2 rounded-full border border-rule px-4 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
            >
              Try again
            </button>
          </div>
        ) : result ? (
          <AnswerView
            result={result}
            added={added}
            onAdd={addOne}
            onAddAll={addAll}
          />
        ) : (
          <Idle onPick={(q) => submit(q)} />
        )}
      </div>
    </div>
  );
}

function TestamentToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-0.5 font-sans text-2xs transition-colors ${
        active ? "bg-gold text-parchment" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Idle({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="px-5 py-5">
      <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
        TRY ASKING
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-rule px-3.5 py-1.5 text-left font-serif text-sm text-ink-soft transition-colors hover:border-gold hover:text-gold"
          >
            {q}
          </button>
        ))}
      </div>
      <p className="mt-5 font-serif text-2xs italic leading-relaxed text-ink-muted">
        Answers come only from Scripture, with every claim backed by cited
        verses.
      </p>
    </div>
  );
}

function AnswerView({
  result,
  added,
  onAdd,
  onAddAll,
}: {
  result: AskResult;
  added: Set<string>;
  onAdd: (c: ValidatedCitation) => void;
  onAddAll: (cs: ValidatedCitation[]) => void;
}) {
  if (
    result.status === "no_answer" ||
    result.status === "off_topic" ||
    result.status === "invalid"
  ) {
    return (
      <p className="px-5 py-8 text-center font-serif text-sm italic leading-relaxed text-ink-muted">
        {result.message}
      </p>
    );
  }
  if (result.status === "rate_limited") {
    return (
      <p className="px-5 py-8 text-center font-serif text-sm italic text-ink-muted">
        You&rsquo;ve asked a lot in a short while — give it a moment and try
        again.
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <p className="px-5 py-8 text-center font-serif text-sm italic text-ink-muted">
        The assistant is unavailable right now. Please try again shortly.
      </p>
    );
  }

  // status === "answered"
  const allCitations: ValidatedCitation[] = result.figures
    ? result.figures.flatMap((f) => f.citations)
    : result.citations;

  return (
    <div className="pb-4">
      <p className="whitespace-pre-wrap px-5 pt-4 font-serif text-sm leading-relaxed text-ink-soft">
        {result.answer}
      </p>
      {result.degraded && (
        <p className="px-5 pt-2 font-sans text-[10px] italic text-ink-muted/70">
          Drawn directly from Scripture.
        </p>
      )}

      {result.figures && result.figures.length > 0 ? (
        <div className="mt-3 space-y-3 px-3">
          {result.figures.map((f) => (
            <FigureCard
              key={`${f.primaryName}-${f.role}`}
              figure={f}
              added={added}
              onAdd={onAdd}
            />
          ))}
        </div>
      ) : result.citations.length > 0 ? (
        <CitedVerses
          citations={result.citations}
          added={added}
          onAdd={onAdd}
          onAddAll={() => onAddAll(allCitations)}
        />
      ) : null}
    </div>
  );
}

function FigureCard({
  figure,
  added,
  onAdd,
}: {
  figure: FigureBlock;
  added: Set<string>;
  onAdd: (c: ValidatedCitation) => void;
}) {
  return (
    <div className="rounded-xl border border-rule/60 p-3">
      <p className="font-serif text-sm text-ink">{figure.primaryName}</p>
      <p className="mt-0.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
        {figure.role}
      </p>
      <ul className="mt-2 space-y-1">
        {figure.citations.map((c) => (
          <CitationRow
            key={c.ref}
            citation={c}
            added={added.has(c.ref)}
            onAdd={() => onAdd(c)}
          />
        ))}
      </ul>
    </div>
  );
}

function CitedVerses({
  citations,
  added,
  onAdd,
  onAddAll,
}: {
  citations: ValidatedCitation[];
  added: Set<string>;
  onAdd: (c: ValidatedCitation) => void;
  onAddAll: () => void;
}) {
  const allAdded = citations.every((c) => added.has(c.ref));
  return (
    <div className="mt-4 border-t border-rule/60 px-3 pt-3">
      <div className="flex items-center justify-between px-2">
        <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          CITED VERSES
        </p>
        {citations.length > 1 && (
          <button
            type="button"
            onClick={onAddAll}
            disabled={allAdded}
            className="font-sans text-2xs text-gold transition-colors hover:text-ink disabled:text-ink-muted/50"
          >
            {allAdded ? "All added" : "Add all"}
          </button>
        )}
      </div>
      <ul className="mt-1 space-y-1">
        {citations.map((c) => (
          <CitationRow
            key={c.ref}
            citation={c}
            added={added.has(c.ref)}
            onAdd={() => onAdd(c)}
          />
        ))}
      </ul>
    </div>
  );
}

function CitationRow({
  citation,
  added,
  onAdd,
}: {
  citation: ValidatedCitation;
  added: boolean;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = citation.text.length > 110;
  return (
    <li className="group rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-rule hover:bg-parchment">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-[0.14em] text-gold">
          {citation.ref}
        </p>
        <button
          type="button"
          disabled={added}
          onClick={onAdd}
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-sans text-2xs transition-all ${
            added
              ? "border-gold/40 text-gold/60"
              : "border-rule text-ink-muted opacity-0 hover:border-gold hover:text-gold focus-visible:opacity-100 group-hover:opacity-100"
          }`}
        >
          {added ? "Added ✓" : "+ Add to canvas"}
        </button>
      </div>
      <p
        className={`mt-1 font-serif text-xs leading-relaxed text-ink-soft ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {citation.text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-0.5 font-sans text-2xs tracking-wide text-gold transition-colors hover:text-ink"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </li>
  );
}
