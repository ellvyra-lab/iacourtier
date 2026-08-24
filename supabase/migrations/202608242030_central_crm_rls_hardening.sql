-- TICKET #047 — durcissement multilocataire des relations du CRM central.
-- L'utilisateur doit posséder la ligne ET chaque entité référencée.

drop policy if exists "owner_insert" on public.client_cases;
drop policy if exists "owner_update" on public.client_cases;
create policy "owner_insert" on public.client_cases for insert with check (
  auth.uid() = user_id
  and (primary_client_id is null or exists (select 1 from public.clients c where c.id=primary_client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.client_cases for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (primary_client_id is null or exists (select 1 from public.clients c where c.id=primary_client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);

drop policy if exists "owner_insert" on public.client_case_clients;
drop policy if exists "owner_update" on public.client_case_clients;
create policy "owner_insert" on public.client_case_clients for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
);
create policy "owner_update" on public.client_case_clients for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
);

drop policy if exists "owner_insert" on public.client_properties;
drop policy if exists "owner_update" on public.client_properties;
create policy "owner_insert" on public.client_properties for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
);
create policy "owner_update" on public.client_properties for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid())
  and exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid())
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
);

do $$
declare table_name text;
begin
  foreach table_name in array array['documents','tasks','automations','communications','appointments','activity_events'] loop
    execute format('drop policy if exists "owner_insert" on public.%I', table_name);
    execute format('drop policy if exists "owner_update" on public.%I', table_name);
    execute format(
      'create policy "owner_insert" on public.%I for insert with check (
        auth.uid() = user_id
        and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
        and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
      )', table_name
    );
    execute format(
      'create policy "owner_update" on public.%I for update using (auth.uid() = user_id) with check (
        auth.uid() = user_id
        and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
        and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
      )', table_name
    );
  end loop;
end $$;

-- Les tables qui portent une propriété valident aussi son propriétaire.
drop policy if exists "owner_insert" on public.documents;
drop policy if exists "owner_update" on public.documents;
create policy "owner_insert" on public.documents for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.documents for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid())
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);

drop policy if exists "owner_insert" on public.appointments;
drop policy if exists "owner_update" on public.appointments;
create policy "owner_insert" on public.appointments for insert with check (
  auth.uid() = user_id
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);
create policy "owner_update" on public.appointments for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (case_id is null or exists (select 1 from public.client_cases d where d.id=case_id and d.user_id=auth.uid()))
  and (client_id is null or exists (select 1 from public.clients c where c.id=client_id and c.user_id=auth.uid()))
  and (property_id is null or exists (select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
);

notify pgrst, 'reload schema';
