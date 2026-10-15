-- OAuth requests reuse the existing Coach conversations and encrypted account vault.
begin;
alter table public.coach_messages add constraint coach_messages_owner_conversation_key unique(id,user_id,conversation_id);
create table public.coach_connection_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,
 source_message_id uuid not null,
 provider text not null check(provider in ('google','microsoft')),
 action text not null check(action in ('connect','disconnect')),
 services text[] not null check(services <@ array['email','calendar','contacts']::text[]),
 account_id uuid,
 status text not null default 'offered' check(status in ('offered','pending','verifying','verified','failed','cancelled','disconnected')),
 result_message text,
 verified_at timestamptz,
 oauth_state_hash text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '1 day',
 unique(id,user_id),
 foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade,
 foreign key(source_message_id,user_id,conversation_id) references public.coach_messages(id,user_id,conversation_id) on delete cascade,
 foreign key(account_id,user_id) references public.connected_accounts(id,user_id)
);
alter table public.connection_oauth_states add column coach_request_id uuid;
alter table public.connection_oauth_states add constraint oauth_coach_request_owner_fk foreign key(coach_request_id,user_id) references public.coach_connection_requests(id,user_id) on delete cascade;
create index coach_connection_requests_owner_thread on public.coach_connection_requests(user_id,conversation_id);
create unique index coach_connection_requests_oauth_state on public.coach_connection_requests(user_id,oauth_state_hash) where oauth_state_hash is not null;
create index oauth_coach_request_idx on public.connection_oauth_states(coach_request_id) where coach_request_id is not null;
alter table public.coach_connection_requests enable row level security;
revoke all on public.coach_connection_requests from public,anon,authenticated;
grant all on public.coach_connection_requests to service_role;
notify pgrst,'reload schema';
commit;
