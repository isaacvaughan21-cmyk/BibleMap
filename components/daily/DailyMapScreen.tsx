import Link from "next/link";
import DailyMapView from "@/components/daily/DailyMapView";
import SaveToCanvasButton from "@/components/daily/SaveToCanvasButton";
import type { DailyMap, DailyMapMeta } from "@/lib/daily-map";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(key: string): string {
  return dateFormat.format(new Date(`${key}T00:00:00Z`));
}

/**
 * The shared presentation for a daily map — used both for "today" and for a
 * permalinked map. Anyone can read it; "Save to my canvas" copies it into the
 * reader's own editable canvas. Server component (the interactive map and the
 * save button are the only client islands).
 */
export default function DailyMapScreen({
  map,
  recent,
  isToday,
}: {
  map: DailyMap;
  recent: DailyMapMeta[];
  isToday: boolean;
}) {
  const anchorNode = map.nodes.find((n) => n.id === "anchor");

  return (
    <div className="mx-auto max-w-3xl px-gutter py-rhythm md:px-0">
      <div className="flex items-center justify-between gap-4">
        <p className="font-sans text-2xs tracking-eyebrow text-gold">
          {isToday ? "MAP OF THE DAY" : "MAP OF THE DAY · ARCHIVE"}
        </p>
        <p className="font-sans text-2xs text-ink-muted">
          {formatDate(map.date)}
        </p>
      </div>

      <h1 className="mt-3 font-serif text-2xl leading-tight text-ink md:text-3xl">
        {map.title}
      </h1>

      {/* The anchor verse — the scripture the whole map springs from. */}
      {anchorNode?.verseRef && (
        <blockquote className="mt-6 border-l-2 border-gold/60 pl-5">
          <p className="font-serif text-lg italic leading-relaxed text-ink-soft">
            &ldquo;{anchorNode.verseText}&rdquo;
          </p>
          <cite className="mt-2 block font-mono text-2xs font-medium uppercase not-italic tracking-[0.14em] text-gold">
            {anchorNode.verseRef} · {map.version}
          </cite>
        </blockquote>
      )}

      <p className="mt-6 font-serif text-md leading-relaxed text-ink">
        {map.question}
      </p>

      {/* The interactive map */}
      <div className="mt-8 h-[460px] overflow-hidden rounded-2xl border border-rule bg-parchment shadow-lg shadow-ink/5 md:h-[540px]">
        <DailyMapView map={map} />
      </div>
      <p className="mt-2 text-center font-sans text-2xs text-ink-muted/80">
        Drag to pan · scroll the bubbles · pinch or use the controls to zoom
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <SaveToCanvasButton map={map} />
        <a
          href="/app"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full border border-rule px-6 py-3 font-sans text-sm text-ink-soft transition-colors hover:border-gold hover:text-gold"
        >
          Open the full canvas
        </a>
      </div>

      {map.blurb && (
        <p className="mx-auto mt-8 max-w-xl text-center font-serif text-sm italic leading-relaxed text-ink-muted">
          {map.blurb}
        </p>
      )}

      {/* Grounding note */}
      <p className="mx-auto mt-6 max-w-xl text-center font-sans text-2xs leading-relaxed text-ink-muted/80">
        Every verse on this map is drawn straight from the {map.version} text of
        Scripture. The questions and observations are here to help you look
        closer — not to replace your own reading.
      </p>

      {/* Archive */}
      {recent.length > 0 && (
        <div className="mt-16 border-t border-rule pt-8">
          <p className="mb-5 font-sans text-2xs tracking-eyebrow text-ink-muted">
            MORE MAPS
          </p>
          <ul className="space-y-4">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/map-of-the-day/${m.id}`}
                  className="group flex items-baseline justify-between gap-4"
                >
                  <span>
                    <span className="font-serif text-md text-ink transition-colors group-hover:text-gold">
                      {m.title}
                    </span>{" "}
                    <span className="font-mono text-2xs uppercase tracking-[0.12em] text-gold/80">
                      {m.anchorRef}
                    </span>
                  </span>
                  <span className="shrink-0 font-sans text-2xs text-ink-muted">
                    {formatDate(m.date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
