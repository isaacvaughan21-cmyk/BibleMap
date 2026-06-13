"use client";

import { useEffect, useRef, useState } from "react";
import { BOOKS, type BibleBook } from "@/lib/bible-books";
import {
  formatRef,
  getVerseByParsed,
  loadBook,
  parseRef,
  type ParsedRef,
} from "@/lib/bible";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Verse picker — book grid → chapter grid → verse list, with a free-text
 * field ("John 3:16") that resolves fuzzily. Fills the target VerseNode with
 * the BSB text (denormalized for offline).
 */
export default function VersePicker({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
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

  // Load verse counts when a chapter list is needed
  useEffect(() => {
    if (!book || chapter === null) return;
    let cancelled = false;
    setLoadState("loading");
    loadBook(book.code, bibleVersion)
      .then((data) => {
        if (cancelled) return;
        setVerses(data.chapters[chapter - 1] ?? []);
        setLoadState("idle");
      })
      .catch(() => !cancelled && setLoadState("error"));
    return () => {
      cancelled = true;
    };
  }, [book, chapter, bibleVersion]);

  const commit = async (ref: ParsedRef) => {
    setCommitting(true);
    try {
      const { text } = await getVerseByParsed(ref, bibleVersion);
      updateNodeData(nodeId, { verseRef: formatRef(ref), verseText: text });
      onClose();
    } catch {
      setLoadState("error");
      setCommitting(false);
    }
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
                  loadBook(book.code, bibleVersion)
                    .then((d) => {
                      setVerses(d.chapters[chapter - 1] ?? []);
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
            <ul className="space-y-0.5">
              {verses.map((text, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() =>
                      !committing && commit({ book, chapter, verse: i + 1 })
                    }
                    className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gold/10"
                  >
                    <span className="shrink-0 font-mono text-2xs text-gold">
                      {i + 1}
                    </span>
                    <span className="font-serif text-sm leading-relaxed text-ink-soft">
                      {text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
      <div className="grid grid-cols-6 gap-1.5">
        {books.map((b) => (
          <GridCell key={b.code} onClick={() => onPick(b)} title={b.name}>
            {b.code}
          </GridCell>
        ))}
      </div>
    </div>
  );
}

function GridCell({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-lg border border-rule bg-parchment px-1 py-1.5 text-center font-mono text-2xs text-ink-soft transition-colors hover:border-gold hover:bg-gold/10 hover:text-ink"
    >
      {children}
    </button>
  );
}
