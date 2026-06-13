"use client";

import { useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import {
  formatRef,
  getChapterContext,
  getPassageText,
  getVerseByParsed,
  osisId,
  parseRef,
  type ParsedRef,
} from "@/lib/bible";
import { formatCrossRef, getCrossRefs, type CrossRef } from "@/lib/crossrefs";
import { setCrossRefDrag, useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { pronounClarifier } from "@/lib/verse-referents";
import { BIBLE_VERSIONS } from "@/lib/versions";
import type { VerseNodeType } from "@/lib/types";

/** dataTransfer marker so the canvas can tell a verse drag from a file drag. */
export const CROSSREF_DRAG_TYPE = "application/x-hodos-crossref";

type Tab = "refs" | "versions" | "context";

/**
 * The study panel for a selected verse — three tabs:
 *  • Cross-refs: TSK cross-references, draggable onto the canvas, with a
 *    curated pronoun clarifier ("He → Melchizedek") where the context is bare.
 *  • Versions: the verse across the bundled translations.
 *  • Context: the surrounding passage, focus verse highlighted.
 */
export default function CrossRefPanel({ node }: { node: VerseNodeType }) {
  const [tab, setTab] = useState<Tab>("refs");
  const parsed = parseRef(node.data.verseRef);

  // A fresh verse selection always starts on cross-refs.
  useEffect(() => {
    setTab("refs");
  }, [node.id]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-gold">
          {parsed ? formatRef(parsed) : node.data.verseRef || "—"}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Study"
        className="flex gap-4 border-b border-rule/60 px-5"
      >
        <TabButton active={tab === "refs"} onClick={() => setTab("refs")}>
          Cross-refs
        </TabButton>
        <TabButton
          active={tab === "versions"}
          onClick={() => setTab("versions")}
        >
          Versions
        </TabButton>
        <TabButton active={tab === "context"} onClick={() => setTab("context")}>
          Context
        </TabButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!parsed ? (
          <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
            Couldn&rsquo;t read this reference.
          </p>
        ) : tab === "refs" ? (
          <CrossRefsTab node={node} parsed={parsed} />
        ) : tab === "versions" ? (
          <VersionsTab parsed={parsed} />
        ) : (
          <ContextTab parsed={parsed} />
        )}
      </div>
    </div>
  );
}

function TabButton({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 py-2 font-sans text-2xs tracking-eyebrow transition-colors ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cross-references tab                                                */
/* ------------------------------------------------------------------ */
function CrossRefsTab({
  node,
  parsed,
}: {
  node: VerseNodeType;
  parsed: ParsedRef;
}) {
  const addVerseWithCrossRef = useCanvasStore((s) => s.addVerseWithCrossRef);
  const bibleVersion = useCanvasStore((s) => s.bibleVersion);
  // OSIS ids of the verses this one was cross-referenced FROM (an edge points
  // here). We hide the back-reference to those "originals" — you placed this
  // verse to study it, not to be pointed straight back where you came from.
  const originOsis = useCanvasStore(
    useShallow((s) => {
      const set = new Set<string>();
      for (const e of s.edges) {
        if (e.type !== "crossref" || e.target !== node.id) continue;
        const src = s.nodes.find((n) => n.id === e.source);
        if (src?.type === "verse") {
          const p = parseRef(src.data.verseRef);
          if (p) set.add(osisId(p));
        }
      }
      return [...set];
    }),
  );
  const { fitView } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error" }
    | { phase: "ready"; refs: CrossRef[] }
  >({ phase: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    getCrossRefs(parsed)
      .then((refs) => !cancelled && setState({ phase: "ready", refs }))
      .catch(() => !cancelled && setState({ phase: "error" }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.data.verseRef, retryToken]);

  const originSet = new Set(originOsis);
  const visibleRefs =
    state.phase === "ready"
      ? state.refs.filter((r) => !originSet.has(osisId(r.target)))
      : [];

  return (
    <>
      {state.phase === "loading" && (
        <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
          Gathering cross-references…
        </p>
      )}

      {state.phase === "error" && (
        <div className="px-5 py-6 text-center">
          <p className="font-serif text-sm italic text-ink-muted">
            Couldn&rsquo;t load the cross-reference index.
          </p>
          <button
            type="button"
            onClick={() => setRetryToken((t) => t + 1)}
            className="mt-2 rounded-full border border-rule px-4 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "ready" && visibleRefs.length === 0 && (
        <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
          No classical cross-references for this verse.
        </p>
      )}

      {state.phase === "ready" && visibleRefs.length > 0 && (
        <ul className="space-y-1 px-3 pb-3 pt-2">
          {visibleRefs.map((r) => {
            const key = formatCrossRef(r);
            return (
              <CrossRefRow
                key={key}
                crossRef={r}
                defaultVersion={bibleVersion}
                added={addedIds.has(key)}
                sourceId={node.id}
                onAdd={async (version) => {
                  const text = await getPassageText(
                    r.target,
                    r.targetEnd,
                    version,
                  );
                  const newId = addVerseWithCrossRef(node.id, key, text);
                  setAddedIds((s) => new Set(s).add(key));
                  setTimeout(() => {
                    fitView({
                      nodes: [{ id: node.id }, { id: newId }],
                      duration: reducedMotion ? 0 : 500,
                      padding: 0.4,
                      maxZoom: 1,
                    });
                  }, 90);
                }}
                onMarkAdded={() => setAddedIds((s) => new Set(s).add(key))}
              />
            );
          })}
        </ul>
      )}

      <p className="border-t border-rule/60 px-5 py-3 font-sans text-2xs leading-relaxed text-ink-muted/80">
        Cross-references: Treasury of Scripture Knowledge, via{" "}
        <a
          href="https://www.openbible.info/labs/cross-references/"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule underline-offset-2 hover:text-gold"
        >
          OpenBible.info
        </a>{" "}
        (CC-BY)
      </p>
    </>
  );
}

function CrossRefRow({
  crossRef,
  defaultVersion,
  added,
  sourceId,
  onAdd,
  onMarkAdded,
}: {
  crossRef: CrossRef;
  defaultVersion: string;
  added: boolean;
  sourceId: string;
  onAdd: (version: string) => Promise<void>;
  onMarkAdded: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // This row can be read in a translation of its own — independent of the
  // canvas-wide version. It follows the global default until the reader picks
  // one here, after which their choice for this verse sticks.
  const [version, setVersion] = useState(defaultVersion);
  const [overridden, setOverridden] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  useEffect(() => {
    if (!overridden) setVersion(defaultVersion);
  }, [defaultVersion, overridden]);
  const key = formatCrossRef(crossRef);
  // The preview is clamped to two lines; longer verses get a "more" toggle.
  const isLong = !!preview && preview.length > 100;

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setFailed(false);
    setExpanded(false);
    getVerseByParsed(crossRef.target, version)
      .then(({ text }) => !cancelled && setPreview(text))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  // Who an ambiguous pronoun points to (curated; null when not needed).
  const clar = preview
    ? pronounClarifier(formatRef(crossRef.target), preview)
    : null;

  return (
    <li
      draggable={!added}
      onDragStart={(e) => {
        if (added) return;
        e.dataTransfer.setData(CROSSREF_DRAG_TYPE, key);
        e.dataTransfer.effectAllowed = "copy";
        setCrossRefDrag({
          sourceId,
          verseRef: key,
          text: getPassageText(crossRef.target, crossRef.targetEnd, version),
        });
        onMarkAdded();
      }}
      className={`group rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-rule hover:bg-parchment ${
        added ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-[0.14em] text-gold">
          {key}
        </p>
        <button
          type="button"
          disabled={added || adding}
          onClick={async () => {
            setAdding(true);
            try {
              await onAdd(version);
            } finally {
              setAdding(false);
            }
          }}
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-sans text-2xs transition-all ${
            added
              ? "border-gold/40 text-gold/60"
              : "border-rule text-ink-muted opacity-0 hover:border-gold hover:text-gold focus-visible:opacity-100 group-hover:opacity-100"
          }`}
        >
          {added ? "Added ✓" : adding ? "Adding…" : "+ Add to canvas"}
        </button>
      </div>
      <p
        className={`mt-1 font-serif text-xs leading-relaxed text-ink-soft ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {failed ? (
          <span className="italic text-ink-muted">Preview unavailable</span>
        ) : (
          (preview ?? "…")
        )}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => !x);
          }}
          className="mt-0.5 font-sans text-2xs tracking-wide text-gold transition-colors hover:text-ink"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {clar && (
        <p className="mt-1 font-sans text-2xs italic text-gold/80">
          ({clar.pronoun} → {clar.referent})
        </p>
      )}
      {/* Read this one verse in a translation of its own. */}
      <div className="relative mt-1.5 flex items-center gap-1">
        <span className="font-sans text-[10px] text-ink-muted/70">in</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVersionOpen((o) => !o);
          }}
          aria-haspopup="listbox"
          aria-expanded={versionOpen}
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
            overridden
              ? "border-gold/50 text-gold"
              : "border-rule/70 text-ink-muted hover:border-gold hover:text-gold"
          }`}
        >
          {version} ▾
        </button>
        {versionOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                setVersionOpen(false);
              }}
            />
            <ul
              role="listbox"
              className="absolute left-7 top-5 z-20 overflow-hidden rounded-lg border border-rule bg-parchment shadow-md shadow-ink/10"
            >
              {BIBLE_VERSIONS.map((v) => (
                <li key={v.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={v.code === version}
                    onClick={(e) => {
                      e.stopPropagation();
                      setVersion(v.code);
                      setOverridden(v.code !== defaultVersion);
                      setVersionOpen(false);
                    }}
                    className={`flex w-full items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-left font-sans text-2xs transition-colors hover:bg-parchment-2 ${
                      v.code === version ? "text-ink" : "text-ink-soft"
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wide text-gold">
                      {v.code}
                    </span>
                    {v.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {!added && (
        <p className="mt-1 font-sans text-[10px] text-ink-muted/60 opacity-0 transition-opacity group-hover:opacity-100">
          Drag onto the canvas to place it anywhere
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Versions tab                                                        */
/* ------------------------------------------------------------------ */
function VersionsTab({ parsed }: { parsed: ParsedRef }) {
  // code → text (string), null = failed, undefined = still loading
  const [texts, setTexts] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    setTexts({});
    for (const v of BIBLE_VERSIONS) {
      getVerseByParsed(parsed, v.code)
        .then(
          ({ text }) =>
            !cancelled && setTexts((t) => ({ ...t, [v.code]: text })),
        )
        .catch(() => !cancelled && setTexts((t) => ({ ...t, [v.code]: null })));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.book.code, parsed.chapter, parsed.verse]);

  return (
    <ul className="space-y-4 px-5 py-4">
      {BIBLE_VERSIONS.map((v) => (
        <li key={v.code}>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-gold">
            {v.code}
            <span className="ml-1.5 font-sans normal-case tracking-normal text-ink-muted/70">
              {v.name}
            </span>
          </p>
          <p className="mt-1 font-serif text-sm leading-relaxed text-ink-soft">
            {v.code in texts ? (
              (texts[v.code] ?? (
                <span className="italic text-ink-muted">unavailable</span>
              ))
            ) : (
              <span className="text-ink-muted/50">…</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Context tab                                                         */
/* ------------------------------------------------------------------ */
function ContextTab({ parsed }: { parsed: ParsedRef }) {
  const bibleVersion = useCanvasStore((s) => s.bibleVersion);
  const [verses, setVerses] = useState<
    { verse: number; text: string; focus: boolean }[] | null
  >(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVerses(null);
    setFailed(false);
    getChapterContext(parsed, 4, bibleVersion)
      .then((v) => !cancelled && setVerses(v))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.book.code, parsed.chapter, parsed.verse, bibleVersion]);

  return (
    <div className="px-5 py-4">
      <p className="mb-2 font-sans text-2xs tracking-eyebrow text-ink-muted">
        {parsed.book.name} {parsed.chapter} · in context
      </p>
      {failed ? (
        <p className="font-serif text-sm italic text-ink-muted">
          Couldn&rsquo;t load the surrounding passage.
        </p>
      ) : !verses ? (
        <p className="font-serif text-sm italic text-ink-muted">Reading…</p>
      ) : (
        <p className="font-serif text-sm leading-relaxed text-ink-soft">
          {verses.map((v) => (
            <span
              key={v.verse}
              className={
                v.focus ? "rounded bg-gold/15 px-0.5 text-ink" : undefined
              }
            >
              <sup className="mr-0.5 font-sans text-[9px] text-gold">
                {v.verse}
              </sup>
              {v.text}{" "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
