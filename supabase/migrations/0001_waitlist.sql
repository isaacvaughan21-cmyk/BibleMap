-- Hodos waitlist table.
-- Run in the Supabase SQL editor, or via `supabase db push`.

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  source text,                 -- 'landing' for now
  user_agent text,
  ip_hash text                 -- sha256(ip + daily salt), no raw IPs
);

alter table waitlist enable row level security;

-- No public policies: with RLS enabled and no policy, the anon/auth roles
-- cannot select or insert. Inserts happen exclusively through the server
-- action using the service-role key, which bypasses RLS.
