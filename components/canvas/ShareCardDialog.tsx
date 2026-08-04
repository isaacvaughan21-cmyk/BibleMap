"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getTheme } from "@/lib/themes";
import type { VerseNodeType } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { SHARE_FORMATS, type ShareFormat } from "@/lib/share/formats";
import {
  pickVerseNodeId,
  renderShareCard,
  shareCaption,
  shareCardBlob,
  shareFilename,
  waitForFonts,
  type ShareCardInput,
  type ShareMode,
} from "@/lib/share/render-card";

/**
 * "Share as image" — compose the study into a card built for a feed.
 *
 * Two things to share: the whole map (the shape of a study) or one verse (the
 * passage, set large, with the reader's own highlights). Both are drawn from
 * the map data rather than screenshotted, so the card is sharp at every export
 * size and carries none of the editing chrome.
 */
export default function ShareCardDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFocusTrap(panelRef, open);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const mapName = useCanvasStore((s) => s.mapName);
  const colorTheme = useCanvasStore((s) => s.colorTheme);
  const version = useCanvasStore((s) => s.bibleVersion);

  const [mode, setMode] = useState<ShareMode>("map");
  const [format, setFormat] = useState<ShareFormat>(SHARE_FORMATS[0]);
  const [verseId, setVerseId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  const verses = useMemo(
    () =>
      nodes.filter(
        (n): n is VerseNodeType => n.type === "verse" && !!n.data.verseRef,
      ),
    [nodes],
  );

  // Opening picks up the reader's current selection; after that the dialog's
  // own verse chips are in charge, so a background change can't move the card.
  useEffect(() => {
    if (!open) return;
    setVerseId(pickVerseNodeId(nodes));
    setFlash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void waitForFonts().then(() => {
      if (alive) setFontsReady(true);
    });
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

  const input: ShareCardInput = useMemo(
    () => ({
      mode,
      format,
      title: mapName,
      nodes,
      edges,
      theme: getTheme(colorTheme),
      version,
      verseNodeId: verseId,
    }),
    [mode, format, mapName, nodes, edges, colorTheme, version, verseId],
  );

  // Re-compose the preview on every change. A card is a few hundred draw calls,
  // so this is cheap enough to run straight through without debouncing.
  useEffect(() => {
    if (!open || !fontsReady || !canvasRef.current) return;
    renderShareCard(canvasRef.current, input);
  }, [open, fontsReady, input]);

  const say = useCallback((text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const withBlob = useCallback(
    async (run: (blob: Blob) => Promise<void> | void) => {
      setBusy(true);
      try {
        await run(await shareCardBlob(input));
      } catch {
        say("Something went wrong composing the card.");
      } finally {
        setBusy(false);
      }
    },
    [input, say],
  );

  const download = () =>
    withBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = shareFilename(input);
      a.click();
      URL.revokeObjectURL(url);
      say("Saved to your downloads.");
    });

  const copyImage = () =>
    withBlob(async (blob) => {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        say("This browser can't copy images — use Download instead.");
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      say("Card copied — paste it straight into your post.");
    });

  const shareNative = () =>
    withBlob(async (blob) => {
      const file = new File([blob], shareFilename(input), {
        type: "image/png",
      });
      if (!navigator.canShare?.({ files: [file] })) {
        say("Sharing isn't available here — try Download.");
        return;
      }
      try {
        await navigator.share({ files: [file], text: shareCaption(input) });
      } catch {
        // A cancelled share sheet is not an error.
      }
    });

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption(input));
      say("Caption copied.");
    } catch {
      say("Couldn't reach the clipboard.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Share this map as an image"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close share"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        className="relative mx-auto mt-[5vh] flex max-h-[90vh] w-[min(960px,calc(100%-2rem))] animate-fade-up flex-col overflow-hidden rounded-2xl border border-rule bg-parchment shadow-2xl shadow-ink/25"
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule/70 px-6 py-4">
          <div>
            <p className="font-sans text-2xs tracking-eyebrow text-gold">
              SHARE AS IMAGE
            </p>
            <p className="mt-1 font-serif text-md italic text-ink">
              {mode === "verse"
                ? "One passage, set large"
                : "Your study, framed"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule text-ink-muted transition-colors hover:border-gold hover:text-gold"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_310px]">
          {/* Preview */}
          <div className="relative flex items-center justify-center bg-parchment-2 px-6 py-6">
            <div
              aria-hidden="true"
              className="dot-grid pointer-events-none absolute inset-0"
            />
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Preview of the ${format.name.toLowerCase()} share card`}
              className={`relative max-h-[54vh] max-w-full rounded-lg shadow-xl shadow-ink/15 transition-opacity duration-300 ${
                fontsReady ? "opacity-100" : "opacity-0"
              }`}
              style={{ height: "auto", width: "auto" }}
            />
          </div>

          {/* Controls */}
          <div className="border-t border-rule/70 px-6 py-5 md:border-l md:border-t-0">
            <Label>WHAT TO SHARE</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                active={mode === "map"}
                onClick={() => setMode("map")}
                label="Whole map"
                hint="Every bubble, fitted to frame"
              />
              <Chip
                active={mode === "verse"}
                onClick={() => setMode("verse")}
                disabled={!verses.length}
                label="One verse"
                hint={
                  verses.length
                    ? "The passage, with your highlights"
                    : "Add a verse bubble first"
                }
              />
            </div>

            {mode === "verse" && verses.length > 1 && (
              <>
                <Label className="mt-5">WHICH PASSAGE</Label>
                <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {verses.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVerseId(v.id)}
                      aria-pressed={v.id === verseId}
                      className={`rounded-full border px-2.5 py-1 font-sans text-2xs transition-colors ${
                        v.id === verseId
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-rule text-ink-muted hover:border-gold hover:text-gold"
                      }`}
                    >
                      {v.data.verseRef}
                    </button>
                  ))}
                </div>
              </>
            )}

            <Label className="mt-5">SIZE</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SHARE_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f)}
                  aria-pressed={f.id === format.id}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    f.id === format.id
                      ? "border-gold bg-gold/5"
                      : "border-rule hover:border-gold/60"
                  }`}
                >
                  <span
                    className={`block font-sans text-xs ${
                      f.id === format.id ? "text-gold" : "text-ink-soft"
                    }`}
                  >
                    {f.name}
                  </span>
                  <span className="mt-0.5 block font-sans text-[10px] text-ink-muted">
                    {f.hint}
                  </span>
                </button>
              ))}
            </div>

            <Label className="mt-5">CAPTION</Label>
            <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-line rounded-lg border border-rule bg-parchment-2 px-3 py-2 font-sans text-[11px] leading-relaxed text-ink-muted">
              {shareCaption(input)}
            </p>
            <button
              type="button"
              onClick={copyCaption}
              className="mt-2 font-sans text-2xs text-gold transition-colors hover:text-ink"
            >
              Copy caption
            </button>

            <p className="mt-5 font-sans text-[10px] leading-relaxed text-ink-muted/70">
              The card follows your bubble theme. Handles, badges and selection
              glow are left off.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/70 px-6 py-4">
          <p
            aria-live="polite"
            className="min-h-[1.1rem] font-sans text-2xs text-ink-muted"
          >
            {flash ?? ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={shareNative}
              disabled={busy}
              className="hidden rounded-full border border-rule px-4 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50 sm:block"
            >
              Share…
            </button>
            <button
              type="button"
              onClick={copyImage}
              disabled={busy}
              className="rounded-full border border-rule px-4 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            >
              Copy image
            </button>
            <button
              type="button"
              onClick={download}
              disabled={busy}
              className="rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink disabled:opacity-50"
            >
              {busy ? "Composing…" : "Download PNG"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-sans text-2xs tracking-eyebrow text-ink-muted ${className}`}
    >
      {children}
    </p>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={hint}
      className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? "border-gold bg-gold/5" : "border-rule hover:border-gold/60"
      }`}
    >
      <span
        className={`block font-sans text-xs ${active ? "text-gold" : "text-ink-soft"}`}
      >
        {label}
      </span>
      <span className="mt-0.5 block font-sans text-[10px] text-ink-muted">
        {hint}
      </span>
    </button>
  );
}
