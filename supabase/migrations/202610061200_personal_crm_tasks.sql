-- Personal tasks use the existing central tasks table and its owner RLS.
begin;
alter table public.tasks alter column case_id drop not null;
notify pgrst, 'reload schema';
commit;
