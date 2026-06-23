-- AI study-notes usage log.
--
-- One row per SUCCESSFUL Claude generation. This table is the SERVER-SIDE
-- source of truth for the lifetime free-trial quota: a non-admin user's
-- remaining generations = HODOS_AI_FREE_GENERATIONS minus count(*) of their
-- rows. Admins (HODOS_ADMIN_EMAILS) are never charged and never counted.
-- Rows are written by the service-role client from /api/ai-notes AFTER Claude
-- returns successfully — failed / oversized / unauthenticated calls never
-- insert, so the trial is never spent on an error.
--
-- RLS: users may READ their own rows (for a future "X of N left" UI); only the
-- service role inserts (anon/auth client has no insert/update/delete policy, so
-- a user cannot forge usage rows or DELETE rows to refill their quota).
-- Idempotent — safe to re-run.

create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  email         text,
  model         text not null,
  map_name      text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Hot path is "count this user's rows" -> index by user_id.
create index if not exists ai_usage_user_id_idx on public.ai_usage (user_id);

alter table public.ai_usage enable row level security;

-- Read-your-own (no insert/update/delete policy for anon/auth -> service role only).
drop policy if exists "own ai_usage – select" on public.ai_usage;
create policy "own ai_usage – select" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Mirror the owner email server-side (same pattern as user_maps_set_email in 0004).
-- Stops a caller spoofing someone else's email and keeps the table readable in
-- the Supabase editor. security definer so it may read auth.users.
create or replace function public.ai_usage_set_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  select u.email into new.email
  from auth.users u
  where u.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists ai_usage_set_email on public.ai_usage;
create trigger ai_usage_set_email
  before insert or update on public.ai_usage
  for each row execute function public.ai_usage_set_email();

-- QUOTA-RACE NOTE: counting rows then inserting is a check-then-act with a tiny
-- TOCTOU window (two concurrent requests could each see count=4 and both insert,
-- yielding 6 of 5). Acceptable for a small lifetime trial and narrowed by the
-- per-user in-memory rate limit. If strict enforcement is ever required, replace
-- the count with an atomic guarded-insert RPC.
