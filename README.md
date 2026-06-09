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

| Var | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Inserts into `waitlist`. Never exposed to the client. |
| `WAITLIST_RATE_LIMIT_SECRET` | server | Salt for hashing IPs (`sha256(ip + secret + day)`) |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for metadata / OG / sitemap |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | public | Enables Plausible when set |

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

## Deploy

Push to GitHub, import into Vercel, add the env vars above (mark
`SUPABASE_SERVICE_ROLE_KEY` and `WAITLIST_RATE_LIMIT_SECRET` as server-side), and
deploy.

## What's next (out of scope here)

- Extract `@hodos/tokens` for the Expo iPad/mobile app.
- Resend double opt-in email.
- `/manifesto` or `/about` page.
