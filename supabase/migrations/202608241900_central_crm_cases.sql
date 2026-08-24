-- TICKET #047 — dossier maître et objets CRM partagés.
-- Les tables métier acheteur/vendeur restent en place et sont reliées au
-- dossier maître; aucune donnée historique n'est supprimée.

create table if not exists public.client_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_client_id uuid references public.clients(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  case_type text not null check (case_type in ('buyer', 'seller', 'buy_sell', 'prospect', 'renewal', 'post_transaction', 'other')),
  title text not null,
  status text not null default 'active',
  pipeline_stage text not null default 'new_contact',
  progress smallint not null default 0 check (progress between 0 and 100),
  next_action text,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_case_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  role text not null default 'client',
  created_at timestamptz not null default now(),
  unique (case_id, client_id, role)
);

create table if not exists public.client_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  relationship text not null default 'interested' check (relationship in ('owner', 'buyer', 'seller', 'purchased', 'sold', 'interested')),
  case_id uuid references public.client_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, property_id, relationship, case_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  category text not null default 'Autre',
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null,
  source_type text not null default 'file',
  analysis_status text not null default 'analyzed',
  analysis_metadata jsonb not null default '{}'::jsonb,
  legacy_source text,
  legacy_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, legacy_source, legacy_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  category text not null default 'followup',
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  due_at timestamptz,
  validation_required boolean not null default true,
  legacy_source text,
  legacy_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, title),
  unique (user_id, legacy_source, legacy_id)
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  name text not null,
  status text not null default 'validation_required' check (status in ('validation_required', 'approved', 'disabled')),
  external_delivery_enabled boolean not null default false,
  legacy_source text,
  legacy_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, name),
  unique (user_id, legacy_source, legacy_id)
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete set null,
  communication_type text not null default 'note' check (communication_type in ('call', 'sms', 'email', 'note', 'conversation')),
  direction text not null default 'internal' check (direction in ('incoming', 'outgoing', 'internal')),
  subject text,
  body text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  appointment_type text not null default 'appointment',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  details text,
  legacy_source text,
  legacy_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, legacy_source, legacy_id)
);

alter table public.buyer_cases add column if not exists client_case_id uuid references public.client_cases(id) on delete cascade;
alter table public.seller_listings add column if not exists client_case_id uuid references public.client_cases(id) on delete cascade;
create unique index if not exists buyer_cases_client_case_idx on public.buyer_cases (client_case_id) where client_case_id is not null;
create unique index if not exists seller_listings_client_case_idx on public.seller_listings (client_case_id) where client_case_id is not null;

do $$
declare row_data record; master_id uuid;
begin
  for row_data in
    select b.*, concat_ws(' ', c.first_name, c.last_name) as client_name
    from public.buyer_cases b join public.clients c on c.id = b.contact_id
    where b.client_case_id is null
  loop
    insert into public.client_cases (user_id, primary_client_id, property_id, case_type, title, status, pipeline_stage, progress, next_action, source, created_at, updated_at)
    values (row_data.user_id, row_data.contact_id, row_data.property_id, 'buyer', concat('Achat — ', nullif(row_data.client_name, '')), case when row_data.status='completed' then 'completed' else 'active' end,
      coalesce(row_data.pipeline_stage, row_data.status, 'new_contact'),
      case coalesce(row_data.pipeline_stage, row_data.status) when 'financing' then 27 when 'active_search' then 45 when 'visits' then 55 when 'offer' then 64 when 'conditions' then 73 when 'notary' then 82 when 'completed' then 91 else 18 end,
      'Continuer la qualification et compléter les critères', row_data.source, row_data.created_at, row_data.updated_at)
    returning id into master_id;
    update public.buyer_cases set client_case_id = master_id where id = row_data.id;
  end loop;

  for row_data in
    select s.*, p.address, coalesce((select sp.contact_id from public.seller_listing_parties sp where sp.listing_id=s.id order by sp.created_at limit 1), null) as client_id
    from public.seller_listings s join public.properties p on p.id=s.property_id
    where s.client_case_id is null
  loop
    insert into public.client_cases (user_id, primary_client_id, property_id, case_type, title, status, pipeline_stage, progress, next_action, source, created_at, updated_at)
    values (row_data.user_id, row_data.client_id, row_data.property_id, 'seller', concat('Vente — ', row_data.address), case when row_data.status='completed' then 'completed' else 'active' end,
      coalesce(row_data.pipeline_stage, 'new_prospect'),
      case coalesce(row_data.pipeline_stage, '') when 'mandate_signed' then 38 when 'preparation' then 46 when 'marketing' then 54 when 'visits' then 62 when 'offer_received' then 69 when 'conditions' then 77 when 'notary' then 85 when 'transaction_completed' then 92 else 15 end,
      'Continuer le dossier vendeur', 'legacy_seller', row_data.created_at, row_data.updated_at)
    returning id into master_id;
    update public.seller_listings set client_case_id = master_id where id = row_data.id;
  end loop;
end $$;

insert into public.client_case_clients (user_id, case_id, client_id, role)
select b.user_id, b.client_case_id, b.contact_id, 'buyer' from public.buyer_cases b where b.client_case_id is not null
on conflict (case_id, client_id, role) do nothing;
insert into public.client_case_clients (user_id, case_id, client_id, role)
select p.user_id, s.client_case_id, p.contact_id, p.role from public.seller_listing_parties p join public.seller_listings s on s.id=p.listing_id where s.client_case_id is not null
on conflict (case_id, client_id, role) do nothing;

insert into public.client_properties (user_id, client_id, property_id, relationship, case_id)
select p.user_id, p.contact_id, s.property_id, 'seller', s.client_case_id from public.seller_listing_parties p join public.seller_listings s on s.id=p.listing_id where s.client_case_id is not null
on conflict (client_id, property_id, relationship, case_id) do nothing;
insert into public.client_properties (user_id, client_id, property_id, relationship, case_id)
select b.user_id, b.contact_id, b.property_id, 'interested', b.client_case_id from public.buyer_cases b where b.client_case_id is not null and b.property_id is not null
on conflict (client_id, property_id, relationship, case_id) do nothing;

insert into public.documents (user_id, client_id, case_id, property_id, name, category, mime_type, size_bytes, storage_path, source_type, analysis_status, analysis_metadata, legacy_source, legacy_id, created_at)
select d.user_id, b.contact_id, b.client_case_id, b.property_id, d.name, d.document_type, d.mime_type, d.size_bytes, d.storage_path, d.source_type, d.analysis_status, d.analysis_metadata, 'buyer_case_documents', d.id, d.created_at
from public.buyer_case_documents d join public.buyer_cases b on b.id=d.case_id where b.client_case_id is not null
on conflict (user_id, legacy_source, legacy_id) do nothing;
insert into public.documents (user_id, client_id, case_id, property_id, name, category, mime_type, size_bytes, storage_path, source_type, analysis_status, analysis_metadata, legacy_source, legacy_id, created_at)
select d.user_id, c.primary_client_id, s.client_case_id, s.property_id, d.name, d.document_type, d.mime_type, d.size_bytes, d.storage_path, d.source_type, d.analysis_status, d.analysis_metadata, 'seller_listing_documents', d.id, d.created_at
from public.seller_listing_documents d join public.seller_listings s on s.id=d.listing_id join public.client_cases c on c.id=s.client_case_id
on conflict (user_id, legacy_source, legacy_id) do nothing;

insert into public.tasks (user_id, client_id, case_id, category, title, status, validation_required, legacy_source, legacy_id, created_at, updated_at)
select t.user_id, b.contact_id, b.client_case_id, t.category, t.title, t.status, t.validation_required, 'buyer_case_tasks', t.id, t.created_at, t.updated_at from public.buyer_case_tasks t join public.buyer_cases b on b.id=t.case_id where b.client_case_id is not null
on conflict (user_id, legacy_source, legacy_id) do nothing;
insert into public.tasks (user_id, client_id, case_id, category, title, status, validation_required, legacy_source, legacy_id, created_at, updated_at)
select t.user_id, c.primary_client_id, s.client_case_id, t.category, t.title, t.status, t.validation_required, 'seller_listing_tasks', t.id, t.created_at, t.updated_at from public.seller_listing_tasks t join public.seller_listings s on s.id=t.listing_id join public.client_cases c on c.id=s.client_case_id
on conflict (user_id, legacy_source, legacy_id) do nothing;

insert into public.automations (user_id, client_id, case_id, name, status, external_delivery_enabled, legacy_source, legacy_id, created_at, updated_at)
select a.user_id, b.contact_id, b.client_case_id, a.name, a.status, a.external_delivery_enabled, 'buyer_case_automations', a.id, a.created_at, a.updated_at from public.buyer_case_automations a join public.buyer_cases b on b.id=a.case_id where b.client_case_id is not null
on conflict (user_id, legacy_source, legacy_id) do nothing;
insert into public.automations (user_id, client_id, case_id, name, status, external_delivery_enabled, legacy_source, legacy_id, created_at, updated_at)
select a.user_id, c.primary_client_id, s.client_case_id, a.name, a.status, a.external_delivery_enabled, 'seller_listing_automations', a.id, a.created_at, a.updated_at from public.seller_listing_automations a join public.seller_listings s on s.id=a.listing_id join public.client_cases c on c.id=s.client_case_id
on conflict (user_id, legacy_source, legacy_id) do nothing;

insert into public.activity_events (user_id, client_id, case_id, event_type, title, details, legacy_source, legacy_id, created_at)
select a.user_id, b.contact_id, b.client_case_id, a.event_type, a.title, a.details, 'buyer_case_activity', a.id, a.created_at from public.buyer_case_activity a join public.buyer_cases b on b.id=a.case_id where b.client_case_id is not null
on conflict (user_id, legacy_source, legacy_id) do nothing;
insert into public.activity_events (user_id, client_id, case_id, event_type, title, details, legacy_source, legacy_id, created_at)
select a.user_id, c.primary_client_id, s.client_case_id, a.event_type, a.title, a.details, 'seller_listing_activity', a.id, a.created_at from public.seller_listing_activity a join public.seller_listings s on s.id=a.listing_id join public.client_cases c on c.id=s.client_case_id
on conflict (user_id, legacy_source, legacy_id) do nothing;

create index if not exists client_cases_user_updated_idx on public.client_cases (user_id, updated_at desc);
create index if not exists client_cases_client_idx on public.client_cases (user_id, primary_client_id, updated_at desc);
create index if not exists client_case_clients_client_idx on public.client_case_clients (user_id, client_id);
create index if not exists documents_case_idx on public.documents (user_id, case_id, created_at desc);
create index if not exists tasks_due_idx on public.tasks (user_id, status, due_at);
create index if not exists communications_case_idx on public.communications (user_id, case_id, occurred_at desc);
create index if not exists appointments_starts_idx on public.appointments (user_id, starts_at);
create index if not exists activity_events_case_idx on public.activity_events (user_id, case_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['client_cases','client_case_clients','client_properties','documents','tasks','automations','communications','appointments','activity_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
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

comment on table public.client_cases is 'Dossier CRM maître partagé par tous les modules métier.';
comment on table public.documents is 'Index documentaire central; le fichier reste dans le stockage privé et est relié au client, dossier et à la propriété.';
comment on table public.tasks is 'Tâches CRM centrales utilisées par l’accueil, le Coach et les dossiers.';

notify pgrst, 'reload schema';
