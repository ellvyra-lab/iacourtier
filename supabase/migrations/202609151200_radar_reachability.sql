-- TICKET #056 — recherche publique de coordonnées reliée au CRM central.
-- Les coordonnées confirmées restent dans les tables CRM centrales; le Radar
-- ne conserve qu'une liaison et un journal de provenance privé par courtier.

alter table public.client_contact_methods
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists confirmed_at timestamptz;

create table if not exists public.client_public_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  link_type text not null check (link_type in ('facebook', 'other')),
  label text,
  url text not null,
  normalized_url text not null,
  source text not null default 'manual_public_search',
  source_url text,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, normalized_url)
);

create table if not exists public.radar_crm_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_key text not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, prospect_key)
);

create table if not exists public.radar_contact_research_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_key text not null,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete set null,
  event_type text not null check (event_type in ('search_opened', 'contact_confirmed', 'ready_to_call', 'follow_up_created')),
  source_type text not null,
  source_url text,
  title text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_public_links_client_idx
  on public.client_public_links (user_id, client_id, updated_at desc);
create index if not exists radar_crm_links_prospect_idx
  on public.radar_crm_links (user_id, prospect_key);
create index if not exists radar_contact_research_events_prospect_idx
  on public.radar_contact_research_events (user_id, prospect_key, created_at desc);

alter table public.client_public_links enable row level security;
alter table public.radar_crm_links enable row level security;
alter table public.radar_contact_research_events enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['client_public_links', 'radar_crm_links', 'radar_contact_research_events'] loop
    execute format('drop policy if exists "owner_select" on public.%I', table_name);
    execute format('drop policy if exists "owner_insert" on public.%I', table_name);
    execute format('drop policy if exists "owner_update" on public.%I', table_name);
    execute format('drop policy if exists "owner_delete" on public.%I', table_name);
    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

create policy "owner_insert" on public.client_public_links for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
);
create policy "owner_update" on public.client_public_links for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
);

create policy "owner_insert" on public.radar_crm_links for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  and exists (select 1 from public.client_cases d where d.id = case_id and d.user_id = auth.uid())
  and (property_id is null or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid()))
);
create policy "owner_update" on public.radar_crm_links for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  and exists (select 1 from public.client_cases d where d.id = case_id and d.user_id = auth.uid())
  and (property_id is null or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid()))
);

create policy "owner_insert" on public.radar_contact_research_events for insert with check (
  auth.uid() = user_id
  and (client_id is null or exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()))
  and (case_id is null or exists (select 1 from public.client_cases d where d.id = case_id and d.user_id = auth.uid()))
);
create policy "owner_update" on public.radar_contact_research_events for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (client_id is null or exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()))
  and (case_id is null or exists (select 1 from public.client_cases d where d.id = case_id and d.user_id = auth.uid()))
);

comment on table public.client_public_links is 'Liens publics confirmés d’un client CRM (Facebook ou autre), avec provenance.';
comment on table public.radar_crm_links is 'Liaison privée entre une opportunité Radar et le client/dossier CRM central.';
comment on table public.radar_contact_research_events is 'Historique privé des recherches publiques et coordonnées confirmées depuis le Radar.';

notify pgrst, 'reload schema';

