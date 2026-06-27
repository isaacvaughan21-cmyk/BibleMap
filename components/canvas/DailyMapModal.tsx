"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DailyMapView from "@/components/daily/DailyMapView";
import { fetchTodaysMap, type DailyMap } from "@/lib/daily-map";
import { importDailyMapAsCanvas } from "@/lib/daily-map-import";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * In-app "Map of the Day" — the same daily study map the public page shows,
 * surfaced inside the canvas. "Save to my canvas" copies it in as a new canvas
 * and slides to it (no page navigation, unlike the public page's button).
 */
export default function DailyMapModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  const [map, setMap] = useState<DailyMap | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const rehydrate = useCanvasStore((s) => s.rehydrate);
  const requestCanvas = useCanvasStore((s) => s.requestCanvas);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState("loading");
    setMap(null);
    fetchTodaysMap()
      .then((m) => {
        if (!alive) return;
        if (m) {
          setMap(m);
          setState("ready");
        } else {
          setState("error");
        }
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const anchorNode = map?.nodes.find((n) => n.id === "anchor");

  const save = async () => {
    if (!map || saving) return;
    setSaving(true);
    try {
      const id = await importDailyMapAsCanvas(map, { activate: false });
      await rehydrate();
      requestCanvas(id);
      onSaved(map.title);
      onClose();
    } catch (err) {
      console.error("hodos: failed to save daily map", err);
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Map of the Day"
      onKeyDown={(e) => e.stopPropagation()}
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
        className="relative flex max-h-[88vh] w-[min(720px,100%)] flex-col overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/20"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule/70 px-6 py-4">
          <div>
            <p className="font-sans text-2xs tracking-eyebrow text-gold">
              MAP OF THE DAY
            </p>
            <h2 className="mt-1 font-serif text-lg leading-snug text-ink">
              {map ? map.title : "Today’s study map"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-rule p-1.5 text-ink-muted transition-colors hover:border-gold hover:text-gold"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state === "loading" && (
            <p className="py-16 text-center font-serif text-sm italic text-ink-muted">
              Loading today’s map…
            </p>
          )}
          {state === "error" && (
            <p className="py-16 text-center font-serif text-sm italic text-ink-muted">
              Couldn’t load today’s map. Please try again shortly.
            </p>
          )}
          {state === "ready" && map && (
            <>
              {anchorNode?.verseRef && (
                <blockquote className="border-l-2 border-gold/60 pl-4">
                  <p className="font-serif text-sm italic leading-relaxed text-ink-soft">
                    &ldquo;{anchorNode.verseText}&rdquo;
                  </p>
                  <cite className="mt-1.5 block font-mono text-2xs font-medium uppercase not-italic tracking-[0.14em] text-gold">
                    {anchorNode.verseRef} · {map.version}
                  </cite>
                </blockquote>
              )}
              <p className="mt-4 font-serif text-md leading-relaxed text-ink">
                {map.question}
              </p>
              <div className="mt-5 h-[360px] overflow-hidden rounded-xl border border-rule bg-parchment">
                <DailyMapView map={map} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-rule/70 px-6 py-4">
          <Link
            href="/map-of-the-day"
            target="_blank"
            className="font-sans text-2xs tracking-eyebrow text-ink-muted transition-colors hover:text-gold"
          >
            OPEN FULL PAGE ↗
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Close
            </button>
            <button
              type="button"
              onClick={save}
              disabled={state !== "ready" || saving}
              className="rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to my canvas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
