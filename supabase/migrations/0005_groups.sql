-- Group map sharing — a shared, live-edited canvas for a group of members.
--
-- The app stays local-first (IndexedDB). A "group" owns ONE shared canvas.
-- Each member mirrors their local edits here (one row per bubble/edge, JSONB
-- payload matching the DbNode/DbEdge shape) and subscribes to Realtime, so
-- everyone sees each other's bubbles, edges, and deletions within ~1s.
-- Per-entity last-write-wins by `updated_at` — the same pragmatic rule the
-- single-user cloud sync already uses (no CRDT).
--
-- Deletions are SOFT (deleted_at), matching the local tombstone model, so a
-- delete propagates instead of a row silently reappearing on another client.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ── Tables ───────────────────────────────────────────────────────────────

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx
  on public.group_members (user_id);

create table if not exists public.group_nodes (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  map_id text not null,
  data jsonb,               -- full DbNode payload (null for a bare tombstone)
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists group_nodes_group_idx
  on public.group_nodes (group_id);

create table if not exists public.group_edges (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  map_id text not null,
  data jsonb,               -- full DbEdge payload (null for a bare tombstone)
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists group_edges_group_idx
  on public.group_edges (group_id);

-- ── Membership helper (avoids recursive RLS) ─────────────────────────────
-- security definer so a policy can ask "is auth.uid() a member of gid?"
-- without the member row itself being subject to a policy check.

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_nodes enable row level security;
alter table public.group_edges enable row level security;

-- groups: members can read their groups. Inserts/joins flow through the
-- security-definer RPCs below, so no broad insert policy is needed here.
drop policy if exists "groups – member read" on public.groups;
create policy "groups – member read" on public.groups
  for select using (public.is_group_member(id));

-- group_members: a member can see the roster of any group they belong to,
-- and can remove THEMSELVES (leave).
drop policy if exists "members – read roster" on public.group_members;
create policy "members – read roster" on public.group_members
  for select using (public.is_group_member(group_id));

drop policy if exists "members – leave" on public.group_members;
create policy "members – leave" on public.group_members
  for delete using (user_id = auth.uid());

-- group_nodes / group_edges: any member may read and write the shared canvas.
-- Deletes are soft (an update setting deleted_at) so there is no delete policy.
drop policy if exists "group_nodes – member read" on public.group_nodes;
create policy "group_nodes – member read" on public.group_nodes
  for select using (public.is_group_member(group_id));

drop policy if exists "group_nodes – member write" on public.group_nodes;
create policy "group_nodes – member write" on public.group_nodes
  for insert with check (public.is_group_member(group_id));

drop policy if exists "group_nodes – member update" on public.group_nodes;
create policy "group_nodes – member update" on public.group_nodes
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "group_edges – member read" on public.group_edges;
create policy "group_edges – member read" on public.group_edges
  for select using (public.is_group_member(group_id));

drop policy if exists "group_edges – member write" on public.group_edges;
create policy "group_edges – member write" on public.group_edges
  for insert with check (public.is_group_member(group_id));

drop policy if exists "group_edges – member update" on public.group_edges;
create policy "group_edges – member update" on public.group_edges
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- ── Create / join RPCs (security definer, called from the anon client) ───
-- Keeps the service-role key out of the browser path: create/join do their
-- privileged inserts inside these functions, scoped to auth.uid().

-- A short, unambiguous invite code (no 0/O/1/I).
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           (floor(random() * 32)::int) + 1, 1), '')
  from generate_series(1, 8);
$$;

create or replace function public.create_group(
  p_name text,
  p_display_name text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  code text;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  -- Retry on the (astronomically unlikely) invite-code collision.
  loop
    code := public.gen_invite_code();
    begin
      insert into public.groups (name, owner, invite_code)
      values (coalesce(nullif(trim(p_name), ''), 'Shared map'), auth.uid(), code)
      returning * into g;
      exit;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  insert into public.group_members (group_id, user_id, display_name, role)
  values (g.id, auth.uid(), p_display_name, 'owner')
  on conflict (group_id, user_id) do nothing;

  return g;
end;
$$;

create or replace function public.join_group_by_code(
  p_code text,
  p_display_name text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into g from public.groups
  where invite_code = upper(trim(p_code));

  if g.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, display_name, role)
  values (g.id, auth.uid(), p_display_name, 'member')
  on conflict (group_id, user_id)
    do update set display_name = coalesce(excluded.display_name,
                                          public.group_members.display_name);

  return g;
end;
$$;

-- List the groups the current user belongs to, with a live-ish member count.
create or replace function public.my_groups()
returns table (
  id uuid,
  name text,
  invite_code text,
  role text,
  owner uuid,
  member_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.name, g.invite_code, m.role, g.owner,
         (select count(*) from public.group_members mm where mm.group_id = g.id)
  from public.groups g
  join public.group_members m
    on m.group_id = g.id and m.user_id = auth.uid()
  order by g.created_at desc;
$$;

-- ── Enable Realtime ──────────────────────────────────────────────────────
-- Postgres-changes on the two content tables drive the live sync. (If the
-- publication doesn't exist yet, create it; then add the tables. Also
-- toggleable per-table in Dashboard → Database → Replication.)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'group_nodes'
  ) then
    alter publication supabase_realtime add table public.group_nodes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'group_edges'
  ) then
    alter publication supabase_realtime add table public.group_edges;
  end if;
end $$;
