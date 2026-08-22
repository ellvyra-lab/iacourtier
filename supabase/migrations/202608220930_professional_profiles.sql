-- Professional identity is stored in public.profiles, one row per auth user.
-- Rich, evolving form fields live in professional_profile JSONB. Images live
-- in a private Storage bucket and JSONB stores only their object references.

begin;

alter table public.profiles
  add column if not exists professional_profile jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
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
revoke insert, update, delete on table public.profiles from authenticated;
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
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, email)
select id, raw_user_meta_data ->> 'full_name', email
from auth.users
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broker-profile-assets',
  'broker-profile-assets',
  false,
  2000000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "broker profile assets select own" on storage.objects;
drop policy if exists "broker profile assets insert own" on storage.objects;
drop policy if exists "broker profile assets update own" on storage.objects;
drop policy if exists "broker profile assets delete own" on storage.objects;

create policy "broker profile assets select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
