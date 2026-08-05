"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { getTheme } from "@/lib/themes";
import { track } from "@/lib/analytics";
import {
  buildLibraryIndex,
  emptyFacts,
  type LibraryIndex,
  type SearchHit,
} from "@/lib/library/facts";
import {
  MAX_TAGS_PER_CANVAS,
  SUGGESTED_TAGS,
  type CanvasEntry,
} from "@/lib/library/model";
import {
  BOOK_ORDER,
  bookByCode,
  DIVISIONS,
  shortBookName,
} from "@/lib/library/canon";
import LibraryCard, { relativeTime } from "./LibraryCard";

/**
 * The Library — one zoom level above the root canvas.
 *
 * Studies are shelved by hand along one axis (a shelf is where a study lives),
 * tagged along another (what kind of thing it is), and cross-indexed by
 * scripture along a third that nobody has to maintain — the books come off the
 * verse bubbles themselves.
 *
 * Nothing here is a modal: the canvas stays mounted behind the parchment, so
 * the camera can pull back into the Library and grow back out of it.
 */

type Sort = "opened" | "name" | "size" | "canon";
/** A shelf selection: the three built-ins, or a shelf id. */
type ShelfKey = "all" | "pinned" | "archive" | (string & {});

const SORTS: { id: Sort; label: string }[] = [
  { id: "opened", label: "Recent" },
  { id: "name", label: "A–Z" },
  { id: "size", label: "Largest" },
  { id: "canon", label: "Canon order" },
];

export default function Library() {
  const open = useCanvasStore((s) => s.libraryOpen);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Keep the screen mounted through its exit animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <LibraryScreen
      leaving={leaving}
      onLeave={() => setLeaving(true)}
      onLeft={() => setMounted(false)}
    />
  );
}

function LibraryScreen({
  leaving,
  onLeave,
  onLeft,
}: {
  leaving: boolean;
  onLeave: () => void;
  onLeft: () => void;
}) {
  const canvases = useCanvasStore((s) => s.canvases);
  const shelves = useCanvasStore((s) => s.shelves);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const colorTheme = useCanvasStore((s) => s.colorTheme);
  const closeLibrary = useCanvasStore((s) => s.closeLibrary);
  const switchCanvas = useCanvasStore((s) => s.switchCanvas);
  const createCanvas = useCanvasStore((s) => s.createCanvas);
  const createShelf = useCanvasStore((s) => s.createShelf);
  const setCanvasShelf = useCanvasStore((s) => s.setCanvasShelf);
  const setCanvasPinned = useCanvasStore((s) => s.setCanvasPinned);
  const renameCanvas = useCanvasStore((s) => s.renameCanvas);
  const groupSessionId = useCanvasStore((s) => s.groupSession?.groupId);
  const reducedMotion = usePrefersReducedMotion();
  const theme = getTheme(colorTheme);

  const [view, setView] = useState<"shelves" | "canon">("shelves");
  const [shelfKey, setShelfKey] = useState<ShelfKey>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("opened");
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [menuFor, setMenuFor] = useState<{ id: string; rect: DOMRect } | null>(
    null,
  );
  const [renameId, setRenameId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropShelf, setDropShelf] = useState<ShelfKey | null>(null);
  const [newShelf, setNewShelf] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  useFocusTrap(rootRef, !leaving);

  // Read the whole map tree once on entry. Nothing here is cached across
  // openings — a study edited elsewhere should show its true shape.
  useEffect(() => {
    let alive = true;
    void buildLibraryIndex(canvases.map((c) => c.id)).then((i) => {
      if (alive) setIndex(i);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Play the exit, then hand the screen back to the canvas. */
  const dismiss = useCallback(
    (openId?: string) => {
      if (leaving) return;
      onLeave();
      const finish = async () => {
        if (openId && openId !== activeCanvasId) await switchCanvas(openId);
        closeLibrary();
        onLeft();
      };
      if (reducedMotion) void finish();
      else setTimeout(() => void finish(), 240);
    },
    [
      leaving,
      onLeave,
      onLeft,
      activeCanvasId,
      switchCanvas,
      closeLibrary,
      reducedMotion,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      e.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const searchHits = useMemo<Map<string, SearchHit> | null>(() => {
    const q = query.trim();
    if (!index || q.length < 2) return null;
    return new Map(index.search(q).map((h) => [h.canvasId, h]));
  }, [index, query]);

  // Report the search once it settles, not on every keystroke.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(
      () => track("library_search", { length: query.trim().length }),
      900,
    );
    return () => clearTimeout(t);
  }, [query]);

  const factsFor = useCallback(
    (id: string) => index?.facts.get(id) ?? emptyFacts(),
    [index],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = canvases.filter((c) => {
      if (shelfKey === "archive") return !!c.archivedAt;
      if (c.archivedAt) return false;
      if (shelfKey === "pinned" && !c.pinned) return false;
      if (
        shelfKey !== "all" &&
        shelfKey !== "pinned" &&
        (c.shelfId ?? null) !== shelfKey
      )
        return false;
      if (tag && !c.tags?.includes(tag)) return false;
      if (book && !factsFor(c.id).books.includes(book)) return false;
      if (q.length >= 2) {
        // A study matches on its name OR anything written inside it.
        const byName = c.name.toLowerCase().includes(q);
        if (!byName && !searchHits?.has(c.id)) return false;
      }
      return true;
    });

    const shelfById = new Map(shelves.map((s) => [s.id, s]));
    return [...rows].sort((a, b) => {
      // Inside a sequential shelf, the series IS the order — it's the reason
      // the shelf is marked sequential at all.
      const shelf = shelfById.get(shelfKey as string);
      if (shelf?.sequential) {
        return (a.seriesIndex ?? 1e9) - (b.seriesIndex ?? 1e9);
      }
      if (sort === "opened") {
        // Pinned work floats: continuing yesterday's study is the commonest job.
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return b.openedAt - a.openedAt;
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size")
        return factsFor(b.id).bubbleCount - factsFor(a.id).bubbleCount;
      // Canon order — a study sorts by the earliest book it reaches into, so a
      // shelf reads Genesis to Revelation. Studies with no verse yet fall last.
      const ba = factsFor(a.id).books[0];
      const bb = factsFor(b.id).books[0];
      if (!ba && !bb) return a.name.localeCompare(b.name);
      if (!ba) return 1;
      if (!bb) return -1;
      return (BOOK_ORDER[ba] ?? 999) - (BOOK_ORDER[bb] ?? 999);
    });
  }, [
    canvases,
    shelves,
    shelfKey,
    tag,
    book,
    sort,
    query,
    searchHits,
    factsFor,
  ]);

  const liveCount = canvases.filter((c) => !c.archivedAt).length;
  const pinnedCount = canvases.filter((c) => c.pinned && !c.archivedAt).length;
  const archivedCount = canvases.filter((c) => !!c.archivedAt).length;

  /**
   * Only tags actually in use — a rail full of suggestions nobody has applied
   * filters to nothing. The suggestions live in the card menu, where applying
   * one is the next click.
   */
  const tagOptions = useMemo(() => {
    const used = new Set<string>();
    for (const c of canvases) for (const t of c.tags ?? []) used.add(t);
    return [...used].sort();
  }, [canvases]);

  const stageTitle =
    shelfKey === "all"
      ? "Everything"
      : shelfKey === "pinned"
        ? "Currently studying"
        : shelfKey === "archive"
          ? "Archive"
          : (shelves.find((s) => s.id === shelfKey)?.name ?? "Everything");

  const dropOnShelf = (key: ShelfKey) => {
    if (!dragId) return;
    if (key === "pinned") setCanvasPinned(dragId, true);
    else if (key === "all") setCanvasShelf(dragId, null);
    else if (key !== "archive") {
      setCanvasShelf(dragId, key);
      track("canvas_shelved", {});
    }
    setDragId(null);
    setDropShelf(null);
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Your library"
      className={`fixed inset-0 z-[60] flex flex-col bg-parchment/95 backdrop-blur-xl ${
        leaving ? "library-out" : "library-in"
      }`}
    >
      {/* ---- masthead ---- */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-rule px-4 py-3 md:px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-md text-ink">Library</span>
          <span className="font-sans text-2xs tracking-greek text-gold">
            ΟΔΟΣ
          </span>
        </div>

        <label className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full border border-rule bg-parchment px-3 py-1.5 focus-within:border-gold md:ml-6 md:max-w-md">
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="6"
              cy="6"
              r="4.4"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-ink-muted"
            />
            <path
              d="M9.4 9.4 12.5 12.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              className="text-ink-muted"
            />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search names, notes, and verses"
            aria-label="Search your studies"
            className="min-w-0 flex-1 bg-transparent font-sans text-xs text-ink outline-none placeholder:text-ink-muted"
          />
        </label>

        <div
          role="group"
          aria-label="Library view"
          className="flex gap-0.5 rounded-full bg-parchment-2 p-0.5"
        >
          {(["shelves", "canon"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setBook(null);
              }}
              aria-pressed={view === v}
              className={`rounded-full px-3 py-1.5 font-sans text-2xs tracking-eyebrow transition-colors ${
                view === v
                  ? "bg-parchment text-ink shadow-sm shadow-ink/10"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {v === "shelves" ? "SHELVES" : "BY BOOK"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Back to the canvas"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-ink-muted transition-colors hover:border-gold hover:text-gold"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 2 12 12M12 2 2 12"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- shelf rail ---- */}
        <nav
          aria-label="Shelves"
          className="hidden w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-rule bg-parchment-2/40 px-2 py-4 md:flex"
        >
          <div className="flex flex-col">
            <RailButton
              label="Everything"
              count={liveCount}
              active={shelfKey === "all"}
              dropping={dropShelf === "all"}
              onClick={() => setShelfKey("all")}
              onDropCanvas={() => dropOnShelf("all")}
              onDragOver={() => setDropShelf("all")}
              onDragLeave={() => setDropShelf(null)}
              draggingId={dragId}
            />
            <RailButton
              label="Currently studying"
              count={pinnedCount}
              active={shelfKey === "pinned"}
              dropping={dropShelf === "pinned"}
              onClick={() => setShelfKey("pinned")}
              onDropCanvas={() => dropOnShelf("pinned")}
              onDragOver={() => setDropShelf("pinned")}
              onDragLeave={() => setDropShelf(null)}
              draggingId={dragId}
            />
            {archivedCount > 0 && (
              <RailButton
                label="Archive"
                count={archivedCount}
                active={shelfKey === "archive"}
                onClick={() => setShelfKey("archive")}
                draggingId={null}
              />
            )}
          </div>

          <div className="flex flex-col">
            <p className="px-2 pb-1 font-sans text-2xs tracking-eyebrow text-ink-muted">
              SHELVES
            </p>
            {shelves.map((s) => (
              <RailButton
                key={s.id}
                label={s.name}
                count={
                  canvases.filter((c) => c.shelfId === s.id && !c.archivedAt)
                    .length
                }
                active={shelfKey === s.id}
                dropping={dropShelf === s.id}
                onClick={() => setShelfKey(s.id)}
                onDropCanvas={() => dropOnShelf(s.id)}
                onDragOver={() => setDropShelf(s.id)}
                onDragLeave={() => setDropShelf(null)}
                draggingId={dragId}
              />
            ))}
            {newShelf ? (
              <input
                autoFocus
                placeholder="Shelf name"
                onBlur={(e) => {
                  if (e.target.value.trim()) createShelf(e.target.value);
                  setNewShelf(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value;
                    if (v.trim()) setShelfKey(createShelf(v));
                    setNewShelf(false);
                  } else if (e.key === "Escape") setNewShelf(false);
                }}
                className="mx-2 mt-1 rounded-md border border-gold bg-parchment px-2 py-1 font-sans text-xs text-ink outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setNewShelf(true)}
                className="mx-2 mt-1 rounded-md border border-dashed border-rule px-2 py-1 text-left font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
              >
                + New shelf
              </button>
            )}
          </div>

          {tagOptions.length > 0 && (
            <div className="flex flex-col">
              <p className="px-2 pb-1 font-sans text-2xs tracking-eyebrow text-ink-muted">
                TAGS
              </p>
              <div className="flex flex-wrap gap-1 px-2">
                {tagOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tag === t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={`rounded-full border px-2 py-0.5 font-sans text-[11px] transition-colors ${
                      tag === t
                        ? "border-gold bg-gold/10 text-ink"
                        : "border-rule text-ink-muted hover:border-gold hover:text-ink"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ---- stage ---- */}
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-ink">
                {book ? (bookByCode(book)?.name ?? book) : stageTitle}
              </h2>
              <p className="font-sans text-2xs text-ink-muted">
                {visible.length} {visible.length === 1 ? "study" : "studies"}
                {book ? " touch this book" : ""}
                {tag ? ` · tagged ${tag}` : ""}
                {query.trim().length >= 2
                  ? ` · matching “${query.trim()}”`
                  : ""}
              </p>
            </div>
            <div
              role="group"
              aria-label="Sort"
              className="flex gap-3 font-sans text-2xs tracking-eyebrow"
            >
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sort === s.id}
                  onClick={() => setSort(s.id)}
                  className={`transition-colors ${
                    sort === s.id
                      ? "border-b border-gold text-gold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {s.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {view === "canon" && (
            <CanonIndex
              index={index}
              selected={book}
              onSelect={(code) => {
                setBook(book === code ? null : code);
                setShelfKey("all");
              }}
            />
          )}

          {!index ? (
            <p className="py-16 text-center font-serif text-md italic text-ink-muted">
              Gathering your studies…
            </p>
          ) : visible.length === 0 ? (
            <EmptyStage
              searching={query.trim().length >= 2}
              onClear={() => {
                setQuery("");
                setTag(null);
                setBook(null);
                setShelfKey("all");
              }}
              onNew={() => {
                const id = createCanvas(
                  shelfKey !== "all" &&
                    shelfKey !== "pinned" &&
                    shelfKey !== "archive"
                    ? shelfKey
                    : null,
                );
                dismiss(id);
              }}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3">
              {visible.map((c) => (
                <LibraryCard
                  key={c.id}
                  entry={c}
                  facts={factsFor(c.id)}
                  theme={theme}
                  shelf={shelves.find((s) => s.id === c.shelfId) ?? null}
                  isActive={c.id === activeCanvasId}
                  isGroup={c.id === groupSessionId}
                  searchExcerpt={
                    searchHits?.get(c.id)
                      ? {
                          text: searchHits.get(c.id)!.excerpt,
                          count: searchHits.get(c.id)!.count,
                          fromScripture: searchHits.get(c.id)!.fromScripture,
                        }
                      : undefined
                  }
                  startRename={renameId === c.id}
                  onOpen={() => dismiss(c.id)}
                  onRename={(name) => {
                    renameCanvas(c.id, name);
                    setRenameId(null);
                  }}
                  onTogglePin={() => setCanvasPinned(c.id, !c.pinned)}
                  onMenu={(rect) => setMenuFor({ id: c.id, rect })}
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropShelf(null);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  const id = createCanvas(
                    shelfKey !== "all" &&
                      shelfKey !== "pinned" &&
                      shelfKey !== "archive"
                      ? shelfKey
                      : null,
                  );
                  dismiss(id);
                }}
                className="flex min-h-[10rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-rule text-ink-muted transition-colors hover:border-gold hover:text-gold"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  +
                </span>
                <span className="font-sans text-2xs">New study</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {menuFor && (
        <CardMenu
          entry={canvases.find((c) => c.id === menuFor.id)!}
          rect={menuFor.rect}
          onRename={() => setRenameId(menuFor.id)}
          onClose={() => setMenuFor(null)}
        />
      )}
    </div>
  );
}

function RailButton({
  label,
  count,
  active,
  dropping,
  draggingId,
  onClick,
  onDropCanvas,
  onDragOver,
  onDragLeave,
}: {
  label: string;
  count: number;
  active: boolean;
  dropping?: boolean;
  draggingId: string | null;
  onClick: () => void;
  onDropCanvas?: () => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
}) {
  const droppable = !!onDropCanvas && !!draggingId;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      onDragOver={
        droppable
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onDragOver?.();
            }
          : undefined
      }
      onDragLeave={droppable ? onDragLeave : undefined}
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault();
              onDropCanvas?.();
            }
          : undefined
      }
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-xs transition-colors ${
        dropping
          ? "bg-gold/15 text-ink ring-1 ring-gold"
          : active
            ? "bg-gold/10 font-medium text-ink"
            : "text-ink-soft hover:bg-gold/[0.07] hover:text-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-gold" : "bg-rule"}`}
      />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 font-sans text-[11px] tabular-nums text-ink-muted">
        {count}
      </span>
    </button>
  );
}

/**
 * Genesis to Revelation, grouped the way a reader thinks of it. Every count is
 * derived — a book lights up because a study placed a verse from it, not
 * because anyone tagged anything.
 */
function CanonIndex({
  index,
  selected,
  onSelect,
}: {
  index: LibraryIndex | null;
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  if (!index) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-rule pb-5">
      {DIVISIONS.map((d) => (
        <div key={d.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-xs text-ink">{d.name}</h3>
            <span className="font-sans text-[10px] tracking-eyebrow text-ink-muted">
              {d.era.toUpperCase()}
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-rule" />
          </div>
          <div className="flex flex-wrap gap-1">
            {d.books.map((b) => {
              const n = index.canvasesByBook.get(b.code)?.size ?? 0;
              return (
                <button
                  key={b.code}
                  type="button"
                  title={b.name}
                  aria-pressed={selected === b.code}
                  onClick={() => n && onSelect(b.code)}
                  disabled={!n}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-sans text-[11px] transition-colors ${
                    selected === b.code
                      ? "border-gold bg-gold/15 text-ink"
                      : n
                        ? "border-gold-soft/50 text-ink hover:border-gold"
                        : "border-rule text-ink-muted/50"
                  }`}
                >
                  {shortBookName(b.code)}
                  {n > 0 && (
                    <span className="rounded-full bg-gold/20 px-1 text-[10px] tabular-nums text-ink-soft">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyStage({
  searching,
  onClear,
  onNew,
}: {
  searching: boolean;
  onClear: () => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-serif text-md italic text-ink-muted">
        {searching ? "Nothing here matches that." : "This shelf is empty."}
      </p>
      <div className="flex gap-3 font-sans text-2xs tracking-eyebrow">
        {searching && (
          <button
            type="button"
            onClick={onClear}
            className="text-gold transition-colors hover:text-ink"
          >
            CLEAR FILTERS
          </button>
        )}
        <button
          type="button"
          onClick={onNew}
          className="text-gold transition-colors hover:text-ink"
        >
          START A STUDY
        </button>
      </div>
    </div>
  );
}

/**
 * Per-card options. One flat panel rather than nested submenus — every choice
 * here is one click deep, and shelving is the common one.
 */
function CardMenu({
  entry,
  rect,
  onRename,
  onClose,
}: {
  entry: CanvasEntry;
  rect: DOMRect;
  onRename: () => void;
  onClose: () => void;
}) {
  const shelves = useCanvasStore((s) => s.shelves);
  const canvases = useCanvasStore((s) => s.canvases);
  const setCanvasShelf = useCanvasStore((s) => s.setCanvasShelf);
  const toggleCanvasTag = useCanvasStore((s) => s.toggleCanvasTag);
  const setCanvasArchived = useCanvasStore((s) => s.setCanvasArchived);
  const deleteCanvas = useCanvasStore((s) => s.deleteCanvas);
  const ref = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTag, setNewTag] = useState(false);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const usedTags = new Set<string>();
  for (const c of canvases) for (const t of c.tags ?? []) usedTags.add(t);
  // This study's own tags lead, so they're never pushed out of the list by a
  // vocabulary that has grown past it; then everything else in the library,
  // then the suggestions as a starting point.
  const tagChoices = [
    ...new Set([...(entry.tags ?? []), ...usedTags, ...SUGGESTED_TAGS]),
  ].slice(0, 14);
  const atTagCap = (entry.tags?.length ?? 0) >= MAX_TAGS_PER_CANVAS;

  /** Tag as typed — the store trims, lowercases and caps it. */
  const addTag = (value: string) => {
    const clean = value.trim();
    if (clean && !entry.tags?.includes(clean.toLowerCase()))
      toggleCanvasTag(entry.id, clean);
    setNewTag(false);
  };

  const width = 224;
  const left = Math.min(
    rect.left - width + rect.width,
    window.innerWidth - width - 12,
  );
  const top = Math.min(rect.bottom + 6, window.innerHeight - 390);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Options for ${entry.name}`}
      style={{ left: Math.max(12, left), top: Math.max(12, top), width }}
      className="fixed z-[70] animate-fade-up rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/15"
    >
      <p className="px-3 pb-1 font-sans text-2xs tracking-eyebrow text-ink-muted">
        SHELF
      </p>
      <div className="max-h-32 overflow-y-auto">
        <MenuRow
          checked={!entry.shelfId}
          onClick={() => setCanvasShelf(entry.id, null)}
        >
          Unshelved
        </MenuRow>
        {shelves.map((s) => (
          <MenuRow
            key={s.id}
            checked={entry.shelfId === s.id}
            onClick={() => setCanvasShelf(entry.id, s.id)}
          >
            {s.name}
          </MenuRow>
        ))}
      </div>

      <div className="mx-3 my-1.5 h-px bg-rule/70" aria-hidden="true" />
      <p className="px-3 pb-1 font-sans text-2xs tracking-eyebrow text-ink-muted">
        TAGS
      </p>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto px-3 pb-1.5">
        {tagChoices.map((t) => {
          const on = entry.tags?.includes(t);
          return (
            <button
              key={t}
              type="button"
              disabled={!on && atTagCap}
              onClick={() => toggleCanvasTag(entry.id, t)}
              className={`rounded-full border px-1.5 py-0.5 font-sans text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? "border-gold bg-gold/15 text-ink"
                  : "border-rule text-ink-muted hover:border-gold hover:text-ink"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      {/* Outside the scroller — inventing a tag shouldn't be something you
          have to scroll a grown vocabulary to find. */}
      <div className="px-3 pb-1.5">
        {newTag ? (
          <input
            autoFocus
            maxLength={32}
            placeholder="New tag"
            onBlur={(e) => addTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                addTag((e.target as HTMLInputElement).value);
              else if (e.key === "Escape") {
                e.stopPropagation();
                setNewTag(false);
              }
            }}
            className="w-28 rounded-full border border-gold bg-parchment px-1.5 py-0.5 font-sans text-[10px] text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            disabled={atTagCap}
            onClick={() => setNewTag(true)}
            className="rounded-full border border-dashed border-rule px-1.5 py-0.5 font-sans text-[10px] text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            + New tag
          </button>
        )}
      </div>
      {atTagCap && (
        <p className="px-3 pb-1 font-sans text-[10px] text-ink-muted/70">
          {MAX_TAGS_PER_CANVAS} tags is the limit — turn one off to add another.
        </p>
      )}

      <div className="mx-3 my-1.5 h-px bg-rule/70" aria-hidden="true" />
      <MenuRow
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename…
      </MenuRow>
      <MenuRow
        onClick={() => {
          setCanvasArchived(entry.id, !entry.archivedAt);
          onClose();
        }}
      >
        {entry.archivedAt ? "Restore from archive" : "Archive this study"}
      </MenuRow>
      {confirmDelete ? (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="font-sans text-2xs text-ink-muted">
            Delete for good?
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void deleteCanvas(entry.id);
                onClose();
              }}
              className="font-sans text-2xs font-medium text-danger transition-colors hover:text-ink"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="font-sans text-2xs text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </span>
        </div>
      ) : (
        <MenuRow danger onClick={() => setConfirmDelete(true)}>
          Delete permanently
        </MenuRow>
      )}
      <p className="px-3 pb-1 pt-1 font-sans text-[10px] leading-snug text-ink-muted/70">
        Archiving keeps everything. Opened {relativeTime(entry.openedAt)}.
      </p>
    </div>
  );
}

function MenuRow({
  children,
  checked,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  checked?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-sans text-xs transition-colors hover:bg-parchment-2 ${
        danger ? "text-danger hover:text-ink" : "text-ink-soft hover:text-ink"
      }`}
    >
      {checked !== undefined && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${checked ? "bg-gold" : "bg-rule"}`}
        />
      )}
      <span className="truncate">{children}</span>
    </button>
  );
}
