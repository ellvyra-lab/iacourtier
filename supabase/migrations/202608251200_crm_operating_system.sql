-- TICKET MAÎTRE #049 — fondations du système d’exploitation CRM.
-- Migration idempotente et non destructive : les colonnes historiques restent
-- disponibles pendant que toutes les pages migrent vers le modèle central.

alter table public.clients
  add column if not exists last_contact_at timestamptz,
  add column if not exists opportunity_score smallint not null default 0 check (opportunity_score between 0 and 100),
  add column if not exists opportunity_reason text,
  add column if not exists lifecycle_stage text not null default 'prospect';

alter table public.client_cases
  add column if not exists pipeline_type text,
  add column if not exists current_stage text,
  add column if not exists stage_entered_at timestamptz not null default now(),
  add column if not exists pipeline_progress smallint not null default 0 check (pipeline_progress between 0 and 100),
  add column if not exists completion_score smallint not null default 0 check (completion_score between 0 and 100),
  add column if not exists health_score smallint not null default 100 check (health_score between 0 and 100),
  add column if not exists priority_score smallint not null default 0 check (priority_score between 0 and 100),
  add column if not exists next_action_reason text,
  add column if not exists next_action_due_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists closed_at timestamptz;

update public.client_cases
set pipeline_type = coalesce(nullif(pipeline_type, ''), case_type),
    current_stage = coalesce(nullif(current_stage, ''), pipeline_stage),
    pipeline_progress = case when pipeline_progress = 0 then progress else pipeline_progress end,
    completion_score = case when completion_score = 0 then progress else completion_score end,
    last_activity_at = coalesce(last_activity_at, updated_at, created_at)
where pipeline_type is null
   or current_stage is null
   or pipeline_progress = 0
   or completion_score = 0
   or last_activity_at is null;

alter table public.client_cases alter column pipeline_type set not null;
alter table public.client_cases alter column current_stage set not null;

alter table public.documents
  add column if not exists document_type text,
  add column if not exists source_date date,
  add column if not exists extracted_facts jsonb not null default '[]'::jsonb;

update public.documents set document_type = category where document_type is null;

alter table public.tasks
  add column if not exists stage_key text,
  add column if not exists priority_score smallint not null default 50 check (priority_score between 0 and 100),
  add column if not exists completed_at timestamptz;

create table if not exists public.crm_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  from_stage text,
  to_stage text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  status text not null default 'recorded' check (status in ('recorded', 'processing', 'processed', 'failed', 'ignored')),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.case_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  requirement_type text not null default 'data' check (requirement_type in ('data', 'document', 'task', 'appointment', 'decision')),
  required_for_stage text not null,
  status text not null default 'missing' check (status in ('missing', 'complete', 'waived', 'to_verify')),
  source_document_id uuid references public.documents(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, requirement_key)
);

create table if not exists public.case_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  predecessor_case_id uuid not null references public.client_cases(id) on delete cascade,
  successor_case_id uuid not null references public.client_cases(id) on delete cascade,
  dependency_type text not null check (dependency_type in ('sell_before_buy', 'buy_before_move', 'financing_before_offer', 'custom')),
  status text not null default 'active' check (status in ('active', 'satisfied', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (predecessor_case_id <> successor_case_id),
  unique (predecessor_case_id, successor_case_id, dependency_type)
);

create table if not exists public.client_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  related_client_id uuid not null references public.clients(id) on delete cascade,
  relationship_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> related_client_id),
  unique (client_id, related_client_id, relationship_type)
);

create table if not exists public.data_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  fact_id uuid references public.crm_facts(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  field_key text not null,
  previous_value text,
  corrected_value text not null,
  reason text,
  corrected_by uuid not null references auth.users(id) on delete restrict,
  source_priority smallint not null default 100 check (source_priority between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  opportunity_type text not null,
  score smallint not null default 0 check (score between 0 and 100),
  reason text not null,
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'detected' check (status in ('detected', 'qualified', 'converted', 'dismissed', 'expired')),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_cases_operating_idx on public.client_cases (user_id, status, priority_score desc, updated_at desc);
create index if not exists client_cases_pipeline_idx on public.client_cases (user_id, pipeline_type, current_stage, stage_entered_at);
create index if not exists crm_events_case_idx on public.crm_events (user_id, case_id, occurred_at desc);
create index if not exists crm_events_type_idx on public.crm_events (user_id, event_type, occurred_at desc);
create index if not exists case_requirements_missing_idx on public.case_requirements (user_id, case_id, status) where status in ('missing', 'to_verify');
create index if not exists case_dependencies_user_idx on public.case_dependencies (user_id, status, updated_at desc);
create index if not exists client_relationships_client_idx on public.client_relationships (user_id, client_id, relationship_type);
create index if not exists data_corrections_case_idx on public.data_corrections (user_id, case_id, created_at desc);
create index if not exists opportunities_priority_idx on public.opportunities (user_id, status, score desc, detected_at desc);

alter table public.crm_events enable row level security;
alter table public.case_requirements enable row level security;
alter table public.case_dependencies enable row level security;
alter table public.client_relationships enable row level security;
alter table public.data_corrections enable row level security;
alter table public.opportunities enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_events','case_requirements','case_dependencies','client_relationships','data_corrections','opportunities'] loop
    execute format('drop policy if exists "owner_select" on public.%I', table_name);
    execute format('drop policy if exists "owner_insert" on public.%I', table_name);
    execute format('drop policy if exists "owner_update" on public.%I', table_name);
    execute format('drop policy if exists "owner_delete" on public.%I', table_name);
    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

create policy "owner_insert" on public.crm_events for insert with check (
  auth.uid() = user_id
  and (case_id is null or exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid()))
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
  and (document_id is null or exists (select 1 from public.documents d where d.id=document_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.crm_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_insert" on public.case_requirements for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
  and (source_document_id is null or exists (select 1 from public.documents d where d.id=source_document_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.case_requirements for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
);

create policy "owner_insert" on public.case_dependencies for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=predecessor_case_id and c.user_id=auth.uid())
  and exists (select 1 from public.client_cases c where c.id=successor_case_id and c.user_id=auth.uid())
);
create policy "owner_update" on public.case_dependencies for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=predecessor_case_id and c.user_id=auth.uid())
  and exists (select 1 from public.client_cases c where c.id=successor_case_id and c.user_id=auth.uid())
);

create policy "owner_insert" on public.client_relationships for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and exists (select 1 from public.clients c where c.id=related_client_id and c.user_id=auth.uid())
);
create policy "owner_update" on public.client_relationships for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and exists (select 1 from public.clients c where c.id=related_client_id and c.user_id=auth.uid())
);

create policy "owner_insert" on public.data_corrections for insert with check (
  auth.uid() = user_id and auth.uid() = corrected_by
  and (case_id is null or exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid()))
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
);
create policy "owner_update" on public.data_corrections for update using (auth.uid() = user_id) with check (auth.uid() = user_id and auth.uid() = corrected_by);

create policy "owner_insert" on public.opportunities for insert with check (
  auth.uid() = user_id
  and (case_id is null or exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid()))
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.opportunities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_client_case_operating_fields()
returns trigger
language plpgsql
as $$
begin
  new.pipeline_type := coalesce(nullif(new.pipeline_type, ''), new.case_type);
  if tg_op = 'UPDATE' and new.pipeline_stage is distinct from old.pipeline_stage and new.current_stage is not distinct from old.current_stage then
    new.current_stage := new.pipeline_stage;
  elsif tg_op = 'UPDATE' and new.current_stage is distinct from old.current_stage then
    new.pipeline_stage := new.current_stage;
  else
    new.current_stage := coalesce(nullif(new.current_stage, ''), new.pipeline_stage);
    new.pipeline_stage := new.current_stage;
  end if;
  if tg_op = 'UPDATE' and new.current_stage is distinct from old.current_stage then
    new.stage_entered_at := now();
  end if;
  if tg_op = 'UPDATE' and new.progress is distinct from old.progress and new.pipeline_progress is not distinct from old.pipeline_progress then
    new.pipeline_progress := new.progress;
  elsif tg_op = 'UPDATE' and new.pipeline_progress is distinct from old.pipeline_progress then
    new.progress := new.pipeline_progress;
  end if;
  new.last_activity_at := coalesce(new.last_activity_at, new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists sync_client_case_operating_fields on public.client_cases;
create trigger sync_client_case_operating_fields
before insert or update on public.client_cases
for each row execute function public.sync_client_case_operating_fields();

create or replace function public.record_client_case_pipeline_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_events (user_id, event_type, client_id, case_id, property_id, to_stage, payload, idempotency_key)
    values (new.user_id, 'client_created', new.primary_client_id, new.id, new.property_id, new.current_stage, jsonb_build_object('case_type', new.case_type), 'case-created:' || new.id::text)
    on conflict (user_id, idempotency_key) do nothing;
  elsif new.current_stage is distinct from old.current_stage then
    insert into public.crm_events (user_id, event_type, client_id, case_id, property_id, from_stage, to_stage, payload, idempotency_key)
    values (new.user_id, 'pipeline_stage_changed', new.primary_client_id, new.id, new.property_id, old.current_stage, new.current_stage, '{}'::jsonb,
      'stage:' || new.id::text || ':' || coalesce(old.current_stage, '') || ':' || new.current_stage || ':' || extract(epoch from new.stage_entered_at)::bigint::text)
    on conflict (user_id, idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists record_client_case_pipeline_event on public.client_cases;
create trigger record_client_case_pipeline_event
after insert or update of current_stage, pipeline_stage on public.client_cases
for each row execute function public.record_client_case_pipeline_event();

comment on table public.crm_events is 'Journal événementiel central : document_uploaded, client_created, mandate_signed, pipeline_stage_changed, offer_accepted, condition_due et transaction_closed.';
comment on column public.client_cases.pipeline_progress is 'Position dans le pipeline; distincte de la complétude des données et de la santé du dossier.';
comment on column public.client_cases.completion_score is 'Pourcentage des exigences connues et satisfaites pour les étapes atteintes.';
comment on column public.client_cases.health_score is 'Santé opérationnelle calculée selon retards, conflits et inactivité; distincte de la progression.';
comment on table public.data_corrections is 'Corrections humaines auditées avec priorité supérieure aux extractions automatiques.';

notify pgrst, 'reload schema';

