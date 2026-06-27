"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <button
      type="button"
      disabled={saving}
      onClick={async () => {
        if (saving) return;
        setSaving(true);
        try {
          await importDailyMapAsCanvas(map, { activate: true });
          router.push("/app");
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
        "Saving to your canvas…"
      ) : (
        <>
          Save to my canvas
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
