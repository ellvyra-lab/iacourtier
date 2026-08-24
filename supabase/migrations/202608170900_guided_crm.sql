-- Parcours guidés vendeur/acheteur partageant une seule fiche client.

alter table public.clients
  add column if not exists roles text[] not null default array['seller']::text[];

update public.clients
set roles = array['seller']::text[]
where roles is null or cardinality(roles) = 0;

create table if not exists public.buyer_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'qualification' check (status in ('qualification', 'financing', 'active_search', 'visits', 'offer', 'conditions', 'notary', 'completed')),
  source text not null default 'manual',
  budget text,
  preapproval_status text not null default 'missing',
  sectors text[] not null default '{}'::text[],
  property_type text,
  bedrooms text,
  important_needs text,
  timeline text,
  property_to_sell boolean,
  validation_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_case_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  name text not null,
  document_type text not null default 'Autre',
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null,
  analysis_status text not null default 'analyzed',
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_case_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  category text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  validation_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_case_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  name text not null,
  status text not null default 'validation_required' check (status in ('validation_required', 'approved', 'disabled')),
  external_delivery_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, name)
);

create table if not exists public.buyer_case_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists buyer_cases_user_idx on public.buyer_cases (user_id, updated_at desc);
create index if not exists buyer_cases_contact_idx on public.buyer_cases (contact_id, updated_at desc);
create index if not exists buyer_case_documents_case_idx on public.buyer_case_documents (case_id, created_at);
create index if not exists buyer_case_tasks_case_idx on public.buyer_case_tasks (case_id, created_at);

alter table public.buyer_cases enable row level security;
alter table public.buyer_case_documents enable row level security;
alter table public.buyer_case_tasks enable row level security;
alter table public.buyer_case_automations enable row level security;
alter table public.buyer_case_activity enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'buyer_cases', 'buyer_case_documents', 'buyer_case_tasks',
    'buyer_case_automations', 'buyer_case_activity'
  ] loop
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
