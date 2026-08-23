-- Reconcile the production profiles table with the schema used by IACourtier.
-- Existing production-only columns and all existing data are intentionally kept.
-- Rich professional fields live inside professional_profile JSONB; only stable
-- identity, subscription, onboarding and timestamp fields are top-level columns.

begin;

alter table public.profiles
  add column if not exists plan text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists generations_used_this_period integer,
  add column if not exists current_period_start timestamptz,
  add column if not exists professional_profile jsonb,
  add column if not exists onboarding_completed boolean,
  add column if not exists updated_at timestamptz;

-- Preserve a recognized legacy subscription value when one is available.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_plan'
  ) then
    execute $sql$
      update public.profiles
      set plan = subscription_plan
      where plan is null
        and subscription_plan in ('gratuit', 'essentiel', 'pro')
    $sql$;
  end if;
end
$$;

update public.profiles
set
  plan = coalesce(nullif(plan, ''), 'gratuit'),
  generations_used_this_period = coalesce(generations_used_this_period, 0),
  current_period_start = coalesce(current_period_start, created_at, now()),
  professional_profile = coalesce(professional_profile, '{}'::jsonb),
  onboarding_completed = coalesce(onboarding_completed, false),
  updated_at = coalesce(updated_at, created_at, now())
where plan is null
   or plan = ''
   or generations_used_this_period is null
   or current_period_start is null
   or professional_profile is null
   or onboarding_completed is null
   or updated_at is null;

alter table public.profiles
  alter column plan set default 'gratuit',
  alter column plan set not null,
  alter column generations_used_this_period set default 0,
  alter column generations_used_this_period set not null,
  alter column current_period_start set default now(),
  alter column current_period_start set not null,
  alter column professional_profile set default '{}'::jsonb,
  alter column professional_profile set not null,
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check
      check (plan in ('gratuit', 'essentiel', 'pro'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$$;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Les utilisateurs voient leur propre profil" on public.profiles;
drop policy if exists "Les utilisateurs créent leur propre profil" on public.profiles;
drop policy if exists "Les utilisateurs modifient leur propre profil" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, full_name, email, professional_profile, onboarding_completed, updated_at)
  on table public.profiles to authenticated;
grant update (id, full_name, email, professional_profile, onboarding_completed, updated_at)
  on table public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, email)
select id, raw_user_meta_data ->> 'full_name', coalesce(email, '')
from auth.users
on conflict (id) do nothing;

-- Ask PostgREST to refresh immediately so newly added columns are available to
-- /rest/v1/profiles without waiting for its normal schema-cache refresh cycle.
notify pgrst, 'reload schema';

commit;

