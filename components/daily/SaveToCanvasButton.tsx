"use client";

import { useState } from "react";
import { importDailyMapAsCanvas } from "@/lib/daily-map-import";
import type { DailyMap } from "@/lib/daily-map";

/**
 * Copies the day's map into the reader's own library as a fresh, editable
 * canvas, then opens the app onto it. Works for everyone — guests included —
 * since it writes to the local database; signed-in readers' copies then sync
 * via CloudSync the next time the canvas loads.
 */
export default function SaveToCanvasButton({
  map,
  className,
}: {
  map: DailyMap;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <button
      type="button"
      disabled={saving}
      onClick={async () => {
        if (saving) return;
        setSaving(true);
        try {
          const canvasId = await importDailyMapAsCanvas(map, {
            activate: true,
          });
          // Remember which canvas to settle on. For signed-in readers, a cloud
          // pull on /app would otherwise reset the active canvas to the cloud
          // snapshot's value — CloudSync restores this intent after pulling.
          try {
            sessionStorage.setItem("hodos.pendingCanvas", canvasId);
          } catch {
            // sessionStorage unavailable (e.g. private mode) — the local
            // activeCanvas meta still points at the new canvas.
          }
          // Hard navigation, not router.push: the canvas store is a module
          // singleton that hydrates only once per JS context, so an in-app
          // (SPA) nav to /app would keep whatever canvas was already active.
          // A full document load makes the store re-read the activeCanvas we
          // just set and open straight onto the new Map-of-the-Day canvas.
          window.location.assign("/app");
        } catch (err) {
          console.error("hodos: failed to save daily map", err);
          setSaving(false);
        }
      }}
      className={
        className ??
        "group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-sans text-sm font-medium text-parchment shadow-md shadow-gold/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15 disabled:opacity-60"
      }
    >
      {saving ? (
        "Opening your canvas…"
      ) : (
        <>
          Open in my canvas
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </>
      )}
    </button>
  );
}
