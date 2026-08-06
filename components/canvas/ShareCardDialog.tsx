"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getTheme } from "@/lib/themes";
import type { VerseNodeType } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { SHARE_FORMATS } from "@/lib/share/formats";
import {
  defaultQuestionNodeId,
  pickVerseNodeId,
  questionOptions,
  renderShareCard,
  shareArchiveName,
  shareCaption,
  shareCardBlob,
  shareFilename,
  waitForFonts,
  type ShareBackground,
  type ShareCardInput,
} from "@/lib/share/render-card";
import { createZip, uniqueName } from "@/lib/share/zip";
import type { HodosNode } from "@/lib/types";

/**
 * "Share as image" — compose the study into cards built for a feed.
 *
 * A card is a passage: one verse set large with the reader's own highlights,
 * headed by whichever question they want beside it. What changes is what sits
 * behind it — plain paper, or their map ghosted across the plate. Everything
 * is drawn from the map data rather than screenshotted, so the card is sharp
 * at every export size and carries none of the editing chrome.
 *
 * Passages and sizes both take several at once: a study's worth of cards, or
 * one passage cut for every platform, comes out in a single pass. The batch is
 * the product of the two — pick three passages and two sizes and you get six
 * cards, which arrive as one archive rather than six download prompts.
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

  const [background, setBackground] = useState<ShareBackground>("plain");
  const [formatIds, setFormatIds] = useState<string[]>([SHARE_FORMATS[0].id]);
  const [verseIds, setVerseIds] = useState<string[]>([]);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  const verses = useMemo(
    () =>
      nodes.filter(
        (n): n is VerseNodeType => n.type === "verse" && !!n.data.verseRef,
      ),
    [nodes],
  );

  // A question can only be chosen deliberately when there's one card's passage
  // to choose it for; a batch gives each passage the question joined to it.
  const soloVerseId = verseIds.length === 1 ? verseIds[0] : null;
  const questions = useMemo(
    () => questionOptions(nodes, edges, soloVerseId),
    [nodes, edges, soloVerseId],
  );

  /** Toggle a passage in or out, never emptying the selection. */
  const toggleVerse = useCallback(
    (id: string) => {
      const next = verseIds.includes(id)
        ? verseIds.filter((v) => v !== id)
        : [...verseIds, id];
      if (!next.length) return;
      // Keep map order rather than click order, so the batch reads the way the
      // study does.
      const ordered = verses
        .filter((v) => next.includes(v.id))
        .map((v) => v.id);
      setVerseIds(ordered);
      if (ordered.length === 1) {
        setQuestionId(defaultQuestionNodeId(nodes, edges, ordered[0]));
      }
    },
    [verseIds, verses, nodes, edges],
  );

  const toggleFormat = useCallback((id: string) => {
    setFormatIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      if (!next.length) return prev;
      return SHARE_FORMATS.filter((f) => next.includes(f.id)).map((f) => f.id);
    });
  }, []);

  // Opening picks up the reader's current selection; after that the dialog's
  // own passage chips are in charge, so a background change can't move the card.
  useEffect(() => {
    if (!open) return;
    const id = pickVerseNodeId(nodes);
    setVerseIds(id ? [id] : []);
    setQuestionId(defaultQuestionNodeId(nodes, edges, id));
    setPreviewIndex(0);
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

  /** Every card the current choices describe — passages crossed with sizes. */
  const cards: ShareCardInput[] = useMemo(() => {
    const formats = SHARE_FORMATS.filter((f) => formatIds.includes(f.id));
    const theme = getTheme(colorTheme);
    // A study with no passage still makes a card — of the map itself.
    const subjects: (string | null)[] = verseIds.length ? verseIds : [null];
    const out: ShareCardInput[] = [];
    for (const verseNodeId of subjects) {
      for (const format of formats) {
        out.push({
          background,
          format,
          title: mapName,
          nodes,
          edges,
          theme,
          version,
          verseNodeId,
          questionNodeId:
            subjects.length === 1
              ? questionId
              : verseNodeId
                ? defaultQuestionNodeId(nodes, edges, verseNodeId)
                : null,
        });
      }
    }
    return out;
  }, [
    background,
    formatIds,
    verseIds,
    questionId,
    mapName,
    nodes,
    edges,
    colorTheme,
    version,
  ]);

  const index = Math.min(previewIndex, Math.max(0, cards.length - 1));
  const card = cards[index];

  useEffect(() => {
    setPreviewIndex((i) => Math.min(i, Math.max(0, cards.length - 1)));
  }, [cards.length]);

  // Re-compose the preview on every change. A card is a few hundred draw calls,
  // so this is cheap enough to run straight through without debouncing.
  useEffect(() => {
    if (!open || !fontsReady || !canvasRef.current || !card) return;
    renderShareCard(canvasRef.current, card);
  }, [open, fontsReady, card]);

  const say = useCallback((text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 2600);
  }, []);

  /** Render the whole batch, reporting progress — a dozen cards isn't instant. */
  const renderAll = useCallback(async (): Promise<
    { name: string; blob: Blob }[]
  > => {
    const taken = new Set<string>();
    const out: { name: string; blob: Blob }[] = [];
    for (const [i, one] of cards.entries()) {
      setBusy(
        cards.length > 1 ? `Composing ${i + 1}/${cards.length}…` : "Composing…",
      );
      out.push({
        name: uniqueName(shareFilename(one), taken),
        blob: await shareCardBlob(one),
      });
    }
    return out;
  }, [cards]);

  const run = useCallback(
    async (job: () => Promise<void>) => {
      setBusy("Composing…");
      try {
        await job();
      } catch {
        say("Something went wrong composing the cards.");
      } finally {
        setBusy(null);
      }
    },
    [say],
  );

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const download = () =>
    run(async () => {
      const files = await renderAll();
      if (files.length === 1) {
        save(files[0].blob, files[0].name);
        say("Saved to your downloads.");
        return;
      }
      const entries = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          data: new Uint8Array(await f.blob.arrayBuffer()),
        })),
      );
      save(createZip(entries), shareArchiveName(mapName));
      say(`${files.length} cards saved as a zip.`);
    });

  const copyImage = () =>
    run(async () => {
      if (!card) return;
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        say("This browser can't copy images — use Download instead.");
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": await shareCardBlob(card) }),
      ]);
      say(
        cards.length > 1
          ? "The shown card is copied — paste it into your post."
          : "Card copied — paste it straight into your post.",
      );
    });

  const shareNative = () =>
    run(async () => {
      const rendered = await renderAll();
      const files = rendered.map(
        (f) => new File([f.blob], f.name, { type: "image/png" }),
      );
      if (!navigator.canShare?.({ files })) {
        say("Sharing isn't available here — try Download.");
        return;
      }
      try {
        await navigator.share({
          files,
          text: card ? shareCaption(card) : undefined,
        });
      } catch {
        // A cancelled share sheet is not an error.
      }
    });

  const copyCaption = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(shareCaption(card));
      say("Caption copied.");
    } catch {
      say("Couldn't reach the clipboard.");
    }
  };

  if (!open) return null;

  const many = cards.length > 1;

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
              SHARE AS {many ? "IMAGES" : "IMAGE"}
            </p>
            <p className="mt-1 font-serif text-md italic text-ink">
              {!verses.length
                ? "Your study, framed"
                : many
                  ? `${cards.length} cards from this study`
                  : background === "map"
                    ? "One passage, over your map"
                    : "One passage, set large"}
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
          <div className="relative flex flex-col items-center justify-center gap-3 bg-parchment-2 px-6 py-6">
            <div
              aria-hidden="true"
              className="dot-grid pointer-events-none absolute inset-0"
            />
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Preview of the ${card?.format.name.toLowerCase() ?? ""} share card`}
              className={`relative max-h-[48vh] max-w-full rounded-lg shadow-xl shadow-ink/15 transition-opacity duration-300 ${
                fontsReady ? "opacity-100" : "opacity-0"
              }`}
              style={{ height: "auto", width: "auto" }}
            />
            {many && (
              <div className="relative flex items-center gap-3">
                <StepButton
                  label="Previous card"
                  onClick={() =>
                    setPreviewIndex(
                      (i) => (i - 1 + cards.length) % cards.length,
                    )
                  }
                  path="M7.5 2.5 4 6l3.5 3.5"
                />
                <span className="font-sans text-2xs tabular-nums text-ink-muted">
                  {index + 1} / {cards.length}
                  <span className="ml-2 text-ink-muted/70">
                    {card?.format.name}
                  </span>
                </span>
                <StepButton
                  label="Next card"
                  onClick={() => setPreviewIndex((i) => (i + 1) % cards.length)}
                  path="M4.5 2.5 8 6l-3.5 3.5"
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="border-t border-rule/70 px-6 py-5 md:border-l md:border-t-0">
            {verses.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <Label>
                    {verses.length > 1 ? "WHICH PASSAGES" : "WHICH PASSAGE"}
                  </Label>
                  {verses.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVerseIds(
                          verseIds.length === verses.length
                            ? [verses[0].id]
                            : verses.map((v) => v.id),
                        )
                      }
                      className="font-sans text-2xs text-gold transition-colors hover:text-ink"
                    >
                      {verseIds.length === verses.length
                        ? "Just one"
                        : "Select all"}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {verses.map((v) => (
                    <Pill
                      key={v.id}
                      active={verseIds.includes(v.id)}
                      onClick={() => toggleVerse(v.id)}
                    >
                      {v.data.verseRef}
                    </Pill>
                  ))}
                </div>
                {verses.length > 1 && (
                  <p className="mt-1.5 font-sans text-[10px] text-ink-muted/70">
                    Pick several and you get a card for each.
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-rule px-3 py-2 font-sans text-[11px] leading-relaxed text-ink-muted">
                No passage placed yet — the card shows the map itself. Add a
                verse bubble and it becomes the subject.
              </p>
            )}

            {questions.length > 0 && soloVerseId && (
              <>
                <Label className="mt-5">HEADED BY</Label>
                <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                  <Pill
                    active={questionId === null}
                    onClick={() => setQuestionId(null)}
                  >
                    No question
                  </Pill>
                  {questions.map(({ node, linked }) => (
                    <Pill
                      key={node.id}
                      active={node.id === questionId}
                      onClick={() => setQuestionId(node.id)}
                      title={nodeText(node)}
                    >
                      {linked ? "· " : ""}
                      {shorten(nodeText(node), 30)}
                    </Pill>
                  ))}
                </div>
                <p className="mt-1.5 font-sans text-[10px] text-ink-muted/70">
                  Questions joined to this passage are marked ·, but any
                  question in the study can head the card.
                </p>
              </>
            )}

            {verseIds.length > 1 && (
              <p className="mt-4 font-sans text-[10px] leading-relaxed text-ink-muted/70">
                Each card is headed by the question joined to its own passage.
                Choose a single passage to set that yourself.
              </p>
            )}

            {/* Only meaningful behind a passage — with none placed, the card
                already IS the map. */}
            {verses.length > 0 && (
              <>
                <Label className="mt-5">BACKGROUND</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip
                    active={background === "plain"}
                    onClick={() => setBackground("plain")}
                    label="Plain"
                    hint="Paper, and nothing else"
                  />
                  <Chip
                    active={background === "map"}
                    onClick={() => setBackground("map")}
                    label="Your map"
                    hint="The study, ghosted behind"
                  />
                </div>
              </>
            )}

            <Label className="mt-5">SIZES</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SHARE_FORMATS.map((f) => (
                <Chip
                  key={f.id}
                  active={formatIds.includes(f.id)}
                  onClick={() => toggleFormat(f.id)}
                  label={f.name}
                  hint={f.hint}
                />
              ))}
            </div>
            <p className="mt-1.5 font-sans text-[10px] text-ink-muted/70">
              Every size you pick is cut for each passage.
            </p>

            <Label className="mt-5">CAPTION</Label>
            <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-line rounded-lg border border-rule bg-parchment-2 px-3 py-2 font-sans text-[11px] leading-relaxed text-ink-muted">
              {card ? shareCaption(card) : ""}
            </p>
            <button
              type="button"
              onClick={copyCaption}
              className="mt-2 font-sans text-2xs text-gold transition-colors hover:text-ink"
            >
              Copy caption{many ? " for the shown card" : ""}
            </button>

            <p className="mt-5 font-sans text-[10px] leading-relaxed text-ink-muted/70">
              The cards follow your bubble theme. Handles, badges and selection
              glow are left off.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/70 px-6 py-4">
          <p
            aria-live="polite"
            className="min-h-[1.1rem] font-sans text-2xs text-ink-muted"
          >
            {busy ?? flash ?? ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={shareNative}
              disabled={!!busy}
              className="hidden rounded-full border border-rule px-4 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50 sm:block"
            >
              Share…
            </button>
            <button
              type="button"
              onClick={copyImage}
              disabled={!!busy}
              className="rounded-full border border-rule px-4 py-2 font-sans text-xs text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            >
              Copy image
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!!busy}
              className="rounded-full bg-gold px-5 py-2 font-sans text-xs font-medium text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink disabled:opacity-50"
            >
              {busy
                ? "Composing…"
                : many
                  ? `Download ${cards.length} PNGs`
                  : "Download PNG"}
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

/** Preview paging arrow — same chrome as the canvas breadcrumb's back button. */
function StepButton({
  label,
  onClick,
  path,
}: {
  label: string;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-rule bg-parchment text-ink-muted transition-colors hover:border-gold hover:text-gold"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d={path}
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** A one-line choice in a wrapping row — passages, questions, overlays. */
function Pill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`max-w-full truncate rounded-full border px-2.5 py-1 font-sans text-2xs transition-colors ${
        active
          ? "border-gold bg-gold/10 text-gold"
          : "border-rule text-ink-muted hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

/** The typed body of a bubble — what a chip shows for a question or note. */
function nodeText(node: HodosNode): string {
  if (node.type === "verse") return node.data.verseRef;
  return ((node.data as { content?: string }).content ?? "").trim();
}

function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
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
