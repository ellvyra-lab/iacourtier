-- Tokens, OAuth attempts and executable previews are service-role only.
-- The browser may never forge an approved action by writing its JSON payload.
create table public.connected_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('google','microsoft')),
 provider_subject text not null,
 email text not null,
 encrypted_tokens text not null,
 scopes text not null,
 status text not null default 'connected' check(status in ('connected','reconnect')),
 updated_at timestamptz not null default now(),
 unique(user_id,provider), unique(id,user_id)
);
create table public.connection_oauth_states (
 id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null, verifier text not null, expires_at timestamptz not null
);
create table public.connected_actions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null,
 conversation_id uuid not null,
 source_message_id uuid not null,
 kind text not null check(kind in ('email','event_create','event_update','event_delete','crm_update')),
 payload jsonb not null,
 status text not null default 'preview' check(status in ('preview','executing','completed','uncertain','cancelled')),
 result jsonb,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '1 day',
 foreign key(account_id,user_id) references public.connected_accounts(id,user_id) on delete cascade,
 foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade,
 unique(user_id,source_message_id,kind)
);
create table public.connection_audit (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null, action text not null, entity text, source_message_id uuid,
 status text not null, created_at timestamptz not null default now()
);
-- Local opaque references avoid exposing provider IDs in action requests.
create table public.connected_references (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null, kind text not null check(kind in ('email','event')),
 remote_id text not null, thread_id text,
 client_id uuid references public.clients(id) on delete set null,
 case_id uuid references public.client_cases(id) on delete set null,
 property_id uuid references public.properties(id) on delete set null,
 match_status text not null default 'unverified',
 foreign key(account_id,user_id) references public.connected_accounts(id,user_id) on delete cascade,
 unique(account_id,kind,remote_id)
);
create table public.connected_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null, thread_id text not null,
 reference_id uuid references public.connected_references(id) on delete cascade,
 severity text not null check(severity in ('urgent','reply')),
 title text not null, status text not null default 'open' check(status in ('open','resolved')),
 updated_at timestamptz not null default now(),
 foreign key(account_id,user_id) references public.connected_accounts(id,user_id) on delete cascade,
 unique(account_id,thread_id)
);
do $$ declare t text; begin
 foreach t in array array['connected_accounts','connection_oauth_states','connected_actions','connection_audit','connected_references','connected_alerts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create index connected_actions_owner on public.connected_actions(user_id,conversation_id,created_at desc);
create index connection_audit_owner on public.connection_audit(user_id,created_at desc);
alter table public.tasks add column if not exists followup_condition jsonb;
