-- Apply 202609221055_connected_assistant.sql first if it has not been applied.
-- Reuse the token vault and the central crm_events/tasks/automations tables.
begin;
create index if not exists connection_oauth_states_expiration on public.connection_oauth_states(expires_at);
create index if not exists connected_references_owner_thread on public.connected_references(user_id,account_id,thread_id);
create index if not exists crm_events_connection_queue on public.crm_events(user_id,event_type,status,occurred_at)
where event_type in ('email_received','email_reply_needed','email_received_from_client','calendar_event_created','calendar_event_updated');
-- Defense in depth: no browser role can read tokens or forge executable previews.
do $$ declare t text; begin
 foreach t in array array['connected_accounts','connection_oauth_states','connected_actions','connection_audit','connected_references','connected_alerts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
