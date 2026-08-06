-- Many studies per group.
--
-- 0005 gave a group exactly ONE shared canvas, and made its id the group id.
-- A group is really a room of people, not a single map: a Tuesday study wants
-- a map per week, and a member wants to bring one of their own studies in.
--
-- So a group now owns a LIST of canvases (`group_canvases`), and every shared
-- bubble/edge carries the canvas it belongs to. The canvas id is the SAME id
-- the client uses locally, so a study shared out of someone's own library
-- keeps its identity (and its bubbles' mapIds) on every member's machine.
-- Ids are text, not uuid: the very first canvas a reader ever gets is `root`.
--
-- Safe to re-run. Run in the Supabase SQL editor (or `supabase db push`).

-- ── The canvases a group shares ──────────────────────────────────────────

create table if not exists public.group_canvases (
  id text primary key,           -- the client's canvas id, shared verbatim
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null default 'Untitled map',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_canvases_group_idx
  on public.group_canvases (group_id);

-- ── Bubbles and edges now name their canvas ──────────────────────────────
-- `map_id` is the map WITHIN a canvas (the root map, or a dived-into bubble).
-- `canvas_id` is the study it all hangs off — what the group lists.

alter table public.group_nodes add column if not exists canvas_id text;
alter table public.group_edges add column if not exists canvas_id text;

-- Pre-0006 rows come from the one-canvas-per-group era, where the canvas id
-- WAS the group id.
update public.group_nodes set canvas_id = group_id::text where canvas_id is null;
update public.group_edges set canvas_id = group_id::text where canvas_id is null;

create index if not exists group_nodes_canvas_idx
  on public.group_nodes (canvas_id);
create index if not exists group_edges_canvas_idx
  on public.group_edges (canvas_id);

-- Every existing group keeps its one canvas, now listed like any other.
insert into public.group_canvases (id, group_id, name, created_by)
select g.id::text, g.id, g.name, g.owner
from public.groups g
on conflict (id) do nothing;

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.group_canvases enable row level security;

-- Any member sees every study the group shares.
drop policy if exists "group_canvases – member read" on public.group_canvases;
create policy "group_canvases – member read" on public.group_canvases
  for select using (public.is_group_member(group_id));

-- Sharing is an act of the person doing it — you can only add a study under
-- your own name, and only to a group you're in.
drop policy if exists "group_canvases – member share" on public.group_canvases;
create policy "group_canvases – member share" on public.group_canvases
  for insert with check (
    public.is_group_member(group_id) and created_by = auth.uid()
  );

-- Renaming a shared study is ordinary collaboration; any member may do it.
drop policy if exists "group_canvases – member update" on public.group_canvases;
create policy "group_canvases – member update" on public.group_canvases
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Taking a study back out is not: only whoever shared it, or the group's
-- owner, can unshare.
drop policy if exists "group_canvases – unshare" on public.group_canvases;
create policy "group_canvases – unshare" on public.group_canvases
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner = auth.uid()
    )
  );

-- Unsharing has to be able to withdraw the content too. Everyday deletion of
-- a bubble stays SOFT (deleted_at) — this is the hard sweep behind it.
drop policy if exists "group_nodes – member delete" on public.group_nodes;
create policy "group_nodes – member delete" on public.group_nodes
  for delete using (public.is_group_member(group_id));

drop policy if exists "group_edges – member delete" on public.group_edges;
create policy "group_edges – member delete" on public.group_edges
  for delete using (public.is_group_member(group_id));

-- ── my_groups(), now with a study count ──────────────────────────────────

drop function if exists public.my_groups();
create or replace function public.my_groups()
returns table (
  id uuid,
  name text,
  invite_code text,
  role text,
  owner uuid,
  member_count bigint,
  canvas_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.name, g.invite_code, m.role, g.owner,
         (select count(*) from public.group_members mm where mm.group_id = g.id),
         (select count(*) from public.group_canvases gc where gc.group_id = g.id)
  from public.groups g
  join public.group_members m
    on m.group_id = g.id and m.user_id = auth.uid()
  order by g.created_at desc;
$$;

-- A group's name is the members' to choose, not just the founder's.
create or replace function public.rename_group(p_group_id uuid, p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member';
  end if;
  update public.groups
     set name = coalesce(nullif(trim(p_name), ''), name)
   where id = p_group_id
  returning * into g;
  return g;
end;
$$;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Adding the canvas list to the publication is what makes a study someone
-- else shares appear in your Library without a reload.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'group_canvases'
  ) then
    alter publication supabase_realtime add table public.group_canvases;
  end if;
end $$;
