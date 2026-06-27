"use client";

import { useEffect, useRef, useState } from "react";
import { BOOKS, type BibleBook } from "@/lib/bible-books";
import {
  formatRange,
  formatRef,
  getPassageText,
  getVerseByParsed,
  loadChapter,
  parseRef,
  type ParsedRef,
} from "@/lib/bible";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { versionCredit } from "@/lib/versions";

/**
 * Verse picker — book grid → chapter grid → verse list, with a free-text
 * field ("John 3:16") that resolves fuzzily. Fills the target VerseNode with
 * the BSB text (denormalized for offline). Verses can be picked one at a time
 * or, in Range mode, as a sequential span (first verse, then last).
 */
export default function VersePicker({
  nodeId,
  onClose,
  onCommit,
}: {
  /** Existing verse node to fill. Omit when using `onCommit` to capture a pick. */
  nodeId?: string;
  onClose: () => void;
  /**
   * When provided, the chosen verse is handed back here instead of being
   * written to a node — lets the notes view create a fresh bubble from the pick.
   */
  onCommit?: (data: { verseRef: string; verseText: string }) => void;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const bibleVersion = useCanvasStore((s) => s.bibleVersion);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const [query, setQuery] = useState("");
  const [book, setBook] = useState<BibleBook | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<string[] | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [committing, setCommitting] = useState(false);
  // "grid" = a number grid for clicking a verse you already know by number
  // (the default — fastest path); "read" = the full text, scroll to find it.
  const [verseView, setVerseView] = useState<"grid" | "read">("grid");
  // Range mode lets you pick a sequential span: click the first verse, then
  // the last. `rangeStart` holds the first pick; `hoverVerse` previews the span.
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [hoverVerse, setHoverVerse] = useState<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A fresh book/chapter resets any in-progress range pick.
  useEffect(() => {
    setRangeStart(null);
    setHoverVerse(null);
  }, [book, chapter]);

  // Load verse counts when a chapter list is needed
  useEffect(() => {
    if (!book || chapter === null) return;
    let cancelled = false;
    setLoadState("loading");
    loadChapter(book.code, chapter, bibleVersion)
      .then((data) => {
        if (cancelled) return;
        setVerses(data);
        setLoadState("idle");
      })
      .catch(() => !cancelled && setLoadState("error"));
    return () => {
      cancelled = true;
    };
  }, [book, chapter, bibleVersion]);

  // Write the chosen verse to its destination — an existing node, or back to
  // the caller via onCommit (the notes add-flow creates a fresh bubble from it).
  const deliver = (data: { verseRef: string; verseText: string }) => {
    if (onCommit) onCommit(data);
    else if (nodeId) updateNodeData(nodeId, data);
  };

  const commit = async (ref: ParsedRef) => {
    setCommitting(true);
    try {
      const { text } = await getVerseByParsed(ref, bibleVersion);
      deliver({ verseRef: formatRef(ref), verseText: text });
      onClose();
    } catch {
      setLoadState("error");
      setCommitting(false);
    }
  };

  const commitRange = async (
    bk: BibleBook,
    ch: number,
    a0: number,
    b0: number,
  ) => {
    const a = Math.min(a0, b0);
    const b = Math.max(a0, b0);
    if (a === b) {
      commit({ book: bk, chapter: ch, verse: a });
      return;
    }
    setCommitting(true);
    try {
      const start: ParsedRef = { book: bk, chapter: ch, verse: a };
      const end: ParsedRef = { book: bk, chapter: ch, verse: b };
      const text = await getPassageText(start, end, bibleVersion);
      deliver({ verseRef: formatRange({ start, end }), verseText: text });
      onClose();
    } catch {
      setLoadState("error");
      setCommitting(false);
    }
  };

  // Click handler for a verse cell/row, honouring Single vs Range mode.
  const pickVerse = (n: number) => {
    if (committing || !book || chapter === null) return;
    if (!rangeMode) {
      commit({ book, chapter, verse: n });
      return;
    }
    if (rangeStart === null) {
      setRangeStart(n);
      setHoverVerse(null);
      return;
    }
    commitRange(book, chapter, rangeStart, n);
  };

  const isRangeStart = (n: number) => rangeMode && rangeStart === n;
  const inProvisionalRange = (n: number) => {
    if (!rangeMode || rangeStart === null) return false;
    const hi = hoverVerse ?? rangeStart;
    return n >= Math.min(rangeStart, hi) && n <= Math.max(rangeStart, hi);
  };

  const parsed = parseRef(query);

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a verse"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close verse picker"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        className="relative mx-auto mt-[12vh] w-[min(560px,calc(100%-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/20"
      >
        {/* Free-text reference */}
        <div className="flex items-center gap-3 border-b border-rule/70 px-5 py-4">
          <span
            className="h-4 w-[3px] shrink-0 rounded-sm bg-gold"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsed && !committing) commit(parsed);
            }}
            placeholder="Type a reference — John 3:16"
            className="w-full bg-transparent font-serif text-md text-ink placeholder:text-ink-muted/60 focus:outline-none"
            aria-label="Verse reference"
          />
          {parsed && (
            <button
              type="button"
              onClick={() => commit(parsed)}
              disabled={committing}
              className="shrink-0 rounded-full bg-gold px-4 py-1.5 font-sans text-2xs font-medium text-parchment shadow-md shadow-gold/20 transition-all hover:bg-ink disabled:opacity-60"
            >
              {committing ? "Adding…" : `Add ${formatRef(parsed)}`}
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-5 pt-3 font-sans text-2xs text-ink-muted">
          <Crumb
            label="BOOKS"
            active={!book}
            onClick={() => {
              setBook(null);
              setChapter(null);
            }}
          />
          {book && (
            <>
              <span aria-hidden="true">/</span>
              <Crumb
                label={book.name.toUpperCase()}
                active={chapter === null}
                onClick={() => setChapter(null)}
              />
            </>
          )}
          {book && chapter !== null && (
            <>
              <span aria-hidden="true">/</span>
              <Crumb label={`CHAPTER ${chapter}`} active onClick={() => {}} />
            </>
          )}
        </div>

        <div className="max-h-[48vh] overflow-y-auto px-5 pb-5 pt-3">
          {!book && (
            <>
              <BookGrid
                label="OLD TESTAMENT"
                books={BOOKS.filter((b) => b.testament === "OT")}
                onPick={setBook}
              />
              <BookGrid
                label="NEW TESTAMENT"
                books={BOOKS.filter((b) => b.testament === "NT")}
                onPick={setBook}
              />
            </>
          )}

          {book && chapter === null && (
            <div className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: book.chapters }, (_, i) => (
                <GridCell key={i} onClick={() => setChapter(i + 1)}>
                  {i + 1}
                </GridCell>
              ))}
            </div>
          )}

          {book && chapter !== null && loadState === "loading" && (
            <p className="py-6 text-center font-serif text-sm italic text-ink-muted">
              Opening {book.name}…
            </p>
          )}

          {book && chapter !== null && loadState === "error" && (
            <div className="py-6 text-center">
              <p className="font-serif text-sm italic text-ink-muted">
                Couldn&rsquo;t load {book.name}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoadState("loading");
                  loadChapter(book.code, chapter, bibleVersion)
                    .then((d) => {
                      setVerses(d);
                      setLoadState("idle");
                    })
                    .catch(() => setLoadState("error"));
                }}
                className="mt-2 rounded-full border border-rule px-4 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
              >
                Try again
              </button>
            </div>
          )}

          {book && chapter !== null && loadState === "idle" && verses && (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                {/* Single vs sequential-range selection */}
                <div className="flex shrink-0 gap-0.5 rounded-full border border-rule p-0.5">
                  <ViewToggle
                    active={!rangeMode}
                    onClick={() => {
                      setRangeMode(false);
                      setRangeStart(null);
                    }}
                  >
                    Single
                  </ViewToggle>
                  <ViewToggle
                    active={rangeMode}
                    onClick={() => {
                      setRangeMode(true);
                      setRangeStart(null);
                    }}
                  >
                    Range
                  </ViewToggle>
                </div>
                {/* Number grid (default) vs full reading view */}
                <div className="flex shrink-0 gap-0.5 rounded-full border border-rule p-0.5">
                  <ViewToggle
                    active={verseView === "grid"}
                    onClick={() => setVerseView("grid")}
                  >
                    Numbers
                  </ViewToggle>
                  <ViewToggle
                    active={verseView === "read"}
                    onClick={() => setVerseView("read")}
                  >
                    Read
                  </ViewToggle>
                </div>
              </div>

              {rangeMode && (
                <p className="mb-2 font-sans text-2xs text-ink-muted">
                  {rangeStart === null ? (
                    "Pick the first verse of the range."
                  ) : (
                    <>
                      First verse{" "}
                      <span className="font-mono text-gold">{rangeStart}</span>{" "}
                      — now pick the last verse.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setRangeStart(null);
                          setHoverVerse(null);
                        }}
                        className="text-gold underline-offset-2 hover:text-ink hover:underline"
                      >
                        reset
                      </button>
                    </>
                  )}
                </p>
              )}

              {verseView === "grid" ? (
                <div
                  className="grid grid-cols-8 gap-1.5"
                  onMouseLeave={
                    rangeMode ? () => setHoverVerse(null) : undefined
                  }
                >
                  {verses.map((_, i) => {
                    const n = i + 1;
                    return (
                      <GridCell
                        key={i}
                        active={isRangeStart(n) || inProvisionalRange(n)}
                        onMouseEnter={
                          rangeMode && rangeStart !== null
                            ? () => setHoverVerse(n)
                            : undefined
                        }
                        onClick={() => pickVerse(n)}
                      >
                        {n}
                      </GridCell>
                    );
                  })}
                </div>
              ) : (
                <ul
                  className="space-y-0.5"
                  onMouseLeave={
                    rangeMode ? () => setHoverVerse(null) : undefined
                  }
                >
                  {verses.map((text, i) => {
                    const n = i + 1;
                    const on = isRangeStart(n) || inProvisionalRange(n);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onMouseEnter={
                            rangeMode && rangeStart !== null
                              ? () => setHoverVerse(n)
                              : undefined
                          }
                          onClick={() => pickVerse(n)}
                          className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            on ? "bg-gold/15" : "hover:bg-gold/10"
                          }`}
                        >
                          <span
                            className={`shrink-0 font-mono text-2xs ${
                              on ? "text-ink" : "text-gold"
                            }`}
                          >
                            {n}
                          </span>
                          <span className="font-serif text-sm leading-relaxed text-ink-soft">
                            {text}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {versionCredit(bibleVersion) && (
                <p className="mt-3 border-t border-rule/50 pt-2 font-sans text-[9px] leading-snug text-ink-muted/70">
                  {versionCredit(bibleVersion)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Crumb({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tracking-eyebrow transition-colors ${
        active ? "text-gold" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ViewToggle({
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

function BookGrid({
  label,
  books,
  onPick,
}: {
  label: string;
  books: BibleBook[];
  onPick: (b: BibleBook) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 font-sans text-2xs tracking-eyebrow text-ink-muted">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {books.map((b) => (
          <button
            key={b.code}
            type="button"
            onClick={() => onPick(b)}
            title={b.name}
            className="flex items-baseline gap-2 rounded-lg border border-rule bg-parchment px-2.5 py-1.5 text-left transition-colors hover:border-gold hover:bg-gold/10"
          >
            <span className="w-8 shrink-0 font-mono text-[10px] uppercase tracking-wide text-gold/70">
              {b.code}
            </span>
            <span className="min-w-0 truncate font-serif text-sm text-ink-soft">
              {b.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GridCell({
  onClick,
  onMouseEnter,
  title,
  active,
  children,
}: {
  onClick: () => void;
  onMouseEnter?: () => void;
  title?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      title={title}
      className={`rounded-lg border px-1 py-1.5 text-center font-mono text-2xs transition-colors ${
        active
          ? "border-gold bg-gold/20 text-ink"
          : "border-rule bg-parchment text-ink-soft hover:border-gold hover:bg-gold/10 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
