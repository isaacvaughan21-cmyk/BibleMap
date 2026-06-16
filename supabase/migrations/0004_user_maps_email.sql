-- Show which account a synced workspace belongs to.
--
-- `user_maps` is keyed by an opaque auth uuid, which is hard to scan in the
-- Supabase table editor. Mirror the owner's email onto the row so it's
-- readable at a glance. The value is filled SERVER-SIDE from auth.users by a
-- trigger, so:
--   * the browser (anon) client never has to send it — its push payload is
--     unchanged, so this migration can land independently of any app deploy;
--   * a user can't spoof someone else's email (they only ever write their own
--     row anyway, but the trigger ignores whatever they'd send).
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table public.user_maps
  add column if not exists email text;

-- Pull the email from the auth account on every insert/update. security
-- definer so the function may read auth.users (not visible to anon/auth);
-- search_path pinned for safety.
create or replace function public.user_maps_set_email()
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

drop trigger if exists user_maps_set_email on public.user_maps;
create trigger user_maps_set_email
  before insert or update on public.user_maps
  for each row execute function public.user_maps_set_email();

-- Backfill rows that synced before the column existed.
update public.user_maps m
set email = u.email
from auth.users u
where u.id = m.user_id
  and m.email is distinct from u.email;
