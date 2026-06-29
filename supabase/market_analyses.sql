-- IACourtier - Assistant Analyse comparative
-- A executer dans Supabase SQL Editor si la table n'existe pas encore.

create table if not exists public.market_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mandat_id text,
  source_type text default 'pdf',
  file_name text,
  extracted_text text,
  subject_property jsonb,
  comparables jsonb default '[]'::jsonb,
  objective text,
  style text,
  generated_text text not null,
  created_at timestamptz default now()
);

alter table public.market_analyses enable row level security;

create policy "Les utilisateurs voient leurs analyses de marche"
  on public.market_analyses for select
  using (auth.uid() = user_id);

create policy "Les utilisateurs creent leurs analyses de marche"
  on public.market_analyses for insert
  with check (auth.uid() = user_id);

create policy "Les utilisateurs suppriment leurs analyses de marche"
  on public.market_analyses for delete
  using (auth.uid() = user_id);

create index if not exists market_analyses_user_id_created_at_idx
  on public.market_analyses (user_id, created_at desc);

create index if not exists market_analyses_mandat_id_idx
  on public.market_analyses (mandat_id);
