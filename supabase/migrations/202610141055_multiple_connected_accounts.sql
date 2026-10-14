-- Preserve account IDs, encrypted tokens, references and action history.
begin;
alter table public.connected_accounts drop constraint connected_accounts_user_id_provider_key;
alter table public.connected_accounts add constraint connected_accounts_identity_key unique(user_id,provider,provider_subject);
alter table public.connected_accounts drop constraint connected_accounts_status_check;
alter table public.connected_accounts add constraint connected_accounts_status_check check(status in ('connected','reconnect','disconnected'));
alter table public.connected_accounts add column connected_at timestamptz;
alter table public.connected_accounts add column reconnected_at timestamptz;
alter table public.connected_accounts add column disconnected_at timestamptz;
alter table public.connected_accounts add column token_version integer not null default 1 check(token_version in (1,2));
-- The historical schema did not store an initial connection date: leave it unknown.
create table public.connected_account_defaults (
 user_id uuid not null references auth.users(id) on delete cascade,
 service text not null check(service in ('email','calendar','contacts')),
 account_id uuid not null,
 primary key(user_id,service),
 foreign key(account_id,user_id) references public.connected_accounts(id,user_id) on delete cascade
);
insert into public.connected_account_defaults(user_id,service,account_id)
select distinct on (user_id,service) user_id,service,id
from public.connected_accounts cross join (values ('email'),('calendar')) as services(service)
where status='connected' and
 ((service='email' and (scopes like '%gmail.readonly%' or scopes ilike '%Mail.ReadWrite%')) or
 (service='calendar' and (scopes like '%calendar.events%' or scopes ilike '%Calendars.ReadWrite%')))
order by user_id,service,updated_at,id;
alter table public.connection_oauth_states add column requested_scopes text;
alter table public.connection_oauth_states add column account_id uuid;
alter table public.connection_oauth_states add constraint oauth_account_owner_fk foreign key(account_id,user_id) references public.connected_accounts(id,user_id) on delete cascade;
alter table public.connected_account_defaults enable row level security;
revoke all on public.connected_account_defaults from public,anon,authenticated;
grant all on public.connected_account_defaults to service_role;
create index connected_accounts_owner_status_idx on public.connected_accounts(user_id,status);
notify pgrst, 'reload schema';
commit;
