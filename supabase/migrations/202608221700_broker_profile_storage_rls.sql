-- Repair Storage access for professional-profile assets when the bucket was
-- created manually or before the RLS policies were applied.
--
-- Every object must live under: broker-profile-assets/{auth.uid()}/...

begin;

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
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets insert own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "broker profile assets delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'broker-profile-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
