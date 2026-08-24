-- AJOUT TICKET #047 — fusion continue, provenance, conflits et multi-adresses.
-- Migration idempotente et non destructive.

alter table public.clients
  add column if not exists language text,
  add column if not exists communication_preference text;

alter table public.documents
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists subject_client_id uuid references public.clients(id) on delete set null;

update public.documents set subject_client_id = client_id where subject_client_id is null and client_id is not null;

create table if not exists public.client_contact_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  method_type text not null check (method_type in ('phone', 'email')),
  label text not null default 'other',
  value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  source_document_id uuid references public.documents(id) on delete set null,
  confidence numeric(4,3),
  status text not null default 'confirmed' check (status in ('confirmed', 'to_confirm', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, method_type, normalized_value)
);

create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  address_type text not null default 'personal'
    check (address_type in ('personal', 'mailing', 'sold_property', 'purchased_property', 'rental_property', 'former', 'other')),
  address_line text not null,
  city text,
  postal_code text,
  province text not null default 'Québec',
  country text not null default 'Canada',
  normalized_address text not null,
  is_primary boolean not null default false,
  source_document_id uuid references public.documents(id) on delete set null,
  source_label text not null default 'Saisie du courtier',
  confidence numeric(4,3),
  status text not null default 'confirmed' check (status in ('confirmed', 'to_confirm', 'rejected', 'former')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, address_type, normalized_address)
);

create table if not exists public.crm_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('client', 'property', 'mandate', 'financing', 'transaction', 'partner', 'case')),
  entity_id uuid,
  field_key text not null,
  label text not null,
  value_text text not null,
  normalized_value text not null,
  source_document_id uuid references public.documents(id) on delete set null,
  source_label text not null,
  source_type text not null default 'manual',
  source_priority smallint not null default 10 check (source_priority between 0 and 100),
  confidence numeric(4,3),
  extracted_at timestamptz not null default now(),
  status text not null default 'to_confirm'
    check (status in ('confirmed', 'to_confirm', 'rejected', 'superseded')),
  is_active boolean not null default false,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  field_key text not null,
  label text not null,
  current_fact_id uuid references public.crm_facts(id) on delete set null,
  proposed_fact_id uuid not null references public.crm_facts(id) on delete cascade,
  current_value text not null default '',
  proposed_value text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'ignored')),
  resolution text check (resolution is null or resolution in ('replace', 'add_secondary', 'keep_existing', 'ignore')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  action text not null check (action in ('view', 'download')),
  occurred_at timestamptz not null default now()
);

insert into public.client_contact_methods (user_id, client_id, method_type, label, value, normalized_value, is_primary, status)
select user_id, id, 'email', 'primary', email, lower(trim(email)), true, 'confirmed'
from public.clients where nullif(trim(email), '') is not null
on conflict (client_id, method_type, normalized_value) do nothing;

insert into public.client_contact_methods (user_id, client_id, method_type, label, value, normalized_value, is_primary, status)
select user_id, id, 'phone', 'primary', phone, regexp_replace(phone, '[^0-9]', '', 'g'), true, 'confirmed'
from public.clients where nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '') is not null
on conflict (client_id, method_type, normalized_value) do nothing;

insert into public.client_addresses (user_id, client_id, address_type, address_line, normalized_address, is_primary, source_label, status)
select user_id, id, 'personal', mailing_address,
  regexp_replace(lower(trim(mailing_address)), '[^a-z0-9]', '', 'g'), true, 'Donnée CRM existante', 'confirmed'
from public.clients where nullif(trim(mailing_address), '') is not null
on conflict (client_id, address_type, normalized_address) do nothing;

create index if not exists client_contact_methods_client_idx on public.client_contact_methods (user_id, client_id, method_type);
create index if not exists client_addresses_client_idx on public.client_addresses (user_id, client_id, address_type);
create index if not exists crm_facts_case_idx on public.crm_facts (user_id, case_id, created_at desc);
create index if not exists crm_facts_active_idx on public.crm_facts (user_id, case_id, entity_type, entity_id, field_key) where is_active;
create index if not exists data_conflicts_pending_idx on public.data_conflicts (user_id, case_id, status, created_at desc);
create index if not exists document_access_logs_document_idx on public.document_access_logs (user_id, document_id, occurred_at desc);

alter table public.client_contact_methods enable row level security;
alter table public.client_addresses enable row level security;
alter table public.crm_facts enable row level security;
alter table public.data_conflicts enable row level security;
alter table public.document_access_logs enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['client_contact_methods', 'client_addresses', 'crm_facts', 'data_conflicts'] loop
    execute format('drop policy if exists "owner_select" on public.%I', table_name);
    execute format('drop policy if exists "owner_insert" on public.%I', table_name);
    execute format('drop policy if exists "owner_update" on public.%I', table_name);
    execute format('drop policy if exists "owner_delete" on public.%I', table_name);
    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

create policy "owner_insert" on public.client_contact_methods for insert with check (
  auth.uid() = user_id and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (source_document_id is null or exists (select 1 from public.documents d where d.id=source_document_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.client_contact_methods for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (source_document_id is null or exists (select 1 from public.documents d where d.id=source_document_id and d.user_id=auth.uid()))
);

create policy "owner_insert" on public.client_addresses for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
  and (source_document_id is null or exists (select 1 from public.documents d where d.id=source_document_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.client_addresses for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
  and (source_document_id is null or exists (select 1 from public.documents d where d.id=source_document_id and d.user_id=auth.uid()))
);

create policy "owner_insert" on public.crm_facts for insert with check (
  auth.uid() = user_id and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (source_document_id is null or exists (select 1 from public.documents doc where doc.id=source_document_id and doc.user_id=auth.uid()))
);
create policy "owner_update" on public.crm_facts for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (source_document_id is null or exists (select 1 from public.documents doc where doc.id=source_document_id and doc.user_id=auth.uid()))
);

create policy "owner_insert" on public.data_conflicts for insert with check (
  auth.uid() = user_id and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and exists (select 1 from public.crm_facts f where f.id=proposed_fact_id and f.user_id=auth.uid() and f.case_id=case_id)
  and (current_fact_id is null or exists (select 1 from public.crm_facts f where f.id=current_fact_id and f.user_id=auth.uid() and f.case_id=case_id))
);
create policy "owner_update" on public.data_conflicts for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and exists (select 1 from public.crm_facts f where f.id=proposed_fact_id and f.user_id=auth.uid() and f.case_id=case_id)
  and (current_fact_id is null or exists (select 1 from public.crm_facts f where f.id=current_fact_id and f.user_id=auth.uid() and f.case_id=case_id))
);

drop policy if exists "owner_select" on public.document_access_logs;
drop policy if exists "owner_insert" on public.document_access_logs;
create policy "owner_select" on public.document_access_logs for select using (auth.uid() = user_id);
create policy "owner_insert" on public.document_access_logs for insert with check (
  auth.uid() = user_id and exists (select 1 from public.documents d where d.id=document_id and d.user_id=auth.uid())
);

drop policy if exists "owner_insert" on public.documents;
drop policy if exists "owner_update" on public.documents;
create policy "owner_insert" on public.documents for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (subject_client_id is null or exists (select 1 from public.clients c where c.id=subject_client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.documents for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (subject_client_id is null or exists (select 1 from public.clients c where c.id=subject_client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);

comment on table public.crm_facts is 'Historique de chaque valeur extraite, avec source, confiance et décision; aucune contradiction ne remplace silencieusement la valeur active.';
comment on table public.client_addresses is 'Adresses typées d’une personne; une adresse personnelle ne remplace jamais une propriété de dossier.';
comment on column public.documents.is_sensitive is 'Vrai pour une pièce d’identité ou une source contenant des données personnelles sensibles; stockage privé obligatoire.';

notify pgrst, 'reload schema';

