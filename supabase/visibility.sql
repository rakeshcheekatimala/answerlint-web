-- AnswerLint AI Visibility: normalized, evidence-first persistence.
-- Apply this after supabase/audit-reports.sql.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.visibility_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  brand_url text not null,
  brand_name text not null,
  description text not null default '',
  primary_category text not null,
  target_customers text not null,
  key_use_cases text[] not null default '{}'::text[],
  revenue_goal text not null check (revenue_goal in ('awareness', 'pipeline', 'ecommerce_conversion', 'retention', 'local_discovery')),
  markets text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  surfaces text[] not null default '{}'::text[],
  runtime_policy jsonb not null,
  state text not null check (state in ('awaiting_brand_approval', 'awaiting_topic_approval', 'ready_to_benchmark', 'benchmark_queued', 'benchmarking', 'completed', 'failed')),
  owner_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visibility_competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  name text not null,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists public.visibility_brand_cards (
  project_id uuid primary key references public.visibility_projects(id) on delete cascade,
  canonical_name text not null,
  aliases text[] not null default '{}'::text[],
  value_proposition text not null,
  ideal_customer_profile text not null,
  products text[] not null default '{}'::text[],
  locations text[] not null default '{}'::text[],
  people text[] not null default '{}'::text[],
  claims text[] not null default '{}'::text[],
  pricing_signals text[] not null default '{}'::text[],
  existing_narrative text not null,
  ambiguity_risks text[] not null default '{}'::text[],
  health jsonb not null,
  approval_status text not null check (approval_status in ('pending', 'approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visibility_owned_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  url text not null,
  reason text not null,
  verification_status text not null check (verification_status in ('pending', 'verified', 'unverified')),
  created_at timestamptz not null default now()
);

create table if not exists public.visibility_topics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  statement text not null,
  buyer_intent text not null check (buyer_intent in ('discover', 'compare', 'evaluate', 'purchase', 'troubleshoot')),
  funnel_stage text not null check (funnel_stage in ('awareness', 'consideration', 'decision', 'retention')),
  commercial_value text not null check (commercial_value in ('high', 'medium', 'low')),
  market text not null,
  language text not null,
  narrative_relevance text not null,
  competitor_names text[] not null default '{}'::text[],
  evidence_sufficiency text not null check (evidence_sufficiency in ('unknown', 'limited', 'sufficient')),
  evidence_gap text not null,
  prompt_count integer not null check (prompt_count >= 0),
  surfaces text[] not null default '{}'::text[],
  included boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visibility_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  topic_id uuid not null references public.visibility_topics(id) on delete cascade,
  prompt_text text not null,
  kind text not null check (kind in ('category_discovery', 'use_case_evaluation', 'comparison', 'proof_and_trust', 'local_regional', 'brand_narrative', 'negative_risk', 'owned_citation')),
  buyer_realism text not null check (buyer_realism in ('buyer_realistic', 'brand_controlled', 'diagnostic')),
  market text not null,
  language text not null,
  surfaces text[] not null default '{}'::text[],
  why_selected text not null,
  importance_score integer not null check (importance_score between 0 and 100),
  competitor_entities text[] not null default '{}'::text[],
  planned_samples integer not null check (planned_samples between 1 and 10),
  status text not null check (status in ('planned', 'queued', 'running', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visibility_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  prompt_id uuid not null references public.visibility_prompts(id) on delete cascade,
  surface text not null,
  model_runtime text not null,
  search_mode text not null check (search_mode in ('search_enabled', 'model_only')),
  market text not null,
  language text not null,
  device text not null check (device in ('desktop', 'mobile')),
  session_policy text not null check (session_policy in ('fresh', 'reused')),
  run_at timestamptz not null,
  repetition integer not null check (repetition > 0),
  raw_answer_artifact_path text,
  raw_answer_excerpt text,
  source_manifest_artifact_path text,
  parser_version text not null,
  parser_status text not null check (parser_status in ('pending', 'parsed', 'failed')),
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  unique (prompt_id, surface, repetition, run_at)
);

-- Safe upgrades for projects that installed an earlier visibility schema.
alter table public.visibility_runs add column if not exists raw_answer_excerpt text;
alter table public.visibility_runs add column if not exists source_manifest_artifact_path text;

create table if not exists public.visibility_citations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.visibility_runs(id) on delete cascade,
  url text not null,
  canonical_url text,
  title text,
  excerpt text,
  source_type text not null check (source_type in ('owned', 'earned', 'competitor', 'unverified')),
  resolved boolean not null default false,
  supports_claim boolean not null default false,
  source_artifact_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.visibility_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.visibility_runs(id) on delete cascade,
  answer_observed boolean not null,
  brand_mentioned boolean not null,
  competitor_mentions text[] not null default '{}'::text[],
  recommendation_strength text not null check (recommendation_strength in ('none', 'mentioned', 'recommended', 'ranked')),
  ranked_position integer,
  confidence text not null check (confidence in ('high', 'medium', 'insufficient')),
  claim_verified boolean not null default false,
  signal text not null,
  created_at timestamptz not null default now(),
  check ((recommendation_strength = 'ranked' and ranked_position is not null) or (recommendation_strength <> 'ranked' and ranked_position is null))
);

create table if not exists public.visibility_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.visibility_projects(id) on delete cascade,
  action text not null,
  why_now text not null,
  expected_impact text not null check (expected_impact in ('mention', 'recommendation', 'citation', 'narrative_correction')),
  owner text not null check (owner in ('seo', 'content', 'pr', 'web', 'product_marketing')),
  effort text not null check (effort in ('low', 'medium', 'high')),
  dependency text,
  affected_prompt_ids uuid[] not null default '{}'::uuid[],
  markets text[] not null default '{}'::text[],
  surfaces text[] not null default '{}'::text[],
  confidence text not null check (confidence in ('high', 'medium', 'insufficient')),
  verification_rule text not null,
  status text not null check (status in ('signal_only', 'actionable', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only use embeddings for prompt/theme deduplication. Scores are based on
-- observed answers and verified sources, never semantic similarity.
create table if not exists public.visibility_prompt_embeddings (
  prompt_id uuid primary key references public.visibility_prompts(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists visibility_projects_user_id_idx on public.visibility_projects (user_id);
create index if not exists visibility_competitors_project_id_idx on public.visibility_competitors (project_id);
create index if not exists visibility_topics_project_id_idx on public.visibility_topics (project_id, included);
create index if not exists visibility_prompts_project_id_idx on public.visibility_prompts (project_id, status);
create index if not exists visibility_runs_project_id_idx on public.visibility_runs (project_id, run_at desc);
create index if not exists visibility_runs_prompt_id_idx on public.visibility_runs (prompt_id, surface, repetition);
create index if not exists visibility_citations_run_id_idx on public.visibility_citations (run_id);
create index if not exists visibility_citations_canonical_url_idx on public.visibility_citations (canonical_url);
create index if not exists visibility_actions_project_id_idx on public.visibility_actions (project_id, status);
create index if not exists visibility_prompt_embeddings_embedding_idx on public.visibility_prompt_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

insert into storage.buckets (id, name, public)
values ('visibility-artifacts', 'visibility-artifacts', false)
on conflict (id) do nothing;

alter table public.visibility_projects enable row level security;
alter table public.visibility_competitors enable row level security;
alter table public.visibility_brand_cards enable row level security;
alter table public.visibility_owned_assets enable row level security;
alter table public.visibility_topics enable row level security;
alter table public.visibility_prompts enable row level security;
alter table public.visibility_runs enable row level security;
alter table public.visibility_citations enable row level security;
alter table public.visibility_observations enable row level security;
alter table public.visibility_actions enable row level security;
alter table public.visibility_prompt_embeddings enable row level security;

revoke all on table public.visibility_projects, public.visibility_competitors, public.visibility_brand_cards, public.visibility_owned_assets, public.visibility_topics, public.visibility_prompts, public.visibility_runs, public.visibility_citations, public.visibility_observations, public.visibility_actions, public.visibility_prompt_embeddings from anon, authenticated;
grant usage on schema public to service_role;
grant all on table public.visibility_projects, public.visibility_competitors, public.visibility_brand_cards, public.visibility_owned_assets, public.visibility_topics, public.visibility_prompts, public.visibility_runs, public.visibility_citations, public.visibility_observations, public.visibility_actions, public.visibility_prompt_embeddings to service_role;

notify pgrst, 'reload schema';
