create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',
  rating smallint not null check (rating between 1 and 5),
  experience text not null check (char_length(experience) between 40 and 1200),
  published_quote text,
  features_tried text[] not null check (cardinality(features_tried) > 0),
  author jsonb not null,
  private_improvement_feedback text,
  publishing_consent boolean not null default false,
  featured boolean not null default false,
  display_order integer,
  status text not null default 'pending'
    check (status in ('pending', 'needs_revision', 'approved', 'rejected', 'archived')),
  moderation jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint approved_reviews_are_publishable check (
    status <> 'approved'
    or (
      publishing_consent = true
      and nullif(trim(published_quote), '') is not null
      and published_at is not null
    )
  )
);

create index if not exists reviews_public_listing_idx
  on public.reviews (locale, featured desc, display_order, published_at desc)
  where status = 'approved' and publishing_consent = true;

alter table public.reviews enable row level security;

-- There are intentionally no public policies. The server uses the Supabase
-- secret key for pending submissions and emits a narrow PublicReview DTO.
