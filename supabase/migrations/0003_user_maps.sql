-- Cloud sync of a user's canvases.
--
-- The app is local-first (IndexedDB). When a user signs in, their whole map
-- tree (every canvas, nested map, node + edge) is mirrored here as one JSONB
-- snapshot per user, so it follows them across devices. Last write wins.
--
-- RLS: a user can only read/write their OWN row (auth.uid() = user_id). No
-- service-role policy is needed for the client path; the key never leaves the
-- browser-safe anon client, which is constrained by these policies.

create table if not exists public.user_maps (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_maps enable row level security;

drop policy if exists "own maps – select" on public.user_maps;
create policy "own maps – select" on public.user_maps
  for select using (auth.uid() = user_id);

drop policy if exists "own maps – insert" on public.user_maps;
create policy "own maps – insert" on public.user_maps
  for insert with check (auth.uid() = user_id);

drop policy if exists "own maps – update" on public.user_maps;
create policy "own maps – update" on public.user_maps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
