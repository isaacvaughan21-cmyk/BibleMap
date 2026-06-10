"use client";

import { useEffect, useState } from "react";
import {
  formatRef,
  getPassageText,
  getVerseByParsed,
  parseRef,
} from "@/lib/bible";
import { formatCrossRef, getCrossRefs, type CrossRef } from "@/lib/crossrefs";
import { useCanvasStore } from "@/lib/store/canvas-store";
import type { VerseNodeType } from "@/lib/types";

/**
 * Contextual cross-reference panel — fills the study rail when a verse
 * bubble is selected. "Add to canvas" spawns a connected VerseNode with a
 * gold dashed crossref edge.
 */
export default function CrossRefPanel({ node }: { node: VerseNodeType }) {
  const addVerseWithCrossRef = useCanvasStore((s) => s.addVerseWithCrossRef);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error" }
    | { phase: "ready"; refs: CrossRef[] }
  >({ phase: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const parsed = parseRef(node.data.verseRef);

  useEffect(() => {
    if (!parsed) return;
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

  if (!parsed) {
    return (
      <PanelShell verseRef={node.data.verseRef || "—"}>
        <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
          Couldn&rsquo;t read this reference.
        </p>
      </PanelShell>
    );
  }

  return (
    <PanelShell verseRef={formatRef(parsed)}>
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

      {state.phase === "ready" && state.refs.length === 0 && (
        <p className="px-5 py-6 text-center font-serif text-sm italic text-ink-muted">
          No classical cross-references for this verse.
        </p>
      )}

      {state.phase === "ready" && state.refs.length > 0 && (
        <ul className="space-y-1 px-3 pb-3">
          {state.refs.map((r) => {
            const key = formatCrossRef(r);
            return (
              <CrossRefRow
                key={key}
                crossRef={r}
                added={addedIds.has(key)}
                onAdd={async () => {
                  const text = await getPassageText(r.target, r.targetEnd);
                  addVerseWithCrossRef(node.id, key, text);
                  setAddedIds((s) => new Set(s).add(key));
                }}
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
    </PanelShell>
  );
}

function PanelShell({
  verseRef,
  children,
}: {
  verseRef: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-4">
        <p className="font-sans text-2xs tracking-eyebrow text-ink-muted">
          CROSS-REFERENCES
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-gold">
          {verseRef}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function CrossRefRow({
  crossRef,
  added,
  onAdd,
}: {
  crossRef: CrossRef;
  added: boolean;
  onAdd: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVerseByParsed(crossRef.target)
      .then(({ text }) => !cancelled && setPreview(text))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li className="group rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-rule hover:bg-parchment">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-[0.14em] text-gold">
          {formatCrossRef(crossRef)}
        </p>
        <button
          type="button"
          disabled={added || adding}
          onClick={async () => {
            setAdding(true);
            try {
              await onAdd();
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
      <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-ink-soft">
        {failed ? (
          <span className="italic text-ink-muted">Preview unavailable</span>
        ) : (
          (preview ?? "…")
        )}
      </p>
    </li>
  );
}
