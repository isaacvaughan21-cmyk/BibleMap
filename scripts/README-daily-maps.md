# Map of the Day — generation & schedule

A new, Scripture-grounded study map is published every day. Maps are authored
offline (by Claude — **no runtime API key**), validated verse-by-verse against
the committed Bible corpus, and committed as static JSON. The app serves
"today's" map **by date**, so it rotates on its own with no server and no key,
and shows the same map to every reader on a given day.

## Where things live

| Path                                  | What it is                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/daily-maps/index.json`        | Manifest: `{ generatedAt, maps: [{ id, date, title, question, anchorRef, blurb }] }`                                                           |
| `public/daily-maps/<id>.json`         | One full map (`DailyMap`) — nodes, edges, injected verse text                                                                                  |
| `scripts/daily-map-seeds.json`        | Curated seeds: `{ index, ref, theme, question, anchorText }`                                                                                   |
| `scripts/daily-map-specs.json`        | Authored specs the build consumes                                                                                                              |
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

Specs are authored by a Claude workflow: one agent per seed drafts a small map,
a second agent validates every reference against the corpus and enforces
scripture-only grounding, writing each result to `scripts/specs/spec-NN.json`.
Those are assembled into `scripts/daily-map-specs.json` and fed to the build.
To add new days, extend `scripts/daily-map-seeds.json` with fresh anchor verses
(varied books/genres, no repeats) and re-run the workflow + build.

## The daily schedule

A scheduled **cloud** agent (runs on Anthropic's servers — the user's computer
can be off) keeps the pool stocked: when fewer than ~10 future-dated maps
remain, it authors more with the workflow, runs the build, and commits the new
`public/daily-maps/**` to the repo (Vercel auto-deploys). Because the app picks
today's map by date from a committed pool, a missed run never leaves readers
without a map — the schedule only tops the pool up.
