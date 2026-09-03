-- TICKET #052 — boîte d'entrée IA, tâches exécutables et appels natifs.
-- Migration idempotente et non destructive : les objets restent reliés au CRM central.

alter table public.clients
  add column if not exists phone_status text not null default 'unknown',
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_call boolean not null default false,
  add column if not exists do_not_sms boolean not null default false,
  add column if not exists do_not_email boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_phone_status_check') then
    alter table public.clients add constraint clients_phone_status_check
      check (phone_status in ('unknown','valid','invalid'));
  end if;
end $$;

alter table public.tasks
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists description text,
  add column if not exists source text not null default 'manual',
  add column if not exists action_type text not null default 'other';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_action_type_check') then
    alter table public.tasks add constraint tasks_action_type_check
      check (action_type in ('call','sms','email','document','research','appointment','follow_up','marketing','other'));
  end if;
end $$;

alter table public.communications
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists task_id uuid references public.tasks(id) on delete set null,
  add column if not exists outcome text,
  add column if not exists objection text,
  add column if not exists interest_level text,
  add column if not exists next_contact_at timestamptz,
  add column if not exists phone_used text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.inbox_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.client_cases(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  source_type text not null default 'text'
    check (source_type in ('voice','text','image','document','call','task','note','other')),
  raw_text text not null default '',
  status text not null default 'pending'
    check (status in ('pending','needs_confirmation','confirmed','failed')),
  analysis jsonb not null default '{}'::jsonb,
  ambiguity jsonb not null default '[]'::jsonb,
  urgency text not null default 'normal'
    check (urgency in ('critical','high','normal','low')),
  captured_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.client_cases(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  phone_used text not null,
  status text not null default 'started' check (status in ('started','completed','cancelled')),
  outcome text check (outcome is null or outcome in ('no_answer','voicemail','answered','appointment','follow_up','not_interested','invalid_number','do_not_contact','other')),
  note text,
  objection text,
  interest_level text check (interest_level is null or interest_level in ('hot','warm','cold','unknown')),
  next_contact_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_action_due_idx on public.tasks (user_id, action_type, status, due_at);
create index if not exists inbox_captures_user_idx on public.inbox_captures (user_id, created_at desc);
create index if not exists call_activities_user_idx on public.call_activities (user_id, status, started_at desc);
create index if not exists call_activities_client_idx on public.call_activities (user_id, client_id, started_at desc);

alter table public.inbox_captures enable row level security;
alter table public.call_activities enable row level security;

drop policy if exists "owner_select" on public.inbox_captures;
drop policy if exists "owner_insert" on public.inbox_captures;
drop policy if exists "owner_update" on public.inbox_captures;
drop policy if exists "owner_delete" on public.inbox_captures;
create policy "owner_select" on public.inbox_captures for select using (auth.uid() = user_id);
create policy "owner_insert" on public.inbox_captures for insert with check (
  auth.uid() = user_id
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.inbox_captures for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_delete" on public.inbox_captures for delete using (auth.uid() = user_id);

drop policy if exists "owner_select" on public.call_activities;
drop policy if exists "owner_insert" on public.call_activities;
drop policy if exists "owner_update" on public.call_activities;
drop policy if exists "owner_delete" on public.call_activities;
create policy "owner_select" on public.call_activities for select using (auth.uid() = user_id);
create policy "owner_insert" on public.call_activities for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
  and (task_id is null or exists (select 1 from public.tasks t where t.id=task_id and t.user_id=auth.uid()))
);
create policy "owner_update" on public.call_activities for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
  and (task_id is null or exists (select 1 from public.tasks t where t.id=task_id and t.user_id=auth.uid()))
);
create policy "owner_delete" on public.call_activities for delete using (auth.uid() = user_id);

comment on table public.inbox_captures is 'Capture universelle analysée avant toute écriture dans le CRM central.';
comment on table public.call_activities is 'Journal des appels natifs tel: et de leurs résultats, sans téléphonie ni enregistrement.';
comment on column public.tasks.action_type is 'Action exécutable depuis la tâche : appel, SMS, courriel, document, recherche, rendez-vous ou suivi.';

notify pgrst, 'reload schema';

