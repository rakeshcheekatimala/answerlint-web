create extension if not exists pgcrypto;

create table if not exists public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  kind text not null check (kind in ('single', 'comparison')),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  target_url text not null,
  competitor_url text,
  preview jsonb not null,
  report jsonb not null,
  downloads jsonb not null,
  claim_token_hash text not null unique,
  source text not null default 'playground',
  metadata jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.audit_reports(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_reports_email_idx on public.audit_reports (lower(email));
create index if not exists audit_reports_user_id_idx on public.audit_reports (user_id);
create index if not exists audit_reports_target_url_idx on public.audit_reports (target_url);
create index if not exists audit_events_report_id_idx on public.audit_events (report_id);

alter table public.audit_reports enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.audit_reports from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.audit_reports to service_role;
grant all on table public.audit_events to service_role;

-- The app reads and writes these tables through trusted Next.js route handlers
-- using the Supabase service role key. No public table policies are required.

-- Make newly created tables visible to Supabase's PostgREST API immediately.
notify pgrst, 'reload schema';

-- Verification output. Both columns should return public.<table_name>, not null.
select
  to_regclass('public.audit_reports') as audit_reports,
  to_regclass('public.audit_events') as audit_events;
