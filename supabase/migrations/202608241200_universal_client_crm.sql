-- CRM universel : une seule fiche personne, quel que soit le parcours.
-- La table historique seller_contacts contenait déjà tous les acheteurs et
-- vendeurs. Elle est renommée sans copier ni supprimer aucune donnée.

do $$
begin
  if to_regclass('public.clients') is null and to_regclass('public.seller_contacts') is not null then
    alter table public.seller_contacts rename to clients;
  end if;
end $$;

do $$
begin
  if to_regclass('public.seller_contacts_user_idx') is not null
     and to_regclass('public.clients_user_idx') is null then
    alter index public.seller_contacts_user_idx rename to clients_user_idx;
  end if;
  if to_regclass('public.seller_contacts_email_normalized_idx') is not null
     and to_regclass('public.clients_email_normalized_idx') is null then
    alter index public.seller_contacts_email_normalized_idx rename to clients_email_normalized_idx;
  end if;
end $$;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  organization text,
  email text,
  phone text,
  partner_type text not null default 'other'
    check (partner_type in ('mortgage_broker', 'real_estate_broker', 'notary', 'inspector', 'lender', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_case_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.buyer_cases(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  role text not null default 'mortgage_broker',
  created_at timestamptz not null default now(),
  unique (case_id, partner_id, role)
);

create table if not exists public.buyer_financing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null unique references public.buyer_cases(id) on delete cascade,
  status text not null default 'missing',
  maximum_purchase_price numeric(14,2),
  down_payment numeric(14,2),
  mortgage_amount numeric(14,2),
  occupancy_type text,
  lender text,
  preapproval_date date,
  expiry_date date,
  source_document_id uuid references public.buyer_case_documents(id) on delete set null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_idx on public.clients (user_id, updated_at desc);
create index if not exists clients_email_normalized_idx
  on public.clients (user_id, lower(trim(email))) where email is not null;
create index if not exists partners_user_idx on public.partners (user_id, updated_at desc);
create index if not exists partners_email_normalized_idx
  on public.partners (user_id, lower(trim(email))) where email is not null;
create index if not exists buyer_case_partners_case_idx
  on public.buyer_case_partners (case_id, created_at);
create index if not exists buyer_financing_case_idx
  on public.buyer_financing (case_id);

alter table public.clients enable row level security;
alter table public.partners enable row level security;
alter table public.buyer_case_partners enable row level security;
alter table public.buyer_financing enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['clients', 'partners', 'buyer_case_partners', 'buyer_financing'] loop
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

comment on table public.clients is 'Fiche personne centrale partagée par les parcours acheteur, vendeur, mixte et prospect.';
comment on table public.partners is 'Professionnels externes détectés dans les documents; ils ne sont jamais créés comme clients.';
comment on table public.buyer_financing is 'Préqualification et financement structurés d’un dossier acheteur.';

notify pgrst, 'reload schema';
