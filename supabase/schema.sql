-- ============================================================
-- IACourtier.ca — Schéma de base de données (Supabase / Postgres)
-- ============================================================
-- Comment l'exécuter :
--   1. Dans votre projet Supabase, allez dans "SQL Editor"
--   2. Collez ce fichier en entier, cliquez "Run"
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — un profil par utilisateur, créé automatiquement
--    à l'inscription. Contient le forfait et les compteurs.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  plan text not null default 'gratuit' check (plan in ('gratuit', 'essentiel', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  generations_used_this_period integer not null default 0,
  current_period_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Les utilisateurs voient leur propre profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Les utilisateurs modifient leur propre profil"
  on public.profiles for update
  using (auth.uid() = id);

-- Crée automatiquement un profil "gratuit" à chaque inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. GENERATIONS — l'historique de chaque résultat généré par
--    un Assistant IA, pour chaque utilisateur.
-- ------------------------------------------------------------
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_slug text not null,
  assistant_title text not null,
  input jsonb not null,
  output text,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "Les utilisateurs voient leurs propres générations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Les utilisateurs créent leurs propres générations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Les utilisateurs suppriment leurs propres générations"
  on public.generations for delete
  using (auth.uid() = user_id);

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);

-- ------------------------------------------------------------
-- 3. Limites par forfait (référence pour l'API — pas une table,
--    juste la règle appliquée dans /api/generate) :
--      gratuit   → 10 générations / mois
--      essentiel → 200 générations / mois
--      pro       → illimité
-- ------------------------------------------------------------
