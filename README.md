# Hodos — Landing Page

Prelaunch waitlist site for **Hodos** (ΟΔΟΣ — _"the way, the path"_), an infinite, zoomable mind map for Bible study.

> Your word is a lamp to my feet and a light to my path. — Psalm 119:105

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — brand tokens live in [`tailwind.config.ts`](tailwind.config.ts) + [`app/globals.css`](app/globals.css)
- **Framer Motion** — the scroll-driven zoom canvas
- **Supabase** — waitlist backend (insert via a server action with the service-role key)
- Deploys to **Vercel**

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

The site renders fully without any env vars — only the waitlist form needs
Supabase. Plausible analytics stay off until `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

## Environment variables

See [`.env.example`](.env.example). Summary:

| Var                            | Scope           | Purpose                                                                                                                                                                                     |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | public          | Supabase project URL                                                                                                                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`    | **server-only** | Inserts into `waitlist`. Never exposed to the client.                                                                                                                                       |
| `WAITLIST_RATE_LIMIT_SECRET`   | server          | Salt for hashing IPs (`sha256(ip + secret + day)`)                                                                                                                                          |
| `NEXT_PUBLIC_SITE_URL`         | public          | Canonical URL for metadata / OG / sitemap                                                                                                                                                   |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | public          | Enables Plausible when set                                                                                                                                                                  |
| `ANTHROPIC_API_KEY`            | **server-only** | Adds the AI written answer to the Ask Scripture assistant. Optional — without it, the assistant still answers (authorship/biography from curated metadata, topical as the matching verses). |
| `ANTHROPIC_QA_MODEL`           | server          | Optional model override (default `claude-opus-4-8`)                                                                                                                                         |

## Database

Run [`supabase/migrations/0001_waitlist.sql`](supabase/migrations/0001_waitlist.sql)
in the Supabase SQL editor. RLS is enabled with **no** public policies — only the
server action (service role) can write.

## The scroll-zoom interaction

A single fixed SVG ([`components/MindMapCanvas.tsx`](components/MindMapCanvas.tsx))
sits behind every section. As you scroll, one root `<g>` zooms from the hero map
into a focus node, revealing the next section's map nested inside it — a fractal
"falling deeper into the map" effect.

- **All canvas copy lives in [`lib/mindmap-data.ts`](lib/mindmap-data.ts)** — the
  one file to edit when tweaking labels or the camera path.
- Disabled under `prefers-reduced-motion` and below 768px (static hero map shown
  instead).

## Brand tokens

Defined once as CSS variables in `app/globals.css` and surfaced as Tailwind
semantic names in `tailwind.config.ts`. **No hex codes in components.** When the
Expo app arrives, extract these into a shared `@hodos/tokens` package.

## Project structure

```
app/
  layout.tsx              fonts, analytics, JSON-LD, canvas mount, metadata
  page.tsx                composes all sections
  globals.css             tokens, dotted-grid bg, base styles
  actions/join-waitlist.ts   server action (validate → rate-limit → insert)
  opengraph-image.tsx     dynamic 1200x630 OG
  apple-icon.tsx          dynamic 180x180 apple touch icon
  icon.svg                Δ-in-circle favicon
  robots.ts / sitemap.ts
components/
  Nav · Hero · Problem · HowItWorks · Features · WaitlistCTA · Footer
  MindMapCanvas.tsx       scroll-zoom SVG
  WaitlistForm.tsx        client component, calls the server action
lib/
  mindmap-data.ts         all canvas copy + camera keyframes
  supabase-server.ts      service-role client (server-only)
  rate-limit.ts           in-memory limiter (5 / 10 min)
  validation.ts           zod schema
```

## Ask Scripture (canvas Q&A assistant)

A study-rail assistant (`ASK` in the canvas top bar, or `⌘/Ctrl J`) answers
natural-language questions grounded **only** in the local Bible corpus, with every
claim backed by cited verses. It never answers from outside knowledge — if the
text doesn't address something, it says so.

### How grounding works

1. **Route** ([`lib/qa/route.ts`](lib/qa/route.ts)) — a deterministic classifier
   sends the question to one of: _authorship_, _biography_, _topical_, or
   _off-topic_ (declined with no model call).
2. **Evidence** — authorship/biography draw verse-referenced facts from the
   curated metadata layer ([`lib/qa/book-meta.ts`](lib/qa/book-meta.ts),
   [`lib/qa/person-meta.ts`](lib/qa/person-meta.ts)); topical questions retrieve
   passages from a local **BM25** index ([`lib/qa/retriever.ts`](lib/qa/retriever.ts),
   `data/qa-index/`) with synonym expansion ([`lib/qa/topic-seeds.ts`](lib/qa/topic-seeds.ts)),
   scoped to a New/Old Testament toggle in the panel (defaults to New).
3. **Generate** ([`app/actions/ask-scripture.ts`](app/actions/ask-scripture.ts)) —
   the retrieved passages are numbered and handed to Claude under a strict
   Scripture-only prompt. The model cites by **passage number**, never a free-text
   reference, so it can't invent a citation.
4. **Validate** — every cited passage is re-checked against the corpus
   ([`lib/qa/server-bible.ts`](lib/qa/server-bible.ts), reads `public/bible/` via
   `fs`). Anything that doesn't resolve is dropped; an empty topical result becomes
   an honest "Scripture doesn't address that." The displayed verse text always
   comes from the corpus, never the model's quote.

The `ANTHROPIC_API_KEY` stays server-side (the action is a Next server action)
and is **optional** — it only adds the AI's written synthesis. Without it the
assistant still works: authorship/biography answer from curated metadata, and
topical questions return the matching verses (the model's prose is what's
skipped, not the grounding).

### Building the index

The retrieval index is committed under `data/qa-index/`. Rebuild it after changing
the corpus:

```bash
npm run build:qa-index            # BM25 over the BSB corpus (~46k units)
# node scripts/build-qa-index.mjs --version=KJV   # build against another bundled version
# node scripts/build-qa-index.mjs --embed         # also write a local vector index
```

The `--embed` flag additionally writes a quantized MiniLM vector index
(`embeddings.bin`), the spec's local vector store. It is **optional** — runtime
retrieval is BM25 + curated metadata, which needs no model at request time and so
stays reliable on serverless. Install the optional dependency to use it:
`npm i -D @xenova/transformers`.

> **Deploy note:** the server action reads `data/qa-index/` and `public/bible/`
> off the filesystem. `next.config.mjs` lists them in `outputFileTracingIncludes`
> so they ship into the Vercel Lambda — verify they're present in the deployed
> function, not just locally.

### Swapping translations

The index is built from the public-domain **BSB** by default. Rebuild with
`--version=KJV` (or `WEB`, `ASV`, `YLT` — anything bundled under
`public/bible/<VERSION>/`) to index another translation. At answer time the
assistant validates and renders citations in the canvas's currently selected
version, so changing translations doesn't require a rebuild.

## Deploy

Push to GitHub, import into Vercel, add the env vars above (mark
`SUPABASE_SERVICE_ROLE_KEY`, `WAITLIST_RATE_LIMIT_SECRET`, and `ANTHROPIC_API_KEY`
as server-side), and deploy.

## What's next (out of scope here)

- Extract `@hodos/tokens` for the Expo iPad/mobile app.
- Resend double opt-in email.
- `/manifesto` or `/about` page.
