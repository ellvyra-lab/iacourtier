-- Read-only inventory. Run in the SQL editor of the same Supabase project as the app.
with expected(table_name,column_name) as (values
 ('coach_conversations','id'),('coach_conversations','user_id'),('coach_conversations','context'),('coach_conversations','pending'),('coach_conversations','created_at'),('coach_conversations','updated_at'),
 ('coach_messages','id'),('coach_messages','conversation_id'),('coach_messages','user_id'),('coach_messages','text'),('coach_messages','reply'),('coach_messages','status'),('coach_messages','created_at'),
 ('coach_action_audit','id'),('coach_action_audit','user_id'),('coach_action_audit','conversation_id'),('coach_action_audit','message_id'),('coach_action_audit','action'),('coach_action_audit','entity_type'),('coach_action_audit','entity_id'),('coach_action_audit','before_value'),('coach_action_audit','after_value'),('coach_action_audit','status'),('coach_action_audit','source'),('coach_action_audit','created_at'),
 ('coach_processing_locks','user_id'),('coach_processing_locks','token'),('coach_processing_locks','expires_at'))
select e.*, c.data_type, c.is_nullable, c.column_default,
 case when c.column_name is null then 'MISSING' else 'PRESENT' end as status
from expected e left join information_schema.columns c on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name order by 1,2;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('coach_conversations','coach_messages','coach_action_audit','coach_processing_locks');
select * from pg_policies where schemaname='public' and tablename like 'coach_%';
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'coach_%';
select routine_name from information_schema.routines where routine_schema='public' and routine_name in ('claim_coach_lock','release_coach_lock');
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'coach_%';
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and conrelid in (to_regclass('public.coach_conversations'),to_regclass('public.coach_messages'),to_regclass('public.coach_action_audit'),to_regclass('public.coach_processing_locks'));
