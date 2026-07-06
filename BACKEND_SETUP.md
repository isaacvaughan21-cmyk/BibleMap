# Hodos backend setup — accounts, cloud sync & feedback

The app is **local-first**: it works fully offline with on-device accounts.
The cloud features (real sign-in, cross-device canvas sync, server-saved
feedback) are **opt-in by configuration** — they switch on only when the
environment variables below are set. Until then, nothing changes.

There is **no code left to write** — these are the live-service steps.

## 0. Current production status (2026-06-11)

⚠️ `SUPABASE_SERVICE_ROLE_KEY` is **empty** in Vercel production (the rotation
stored a blank value), so the live waitlist + beta sign-up + feedback are
currently **not saving**. Step 1 fixes that.

## 1. Service-role key (fixes waitlist + feedback + admin)

Vercel → Project `hodos` → Settings → Environment Variables →
`SUPABASE_SERVICE_ROLE_KEY` → set the **current** service-role key from
Supabase → Project Settings → API. Apply to **Production + Preview**, then
redeploy.

> Do NOT paste secret keys into chat — set them in the dashboard.

`NEXT_PUBLIC_SUPABASE_URL` is already set to `https://vvpyuimzindtrivurwex.supabase.co`.

## 2. Feedback table

Supabase → SQL Editor → run `supabase/migrations/0002_feedback.sql`
(creates `public.feedback` with RLS; the server action's service-role client
inserts into it). After this, the in-app **Send feedback** widget persists.

## 3. Accounts + cloud sync (turns on real login)

a. **Anon key** — Supabase → Settings → API → copy the `anon` / publishable
key. Add it to Vercel as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Production + Preview). This is the single switch that enables real
accounts; it's public and safe in the client.

b. **Enable email auth** — Supabase → Authentication → Providers → **Email**:
enable it. For the smoothest beta, turn **off** "Confirm email" (under
Authentication → Sign In / Providers) so sign-up logs the user straight in.
(If you keep confirmation on, the gate tells users to confirm by email then
sign in — that works too.)

c. **Sync table** — SQL Editor → run `supabase/migrations/0003_user_maps.sql`
(one JSONB snapshot of each user's canvases, RLS-scoped to the owner).

Once the anon key is present and a deploy goes out, the `/app` gate becomes
**Create account / Sign in**, and a signed-in user's canvases sync across
devices (last-write-wins; on sign-in the cloud snapshot merges into local).

## 4. Group map sharing (live collaboration)

Lets signed-in users create/join a **group** and edit one shared canvas
together in real time (bubbles, edges, live cursors, a "who's here" roster).
Built on the **same** anon key + Supabase Auth as step 3 — no new secret.

a. **Tables + RPCs** — SQL Editor → run `supabase/migrations/0005_groups.sql`.
This creates `groups`, `group_members`, `group_nodes`, `group_edges` (RLS
scoped to members via a `is_group_member()` helper), the
`create_group` / `join_group_by_code` / `my_groups` RPCs the browser calls,
and — at the end — adds the two content tables to the `supabase_realtime`
publication.

b. **Confirm Realtime is on** — Supabase → Database → Replication → the
`supabase_realtime` publication should list `group_nodes` and `group_edges`.
(The migration adds them; you can also toggle here.) Realtime must be enabled
for the project (it is by default).

That's it — the top-bar **people icon** appears (only when the anon key is
set), and `/app?join=CODE` invite links let others join. Per-entity
last-write-wins, same pragmatic rule as the single-user sync; a member's
theme, streak, and undo history stay local and are not shared.

## What still isn't built (by design, for later)

- Password reset / email change UI.
- Real-time / multi-tab conflict resolution **for a single user's own maps**
  (that sync is last-write-wins, whole tree, debounced — fine for one device
  at a time). Note: _group_ canvases (step 4) ARE realtime, per-entity LWW.
- True concurrent co-typing inside one bubble (group edits are per-entity LWW,
  so two people typing the same bubble at once → last write wins; a CRDT layer
  would be needed for character-level merges).
- Migrating an existing **guest's** on-device maps into a brand-new account on
  first sign-up (today, guest maps are merged up on the next push if the guest
  later signs in on the same device; a dedicated "claim my guest work" step
  could be added).
