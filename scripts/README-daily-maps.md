# Map of the Day — generation & schedule

A new, Scripture-grounded **starter map** is published every day: a question
plus a few verse bubbles around it. It is deliberately NOT a finished study —
there is **no authored commentary**, only the question and Scripture, so the
reader saves it and draws the connections (and their own thoughts) themselves.

Maps are authored offline (by Claude — **no runtime API key**), validated
verse-by-verse against the committed Bible corpus, and committed as static
JSON. The app serves "today's" map **by date**, so it rotates on its own with
no server and no key, and shows the same map to every reader on a given day.

## What a map contains

- a **question** node (the hub),
- the **anchor verse** the question springs from (emphasised), and
- **3–5 starter verses** — well-known cross-references — fanned around the
  question, each joined to it by a light (manual) link.

The verse-to-verse cross-references are intentionally left undrawn — that's the
reader's work. The build emits ONLY question + verse nodes; if a spec ever
carries a `kind:"note"` branch it is ignored (we don't render authored prose).

## Where things live

| Path                                  | What it is                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/daily-maps/index.json`        | Manifest: `{ generatedAt, maps: [{ id, date, title, question, anchorRef, blurb }] }`                                                           |
| `public/daily-maps/<id>.json`         | One full map (`DailyMap`) — nodes, edges, injected verse text                                                                                  |
| `scripts/daily-map-seeds.json`        | Curated seeds: `{ index, ref, theme, question, anchorText }`                                                                                   |
| `scripts/daily-map-specs.json`        | Authored specs the build consumes: `{ title, question, anchorRef, blurb, branches: [{ kind:"verse", ref }] }`                                  |
| `scripts/build-daily-maps.mjs`        | **The grounding gate** — validates every ref against the BSB corpus, injects authoritative text, lays out the bubbles, writes the JSON + index |
| `lib/daily-map.ts`                    | Pure types + date-pick logic + client loaders                                                                                                  |
| `lib/daily-map-server.ts`             | Server-side (fs) loaders for the public page                                                                                                   |
| `lib/daily-map-import.ts`             | "Save to my canvas" — copies a map into a reader's library                                                                                     |
| `app/map-of-the-day/`                 | Public page (today) + `[id]` permalink                                                                                                         |
| `components/daily/`                   | Read-only renderer + screen + save button                                                                                                      |
| `components/canvas/DailyMapModal.tsx` | In-app "Map of the Day"                                                                                                                        |

## How a map is grounded

A spec only proposes references. `build-daily-maps.mjs` is the single source of
truth for the text: it reads each reference straight from `public/bible/<CODE>.json`,
**injects the authoritative verse text**, and **aborts the build** if any
reference doesn't fully resolve. A map is never published with a verse that
isn't really in Scripture (the same backstop as `lib/qa/server-bible.ts`).

## Build / extend

```bash
# Rebuild every map from the current specs (overwrites the index):
node scripts/build-daily-maps.mjs --fresh --start 2026-06-27

# Append more days without disturbing existing maps (merge into the index):
node scripts/build-daily-maps.mjs --start <next-open-date>
```

`--start` assigns consecutive dates to specs that don't carry their own `date`.

## Regenerating specs (the "AI" step)

Each spec is just a **question, an anchor verse, and a few well-known
cross-reference verses** — no authored commentary. To add new days, extend
`scripts/daily-map-seeds.json` with fresh anchor verses (varied books/genres,
no repeats vs. existing maps), choose the cross-references that genuinely relate
to each anchor, append the specs to `scripts/daily-map-specs.json`, and run the
build. The build is the grounding gate, so any bad reference fails loudly.

## The daily schedule

A scheduled task (`hodos-map-of-the-day`, cron `0 0 * * *`) keeps the pool
stocked: when fewer than ~10 future-dated maps remain, it authors more, runs the
build, and commits the new `public/daily-maps/**` to `main` (Vercel
auto-deploys).

Note: this scheduler runs **while the app is open** (or catches up on next
launch) — it is _not_ a cloud routine, so it can't run with the computer fully
off. The genuinely hands-free, computer-off behaviour comes from the **static
pool**: once deployed, the app picks today's map by date from the committed
files, so a missed run never leaves readers without a map — the schedule only
tops the pool up.
