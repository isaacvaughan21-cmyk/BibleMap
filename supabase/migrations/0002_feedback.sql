-- Beta feedback from the canvas feedback widget.
-- RLS enabled with NO public policies: only the server action's
-- service-role client can insert or read.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) <= 2000),
  email text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
