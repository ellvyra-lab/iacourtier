-- Extend the existing central relationship table from 202608251200.
-- Participants remain exclusively in client_case_clients. No client merging.
begin;
lock table public.client_relationships in share row exclusive mode;
create or replace function public.normalize_client_relationship() returns trigger
language plpgsql set search_path=public as $$
declare swap_id uuid;
begin
 if new.client_id=new.related_client_id then raise exception 'Two distinct contacts are required'; end if;
 if new.relationship_type not in ('spouse','partner','ex_spouse','family','parent','child','business_partner','co_owner','other') then raise exception 'Invalid relationship type'; end if;
 if new.relationship_type='child' then
   swap_id:=new.client_id; new.client_id:=new.related_client_id; new.related_client_id:=swap_id; new.relationship_type:='parent';
 elsif new.relationship_type<>'parent' and new.client_id>new.related_client_id then
   swap_id:=new.client_id; new.client_id:=new.related_client_id; new.related_client_id:=swap_id;
 end if;
 new.updated_at:=now();
 return new;
end $$;
-- Never silently discard existing links or notes. Abort on historical duplicates.
do $$ begin
 if exists(select 1 from public.client_relationships group by user_id,least(client_id,related_client_id),greatest(client_id,related_client_id),case when relationship_type='child' then 'parent' else relationship_type end having count(*)>1) then
   raise exception 'Historical duplicate relationships require review before migration; no data changed';
 end if;
end $$;
drop trigger if exists normalize_client_relationship on public.client_relationships;
create trigger normalize_client_relationship before insert or update on public.client_relationships for each row execute function public.normalize_client_relationship();
update public.client_relationships set relationship_type=relationship_type where relationship_type in ('spouse','partner','ex_spouse','family','parent','child','business_partner','co_owner','other');
create unique index if not exists client_relationships_unordered_unique on public.client_relationships(user_id,least(client_id,related_client_id),greatest(client_id,related_client_id),relationship_type);
create index if not exists client_relationships_related_idx on public.client_relationships(user_id,related_client_id);
create unique index if not exists clients_relationship_owner_key on public.clients(id,user_id);
alter table public.client_relationships drop constraint if exists client_relationships_first_owner_fk;
alter table public.client_relationships add constraint client_relationships_first_owner_fk foreign key(client_id,user_id) references public.clients(id,user_id) on delete cascade;
alter table public.client_relationships drop constraint if exists client_relationships_second_owner_fk;
alter table public.client_relationships add constraint client_relationships_second_owner_fk foreign key(related_client_id,user_id) references public.clients(id,user_id) on delete cascade;
alter table public.client_relationships enable row level security;
drop policy if exists relationship_owner_guard on public.client_relationships;
create policy relationship_owner_guard on public.client_relationships as restrictive for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()) and exists(select 1 from public.clients c where c.id=related_client_id and c.user_id=auth.uid()));
drop policy if exists relationship_owner_access on public.client_relationships;
create policy relationship_owner_access on public.client_relationships for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.client_relationships from public,anon;
grant select,insert,update,delete on public.client_relationships to authenticated;
grant all on public.client_relationships to service_role;
notify pgrst,'reload schema';
commit;
