create table if not exists public.saved_plans (
  id text primary key,
  owner_key text not null,
  scenario_id text not null,
  label text not null,
  mode text not null check (mode in ('p', 'j')),
  score integer not null,
  saved_at timestamptz not null default now(),
  preferences jsonb not null,
  step_ids text[] not null default '{}',
  swap_alternative boolean not null default false
);

create index if not exists saved_plans_owner_key_saved_at_idx
  on public.saved_plans (owner_key, saved_at desc);

create table if not exists public.api_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_cache_expires_at_idx
  on public.api_cache (expires_at);

create table if not exists public.place_review_summaries (
  venue_key text primary key,
  venue_name text not null,
  district text not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists place_review_summaries_district_idx
  on public.place_review_summaries (district);
