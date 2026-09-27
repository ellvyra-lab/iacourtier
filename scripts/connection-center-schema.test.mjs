import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const PGlite=process.env.PGLITE_MODULE?(await import(process.env.PGLITE_MODULE)).PGlite:null;
test('055 vault and 056 indexes: browser roles cannot access tokens or forge executable actions',{skip:!PGlite},async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.clients(id uuid primary key);create table public.client_cases(id uuid primary key);create table public.properties(id uuid primary key);create table public.tasks(id uuid primary key);create table public.coach_conversations(id uuid primary key,user_id uuid,unique(id,user_id));create table public.crm_events(user_id uuid,event_type text,status text,occurred_at timestamptz);`);
  await db.exec(readFileSync('supabase/migrations/202609221055_connected_assistant.sql','utf8'));
  const sql=readFileSync('supabase/migrations/202609261056_connection_center.sql','utf8');await db.exec(sql);await db.exec(sql);
  for(const table of ['connected_accounts','connection_oauth_states','connected_actions','connection_audit','connected_references','connected_alerts']){
   assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1',[table])).rows[0].relrowsecurity,true);
   for(const role of ['authenticated','anon']){await db.exec('set role '+role);await assert.rejects(db.query('select * from public.'+table),/permission denied/);await db.exec('reset role');}
  }
  assert.equal((await db.query("select count(*)::int as n from pg_indexes where indexname in ('connection_oauth_states_expiration','connected_references_owner_thread','crm_events_connection_queue')")).rows[0].n,3);
 }finally{await db.close();}
});
