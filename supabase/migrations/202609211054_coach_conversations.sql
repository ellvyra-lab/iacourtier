-- Conversation metadata only. Business entities remain in the central CRM.
begin;
create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context jsonb not null default '{}',
  pending jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table if not exists public.coach_messages (
  id uuid primary key,
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check(length(text) between 1 and 12000),
  reply jsonb,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade
);
create index if not exists coach_messages_history on public.coach_messages(conversation_id,created_at);
create table if not exists public.coach_action_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conversation_id uuid not null,
  message_id uuid not null references public.coach_messages(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  status text not null default 'started' check(status in ('started','completed','failed')),
  source text not null default 'coach_ai' check(source='coach_ai'),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id)
);
create table if not exists public.coach_processing_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_action_audit enable row level security;
alter table public.coach_processing_locks enable row level security;
-- Explicit privileges: do not depend on the project's default table grants.
grant usage on schema public to authenticated;
revoke all on public.coach_conversations, public.coach_messages, public.coach_action_audit, public.coach_processing_locks from public, anon, authenticated;
grant select, insert, update, delete on public.coach_conversations, public.coach_messages to authenticated;
grant select, insert, update on public.coach_action_audit to authenticated;
grant all on public.coach_conversations, public.coach_messages, public.coach_action_audit, public.coach_processing_locks to service_role;
create index if not exists coach_conversations_owner_updated on public.coach_conversations(user_id,updated_at desc);
create index if not exists coach_messages_owner_history on public.coach_messages(user_id,conversation_id,created_at desc);
create index if not exists coach_action_audit_owner on public.coach_action_audit(user_id,conversation_id);
-- Reapplying this same migration must also repair privileges and policies.
drop policy if exists coach_conversations_owner on public.coach_conversations;
drop policy if exists coach_messages_owner on public.coach_messages;
drop policy if exists coach_audit_owner on public.coach_action_audit;
drop policy if exists coach_conversations_owner_guard on public.coach_conversations;
drop policy if exists coach_messages_owner_guard on public.coach_messages;
drop policy if exists coach_audit_owner_guard on public.coach_action_audit;
create policy coach_conversations_owner_guard on public.coach_conversations as restrictive for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy coach_messages_owner_guard on public.coach_messages as restrictive for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy coach_audit_owner_guard on public.coach_action_audit as restrictive for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy coach_conversations_owner on public.coach_conversations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy coach_messages_owner on public.coach_messages for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy coach_audit_owner on public.coach_action_audit for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Serialize a user's coach writes across tabs/conversations; never accept a user id.
create or replace function public.claim_coach_lock(lock_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.coach_processing_locks(user_id,token,expires_at)
    values(auth.uid(),lock_token,now()+interval '3 minutes')
    on conflict(user_id) do update set token=excluded.token,expires_at=excluded.expires_at
    where coach_processing_locks.expires_at < now();
  return found;
end $$;
create or replace function public.release_coach_lock(lock_token uuid) returns void
language sql security definer set search_path=public as $$
  delete from public.coach_processing_locks where user_id=auth.uid() and token=lock_token;
$$;
revoke all on function public.claim_coach_lock(uuid) from public,anon;
revoke all on function public.release_coach_lock(uuid) from public,anon;
grant execute on function public.claim_coach_lock(uuid) to authenticated;
grant execute on function public.release_coach_lock(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
