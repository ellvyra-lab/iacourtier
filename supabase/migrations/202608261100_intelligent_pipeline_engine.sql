-- TICKET #051 — pipeline intelligent et moteur central de prochaine action.
-- Migration idempotente et non destructive. Le mode assisté est le défaut :
-- les preuves proposent une étape; le mode automatique peut la confirmer.

alter table public.client_cases
  add column if not exists pipeline_mode text not null default 'assisted',
  add column if not exists suggested_stage text,
  add column if not exists suggested_stage_reason text,
  add column if not exists suggestion_confidence numeric(4,3),
  add column if not exists next_best_action text,
  add column if not exists priority_level text not null default 'watch',
  add column if not exists alerts jsonb not null default '[]'::jsonb,
  add column if not exists missing_items jsonb not null default '[]'::jsonb,
  add column if not exists recommended_tasks jsonb not null default '[]'::jsonb,
  add column if not exists recommended_automations jsonb not null default '[]'::jsonb,
  add column if not exists evaluated_at timestamptz,
  add column if not exists last_stage_change_cause text,
  add column if not exists last_stage_change_actor_type text not null default 'system',
  add column if not exists last_stage_change_confidence numeric(4,3);

update public.client_cases
set next_best_action = coalesce(next_best_action, next_action),
    pipeline_mode = case when pipeline_mode in ('automatic','assisted','manual') then pipeline_mode else 'assisted' end,
    priority_level = case when priority_level in ('critical','today','this_week','watch','long_term') then priority_level else 'watch' end,
    last_stage_change_actor_type = case when last_stage_change_actor_type in ('user','automation','system') then last_stage_change_actor_type else 'system' end
where next_best_action is null
   or pipeline_mode not in ('automatic','assisted','manual')
   or priority_level not in ('critical','today','this_week','watch','long_term')
   or last_stage_change_actor_type not in ('user','automation','system');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_cases_pipeline_mode_check') then
    alter table public.client_cases add constraint client_cases_pipeline_mode_check check (pipeline_mode in ('automatic','assisted','manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_cases_priority_level_check') then
    alter table public.client_cases add constraint client_cases_priority_level_check check (priority_level in ('critical','today','this_week','watch','long_term'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_cases_stage_actor_check') then
    alter table public.client_cases add constraint client_cases_stage_actor_check check (last_stage_change_actor_type in ('user','automation','system'));
  end if;
end $$;

alter table public.crm_events
  add column if not exists cause text,
  add column if not exists actor_type text not null default 'system',
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists confidence numeric(4,3);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_events_actor_type_check') then
    alter table public.crm_events add constraint crm_events_actor_type_check check (actor_type in ('user','automation','system'));
  end if;
end $$;

create table if not exists public.case_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.client_cases(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  condition_type text not null default 'other',
  status text not null default 'pending' check (status in ('pending','satisfied','waived','cancelled')),
  due_at timestamptz,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, title)
);

create index if not exists client_cases_priority_level_idx on public.client_cases (user_id, status, priority_level, priority_score desc);
create index if not exists case_conditions_due_idx on public.case_conditions (user_id, status, due_at) where status = 'pending';

alter table public.case_conditions enable row level security;
drop policy if exists "owner_select" on public.case_conditions;
drop policy if exists "owner_insert" on public.case_conditions;
drop policy if exists "owner_update" on public.case_conditions;
drop policy if exists "owner_delete" on public.case_conditions;
create policy "owner_select" on public.case_conditions for select using (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
);
create policy "owner_insert" on public.case_conditions for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
  and (document_id is null or exists (select 1 from public.documents d where d.id=document_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.case_conditions for update using (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
) with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
  and (document_id is null or exists (select 1 from public.documents d where d.id=document_id and d.user_id=auth.uid()))
);
create policy "owner_delete" on public.case_conditions for delete using (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases c where c.id=case_id and c.user_id=auth.uid())
);

create or replace function public.record_client_case_pipeline_event()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_events (user_id, event_type, client_id, case_id, property_id, to_stage, cause, actor_type, actor_user_id, confidence, payload, idempotency_key)
    values (new.user_id, 'case_created', new.primary_client_id, new.id, new.property_id, new.current_stage,
      coalesce(new.last_stage_change_cause, 'Création du dossier'), new.last_stage_change_actor_type,
      case when new.last_stage_change_actor_type='user' then auth.uid() else null end, new.last_stage_change_confidence,
      jsonb_build_object('case_type', new.case_type, 'pipeline_mode', new.pipeline_mode), 'case-created:' || new.id::text)
    on conflict (user_id, idempotency_key) do nothing;
  elsif new.current_stage is distinct from old.current_stage then
    insert into public.crm_events (user_id, event_type, client_id, case_id, property_id, from_stage, to_stage, cause, actor_type, actor_user_id, confidence, payload, idempotency_key)
    values (new.user_id, 'pipeline_stage_changed', new.primary_client_id, new.id, new.property_id, old.current_stage, new.current_stage,
      coalesce(new.last_stage_change_cause, 'Mise à jour du pipeline'), new.last_stage_change_actor_type,
      case when new.last_stage_change_actor_type='user' then auth.uid() else null end, new.last_stage_change_confidence,
      jsonb_build_object('pipeline_mode', new.pipeline_mode),
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

comment on column public.client_cases.pipeline_mode is 'automatic avance seulement sur preuve forte; assisted propose et attend une confirmation; manual ne déplace jamais automatiquement.';
comment on column public.client_cases.suggested_stage is 'Étape suivante suggérée par evaluateCaseState sans modifier le dossier en mode assisté.';
comment on table public.case_conditions is 'Conditions transactionnelles et échéances reliées au dossier CRM central.';

notify pgrst, 'reload schema';

