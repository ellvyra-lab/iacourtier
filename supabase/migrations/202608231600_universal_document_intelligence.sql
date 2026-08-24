-- TICKET #046 — Analyse universelle reliée aux dossiers CRM existants.
-- Migration idempotente : aucune donnée existante n'est supprimée.

alter table public.seller_listings
  add column if not exists pipeline_stage text not null default 'lead';

alter table public.buyer_cases
  add column if not exists pipeline_stage text not null default 'qualification',
  add column if not exists property_id uuid references public.properties(id) on delete set null;

alter table public.seller_listing_documents
  add column if not exists source_type text not null default 'pdf',
  add column if not exists analysis_metadata jsonb not null default '{}'::jsonb;

alter table public.buyer_case_documents
  add column if not exists source_type text not null default 'pdf',
  add column if not exists analysis_metadata jsonb not null default '{}'::jsonb;

alter table public.seller_listing_facts
  add column if not exists source_type text not null default 'manual';

create table if not exists public.client_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null,
  file_hash text not null,
  file_type text not null,
  row_count integer not null default 0,
  column_mapping jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  recommended_automations jsonb not null default '[]'::jsonb,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.clients
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists birth_date date,
  add column if not exists purchase_date date,
  add column if not exists sale_date date,
  add column if not exists mortgage_renewal_date date,
  add column if not exists client_status text not null default 'prospect',
  add column if not exists source text,
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists last_import_id uuid references public.client_imports(id) on delete set null;

create table if not exists public.client_import_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null references public.client_imports(id) on delete cascade,
  contact_id uuid references public.clients(id) on delete set null,
  row_numbers integer[] not null default '{}'::integer[],
  outcome text not null check (outcome in ('created', 'updated', 'unchanged', 'merged', 'skipped', 'needs_review', 'incomplete')),
  warnings text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_case_parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  contact_id uuid not null references public.clients(id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'owner')),
  created_at timestamptz not null default now(),
  unique (case_id, contact_id, role)
);

create table if not exists public.buyer_case_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  fact_key text not null,
  label text not null,
  value text not null default '',
  status text not null default 'to_confirm' check (status in ('confirmed', 'to_confirm')),
  source_document_id uuid references public.buyer_case_documents(id) on delete set null,
  source_label text not null,
  source_type text not null default 'manual',
  confidence numeric(4,3),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_listings_pipeline_stage_idx
  on public.seller_listings (user_id, pipeline_stage, updated_at desc);
create index if not exists buyer_cases_pipeline_stage_idx
  on public.buyer_cases (user_id, pipeline_stage, updated_at desc);
create index if not exists buyer_case_parties_contact_idx
  on public.buyer_case_parties (user_id, contact_id);
create index if not exists buyer_case_facts_case_idx
  on public.buyer_case_facts (case_id, fact_key);
create index if not exists client_imports_user_created_idx
  on public.client_imports (user_id, created_at desc);
create index if not exists client_imports_hash_idx
  on public.client_imports (user_id, file_hash);
create index if not exists client_import_contacts_import_idx
  on public.client_import_contacts (import_id, outcome);
create index if not exists clients_email_normalized_idx
  on public.clients (user_id, lower(trim(email))) where email is not null;

alter table public.buyer_case_parties enable row level security;
alter table public.buyer_case_facts enable row level security;
alter table public.client_imports enable row level security;
alter table public.client_import_contacts enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['buyer_case_parties', 'buyer_case_facts', 'client_imports', 'client_import_contacts'] loop
    execute format('drop policy if exists "owner_select" on public.%I', table_name);
    execute format('drop policy if exists "owner_insert" on public.%I', table_name);
    execute format('drop policy if exists "owner_update" on public.%I', table_name);
    execute format('drop policy if exists "owner_delete" on public.%I', table_name);
    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_insert" on public.%I for insert with check (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

comment on column public.seller_listings.pipeline_stage is 'Étape métier précise inférée et confirmée; distincte du statut technique du dossier.';
comment on column public.buyer_cases.pipeline_stage is 'Étape métier précise inférée et confirmée; distincte du statut technique du dossier.';
comment on table public.buyer_case_facts is 'Valeurs acheteur avec provenance documentaire et niveau de confiance.';
comment on table public.client_imports is 'Journal reproductible des imports CSV/XLSX/XLS et de leur plan d’automatisations non exécuté.';
comment on column public.clients.tags is 'Tags CRM modifiables issus des données confirmées, jamais d’un envoi automatique.';

notify pgrst, 'reload schema';
