"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import ChangelogDialog from "@/components/ChangelogDialog";
import { APP_VERSION } from "@/lib/changelog";
import { BIBLE_VERSIONS } from "@/lib/versions";
import { BUBBLE_THEMES } from "@/lib/themes";
import { cloudSignOut, useAuthUser } from "@/lib/use-auth";
import GroupsMenu from "./GroupsMenu";
import { START_TOUR_EVENT } from "./GuidedTour";

type TopBarProps = {
  railOpen: boolean;
  onToggleRail: () => void;
  onAsk: () => void;
  askOpen: boolean;
  onOpenPalette: () => void;
  onFeedback: () => void;
  onExport: () => void;
  onShareImage: () => void;
  onCompileNotes: () => void;
  onImportFile: (file: File) => void;
  onDailyMap: () => void;
  onHelp: () => void;
  onRequestVersion: () => void;
};

/** Fixed, translucent canvas top bar — same chrome language as the landing nav. */
export default function TopBar({
  railOpen,
  onToggleRail,
  onAsk,
  askOpen,
  onOpenPalette,
  onFeedback,
  onExport,
  onShareImage,
  onCompileNotes,
  onImportFile,
  onDailyMap,
  onHelp,
  onRequestVersion,
}: TopBarProps) {
  return (
    <header className="dive-dim absolute inset-x-0 top-0 z-40 border-b border-rule/60 bg-parchment/70 backdrop-blur-md">
      <div className="relative flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: wordmark + version (the version opens "what's new") */}
        <div className="flex items-baseline gap-2">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-md text-ink">Hodos</span>
            <span className="font-sans text-2xs tracking-greek text-gold">
              ΟΔΟΣ
            </span>
          </Link>
          <span className="hidden sm:inline-block">
            <ChangelogDialog tone="chip" label={`BETA v${APP_VERSION}`} />
          </span>
        </div>

        {/* Center: map name at root, breadcrumb trail when nested */}
        <MapTitle />

        {/* Right: save state, palette, zoom, feedback, rail toggle */}
        <div className="flex items-center gap-3">
          <SaveBadge />
          <PaletteButton onOpen={onOpenPalette} />
          <ZoomBadge />

          <span aria-hidden="true" className="h-4 w-px bg-rule" />

          <button
            type="button"
            onClick={onFeedback}
            className="group relative hidden font-sans text-2xs tracking-eyebrow text-gold transition-colors hover:text-ink md:block"
            aria-label="Send feedback"
          >
            SEND FEEDBACK
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full"
            />
          </button>

          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-rule md:block"
          />

          <button
            type="button"
            data-tour="ask"
            onClick={onAsk}
            aria-pressed={askOpen}
            aria-label={
              askOpen ? "Close Ask Scripture" : "Ask a question about the Bible"
            }
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-2xs tracking-eyebrow transition-colors ${
              askOpen
                ? "border-gold bg-gold/10 text-gold"
                : "border-rule text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3.2A5 5 0 1 1 7 11H3.2L4.4 9.4A5 5 0 0 1 3 3.2Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            ASK
          </button>

          <button
            type="button"
            onClick={onToggleRail}
            aria-pressed={railOpen}
            aria-label={railOpen ? "Close study panel" : "Open study panel"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              railOpen
                ? "border-gold text-gold"
                : "border-rule text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="0.75"
                y="0.75"
                width="12.5"
                height="12.5"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <line
                x1="9"
                y1="1"
                x2="9"
                y2="13"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>

          <GroupsMenu />

          <OverflowMenu
            onExport={onExport}
            onShareImage={onShareImage}
            onCompileNotes={onCompileNotes}
            onImportFile={onImportFile}
            onDailyMap={onDailyMap}
            onHelp={onHelp}
            onRequestVersion={onRequestVersion}
          />
        </div>
      </div>
    </header>
  );
}

/** "…" menu — canvases, Bible version, export, import, shortcuts. */
function OverflowMenu({
  onExport,
  onShareImage,
  onCompileNotes,
  onImportFile,
  onDailyMap,
  onHelp,
  onRequestVersion,
}: {
  onExport: () => void;
  onShareImage: () => void;
  onCompileNotes: () => void;
  onImportFile: (file: File) => void;
  onDailyMap: () => void;
  onHelp: () => void;
  onRequestVersion: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const { user } = useAuthUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const openLibrary = useCanvasStore((s) => s.openLibrary);
  const liveCanvasCount = useCanvasStore(
    (s) => s.canvases.filter((c) => !c.archivedAt).length,
  );
  const bibleVersion = useCanvasStore((s) => s.bibleVersion);
  const setBibleVersion = useCanvasStore((s) => s.setBibleVersion);
  const colorTheme = useCanvasStore((s) => s.colorTheme);
  const setColorTheme = useCanvasStore((s) => s.setColorTheme);

  // A guest can upgrade to an account any time — surface it in the menu.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("hodos.account");
      setIsGuest(!!raw && !!(JSON.parse(raw) as { guest?: boolean }).guest);
    } catch {
      setIsGuest(false);
    }
  }, [open]);
  const createCanvas = useCanvasStore((s) => s.createCanvas);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Close when a pointer press lands anywhere outside the menu. A fixed
    // overlay won't do here: the top bar's `backdrop-blur` makes it the
    // containing block for fixed children, so `inset-0` only covers the bar
    // itself — not the canvas below, where most outside clicks land.
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-tour="menu"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="More options"
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
          open
            ? "border-gold text-gold"
            : "border-rule text-ink-muted hover:border-gold hover:text-gold"
        }`}
      >
        <svg width="12" height="3" viewBox="0 0 12 3" aria-hidden="true">
          <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="6" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="10.5" cy="1.5" r="1.2" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          <div
            role="menu"
            aria-label="Map options"
            className="absolute right-0 top-10 z-50 max-h-[calc(100dvh-5rem)] w-56 animate-fade-up overflow-y-auto overscroll-contain rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDailyMap();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink"
            >
              <span aria-hidden="true" className="text-gold">
                ✦
              </span>
              Map of the Day
            </button>
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            {/* Shelving, searching, and sorting all live in the Library now —
                a menu strip was never the place to organise a year of study. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openLibrary();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink"
            >
              <span aria-hidden="true" className="text-gold">
                ▤
              </span>
              Your library
              <span className="ml-auto font-sans text-[10px] tabular-nums text-ink-muted">
                {liveCanvasCount}
              </span>
            </button>
            <MenuButton
              onClick={() => {
                createCanvas();
                setOpen(false);
              }}
            >
              + New study
            </MenuButton>
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onShareImage();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-gold"
              >
                <rect
                  x="1.1"
                  y="2.4"
                  width="11.8"
                  height="9.2"
                  rx="1.6"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M1.6 9.3 4.7 6.6l2.4 2.1 2.2-1.9 3 2.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Share as image…
            </button>
            <MenuButton
              onClick={() => {
                onCompileNotes();
                setOpen(false);
              }}
            >
              Compile to notes…
            </MenuButton>
            <MenuButton
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            >
              Export map (.hodos.json)
            </MenuButton>
            <MenuButton onClick={() => fileRef.current?.click()}>
              Import map…
            </MenuButton>
            {isGuest && !user && (
              <MenuButton
                onClick={() => {
                  try {
                    localStorage.removeItem("hodos.account");
                  } catch {
                    // gate also opens via the event below
                  }
                  window.dispatchEvent(new Event("hodos:open-gate"));
                  setOpen(false);
                }}
              >
                Create free account…
              </MenuButton>
            )}
            {user && (
              <MenuButton
                onClick={() => {
                  void cloudSignOut();
                  try {
                    localStorage.removeItem("hodos.account");
                  } catch {
                    // the gate also reopens via the event below
                  }
                  window.dispatchEvent(new Event("hodos:account-changed"));
                  window.dispatchEvent(new Event("hodos:open-gate"));
                  setOpen(false);
                }}
              >
                Sign out{user.email ? ` (${user.email})` : ""}
              </MenuButton>
            )}
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            <p className="px-4 pb-1 pt-0.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
              BIBLE VERSION
            </p>
            <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-0.5">
              {BIBLE_VERSIONS.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  title={v.name}
                  aria-pressed={v.code === bibleVersion}
                  onClick={() => setBibleVersion(v.code)}
                  className={`rounded-full border px-2.5 py-0.5 font-sans text-2xs tracking-eyebrow transition-colors ${
                    v.code === bibleVersion
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-rule text-ink-muted hover:border-gold hover:text-gold"
                  }`}
                >
                  {v.code}
                </button>
              ))}
            </div>
            <MenuButton
              onClick={() => {
                onRequestVersion();
                setOpen(false);
              }}
            >
              Request another version…
            </MenuButton>
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            <p className="px-4 pb-1 pt-0.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
              THEMES
            </p>
            <div role="radiogroup" aria-label="Theme">
              {BUBBLE_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={t.id === colorTheme}
                  title={t.blurb}
                  onClick={() => setColorTheme(t.id)}
                  className="group flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-parchment-2"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-4 w-4 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded ${
                      t.id === colorTheme
                        ? "ring-2 ring-gold"
                        : "ring-1 ring-inset ring-ink/10"
                    }`}
                  >
                    <span style={{ background: t.types.question.accent }} />
                    <span style={{ background: t.types.verse.accent }} />
                    <span style={{ background: t.types.definition.accent }} />
                    <span style={{ background: t.types.note.accent }} />
                  </span>
                  <span
                    className={`flex-1 font-sans text-xs transition-colors ${
                      t.id === colorTheme
                        ? "text-ink"
                        : "text-ink-soft group-hover:text-ink"
                    }`}
                  >
                    {t.name}
                  </span>
                  {t.id === colorTheme && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 text-gold"
                    >
                      <path
                        d="M1.5 5.5L4 8L8.5 2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="px-4 pb-1 pt-0.5 font-sans text-[10px] text-ink-muted/60">
              Classic keeps every bubble parchment &amp; gold.
            </p>
            <div className="mx-4 my-1.5 h-px bg-rule/70" aria-hidden="true" />
            <MenuButton
              onClick={() => {
                window.dispatchEvent(new Event(START_TOUR_EVENT));
                setOpen(false);
              }}
            >
              Replay the guided tour
            </MenuButton>
            <MenuButton
              onClick={() => {
                onHelp();
                setOpen(false);
              }}
            >
              Keyboard shortcuts
            </MenuButton>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
              setOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink focus-visible:bg-parchment-2"
    >
      {children}
    </button>
  );
}

/** Root shows the editable map name; deeper levels show the breadcrumb. */
function MapTitle() {
  const depth = useCanvasStore((s) => s.mapPath.length);
  return depth > 1 ? <Breadcrumb /> : <MapName />;
}

/** Breadcrumb trail of opened bubbles — click a crumb to zoom back out. */
function Breadcrumb() {
  const mapPath = useCanvasStore((s) => s.mapPath);
  const requestGoTo = useCanvasStore((s) => s.requestGoTo);
  const last = mapPath.length - 1;

  return (
    <nav
      aria-label="Map breadcrumb"
      className="absolute left-1/2 hidden max-w-[52%] -translate-x-1/2 items-center gap-1.5 sm:flex"
    >
      <button
        type="button"
        data-tour="back"
        onClick={() => requestGoTo(last - 1)}
        aria-label="Back one level"
        className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-ink-muted transition-colors hover:border-gold hover:text-gold"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M7.5 2.5 4 6l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {mapPath.map((crumb, i) => (
        <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden="true" className="shrink-0 text-gold/50">
              ›
            </span>
          )}
          {i === last ? (
            <span
              aria-current="page"
              className="max-w-[16ch] truncate font-serif text-sm italic text-ink"
            >
              {crumb.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => requestGoTo(i)}
              className="max-w-[14ch] truncate font-serif text-sm italic text-ink-muted transition-colors hover:text-gold"
            >
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Map name — inline rename, persisted to the local database. */
function MapName() {
  const mapName = useCanvasStore((s) => s.mapName);
  const setMapName = useCanvasStore((s) => s.setMapName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mapName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the browser tab title in step with the map.
  useEffect(() => {
    document.title = `${mapName} — Hodos`;
  }, [mapName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setMapName(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setMapName(draft);
            setEditing(false);
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        maxLength={120}
        aria-label="Map name"
        className="absolute left-1/2 hidden w-64 -translate-x-1/2 border-b border-gold/60 bg-transparent text-center font-serif text-sm italic text-ink focus:outline-none sm:block"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(mapName);
        setEditing(true);
      }}
      title="Rename this map"
      className="group/name absolute left-1/2 hidden max-w-[40%] -translate-x-1/2 truncate rounded px-2 py-0.5 font-serif text-sm italic text-ink-muted transition-colors hover:text-ink sm:block"
    >
      {mapName}
      <span
        aria-hidden="true"
        className="ml-1.5 inline-block text-gold opacity-0 transition-opacity group-hover/name:opacity-70"
      >
        ✎
      </span>
    </button>
  );
}

/** Subtle auto-save indicator — "Saving…" then a gold "Saved" that fades. */
function SaveBadge() {
  const saveState = useCanvasStore((s) => s.saveState);
  return (
    <span
      aria-live="polite"
      className={`flex items-center gap-1 font-sans text-2xs transition-opacity duration-500 ${
        saveState === "idle" ? "opacity-0" : "opacity-100"
      } ${saveState === "saved" ? "text-gold" : "text-ink-muted"}`}
    >
      {saveState === "saved" && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1.5 5.5L4 8L8.5 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {saveState === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

/** Live zoom readout — click to reset to 100%. */
function ZoomBadge() {
  const { zoom } = useViewport();
  const { zoomTo } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();
  const pct = Math.round(zoom * 100);
  return (
    <button
      type="button"
      onClick={() => zoomTo(1, { duration: reducedMotion ? 0 : 400 })}
      aria-label={`Zoom ${pct} percent — click to reset to 100 percent`}
      className="rounded-full px-2 py-1 font-sans text-2xs tabular-nums text-ink-muted transition-colors hover:bg-parchment-2 hover:text-ink"
    >
      {pct}%
    </button>
  );
}

/** Command-palette affordance with platform-aware shortcut hint. */
function PaletteButton({ onOpen }: { onOpen: () => void }) {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      className="flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 font-sans text-2xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="5" cy="5" r="4.2" stroke="currentColor" strokeWidth="1.3" />
        <line
          x1="8.2"
          y1="8.2"
          x2="11.2"
          y2="11.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <span className="tabular-nums">{isMac ? "⌘" : "Ctrl"} K</span>
    </button>
  );
}
