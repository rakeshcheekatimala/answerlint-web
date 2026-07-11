create extension if not exists pgcrypto;

create table if not exists public.business_scan_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  base_url text not null,
  discovered_urls text[] not null default '{}'::text[],
  pages jsonb not null default '[]'::jsonb,
  business_model text not null default 'Business Website',
  scan_history jsonb not null default '[]'::jsonb,
  latest_score numeric,
  potential_score numeric,
  lost_opportunity_score numeric,
  -- SHA-256 hash of the per-project edit token. The plaintext token is only
  -- ever returned to the creator once (on discovery) and is required to read
  -- or mutate the project, enforcing ownership without requiring login.
  owner_token_hash text,
  source text not null default 'business-aware-scan',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to run on an existing table created before the ownership token existed.
alter table public.business_scan_projects
  add column if not exists owner_token_hash text;

create index if not exists business_scan_projects_base_url_idx
  on public.business_scan_projects (base_url);

create index if not exists business_scan_projects_user_id_idx
  on public.business_scan_projects (user_id);

alter table public.business_scan_projects enable row level security;

revoke all on table public.business_scan_projects from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.business_scan_projects to service_role;

-- The app writes projects through trusted Next.js route handlers using the
-- Supabase service role key. No public table policies are required.

-- Make the new table visible to Supabase's PostgREST API immediately.
notify pgrst, 'reload schema';

-- Verification output should return public.business_scan_projects.
select to_regclass('public.business_scan_projects') as business_scan_projects;
