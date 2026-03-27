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
  swap_alternative boolean not null default false,
  custom_config jsonb
);

create index if not exists saved_plans_owner_key_saved_at_idx
  on public.saved_plans (owner_key, saved_at desc);

alter table public.saved_plans enable row level security;

-- anon key로 직접 접근 차단 (서버에서 service role key로만 접근)
create policy "deny_anon_access" on public.saved_plans
  as restrictive
  to anon
  using (false);

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

create table if not exists public.shared_plans (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists shared_plans_created_at_idx
  on public.shared_plans (created_at desc);

-- Add partner_votes column to shared_plans if not exists
alter table public.shared_plans add column if not exists partner_votes jsonb;

-- RLS for shared_plans: allow anonymous read (plans are public by ID), block direct write
alter table public.shared_plans enable row level security;

create policy "allow_anon_read_shared_plans" on public.shared_plans
  for select
  to anon
  using (true);

create policy "deny_anon_write_shared_plans" on public.shared_plans
  as restrictive
  to anon
  using (false)
  with check (false);

-- Cleanup function: delete expired api_cache rows
create or replace function public.cleanup_expired_cache()
returns void
language sql
security definer
as $$
  delete from public.api_cache where expires_at < now();
$$;
