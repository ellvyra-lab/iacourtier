-- TICKET #043 - Dossier vendeur réel, documents privés et contenus validés.

create table if not exists public.seller_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  mailing_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null default '',
  city text not null default '',
  postal_code text,
  property_type text,
  lot_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'review', 'prepared', 'published', 'completed')),
  validation_required boolean not null default true,
  generated_content jsonb not null default '{}'::jsonb,
  branding_snapshot jsonb not null default '{}'::jsonb,
  prepared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_listing_parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  contact_id uuid not null references public.seller_contacts(id) on delete cascade,
  role text not null default 'seller' check (role in ('seller', 'owner')),
  created_at timestamptz not null default now(),
  unique (listing_id, contact_id, role)
);

create table if not exists public.seller_listing_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  name text not null,
  document_type text not null default 'Autre',
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null,
  analysis_status text not null default 'analyzed' check (analysis_status in ('pending', 'analyzed', 'needs_review', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.seller_listing_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  fact_key text not null,
  label text not null,
  value text not null default '',
  status text not null default 'to_confirm' check (status in ('confirmed', 'to_confirm', 'missing')),
  source_document_id uuid references public.seller_listing_documents(id) on delete set null,
  source_label text not null default 'Saisie du courtier',
  confidence numeric(4,3),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_listing_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null,
  category text not null default 'other',
  position integer not null default 0,
  is_cover boolean not null default false,
  is_virtual_staging boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_listing_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  category text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  validation_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_listing_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  name text not null,
  status text not null default 'validation_required' check (status in ('validation_required', 'approved', 'disabled')),
  external_delivery_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, name)
);

create table if not exists public.seller_listing_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.seller_listings(id) on delete cascade,
  event_type text not null,
  title text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists seller_contacts_user_idx on public.seller_contacts (user_id, updated_at desc);
create index if not exists properties_user_idx on public.properties (user_id, updated_at desc);
create index if not exists seller_listings_user_idx on public.seller_listings (user_id, updated_at desc);
create index if not exists seller_listing_facts_listing_idx on public.seller_listing_facts (listing_id, fact_key);
create index if not exists seller_listing_documents_listing_idx on public.seller_listing_documents (listing_id, created_at);
create index if not exists seller_listing_media_listing_idx on public.seller_listing_media (listing_id, position);

alter table public.seller_contacts enable row level security;
alter table public.properties enable row level security;
alter table public.seller_listings enable row level security;
alter table public.seller_listing_parties enable row level security;
alter table public.seller_listing_documents enable row level security;
alter table public.seller_listing_facts enable row level security;
alter table public.seller_listing_media enable row level security;
alter table public.seller_listing_tasks enable row level security;
alter table public.seller_listing_automations enable row level security;
alter table public.seller_listing_activity enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'seller_contacts', 'properties', 'seller_listings', 'seller_listing_parties',
    'seller_listing_documents', 'seller_listing_facts', 'seller_listing_media',
    'seller_listing_tasks', 'seller_listing_automations', 'seller_listing_activity'
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-listing-files',
  'seller-listing-files',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "seller files read" on storage.objects;
drop policy if exists "seller files insert" on storage.objects;
drop policy if exists "seller files update" on storage.objects;
drop policy if exists "seller files delete" on storage.objects;

create policy "seller files read" on storage.objects for select
  using (bucket_id = 'seller-listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller files insert" on storage.objects for insert
  with check (bucket_id = 'seller-listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller files update" on storage.objects for update
  using (bucket_id = 'seller-listing-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'seller-listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller files delete" on storage.objects for delete
  using (bucket_id = 'seller-listing-files' and (storage.foldername(name))[1] = auth.uid()::text);
