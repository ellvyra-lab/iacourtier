-- ============================================================
-- IACourtier - Radar de prospection automatique
-- Sources publiques synchronisees et opportunites locales
-- ============================================================

create table if not exists public.government_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text,
  city text,
  organization text,
  url text not null,
  source_type text not null default 'CSV' check (source_type in ('CSV', 'XML', 'API')),
  update_frequency text default 'nightly',
  active boolean not null default true,
  last_synced_at timestamptz,
  status text not null default 'pending',
  last_error text,
  record_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists government_sources_active_idx
  on public.government_sources (active, created_at desc);

create table if not exists public.radar_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.government_sources(id) on delete set null,
  dedupe_key text not null unique,
  address text,
  city text,
  owner_name text,
  property_type text,
  category text,
  reason text,
  opportunity_score integer not null default 0,
  priority text,
  source text not null default 'government',
  source_url text,
  raw_data jsonb not null default '{}'::jsonb,
  lot text,
  cadastre text,
  matricule text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_opportunities_score_idx
  on public.radar_opportunities (opportunity_score desc);

create index if not exists radar_opportunities_city_idx
  on public.radar_opportunities (city);

create index if not exists radar_opportunities_source_id_idx
  on public.radar_opportunities (source_id);
