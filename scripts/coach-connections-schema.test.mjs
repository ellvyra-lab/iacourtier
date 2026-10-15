import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE);
test('055C PostgreSQL : fil, message et compte liés au même propriétaire; coffre privé',async()=>{
 const db=new PGlite();
 const u1='10000000-0000-4000-8000-000000000001',u2='10000000-0000-4000-8000-000000000002';
 const c1='20000000-0000-4000-8000-000000000001',c2='20000000-0000-4000-8000-000000000002';
 const m1='30000000-0000-4000-8000-000000000001',m2='30000000-0000-4000-8000-000000000002';
 const a1='40000000-0000-4000-8000-000000000001',r1='50000000-0000-4000-8000-000000000001';
 try {
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.clients(id uuid primary key);create table public.client_cases(id uuid primary key);create table public.properties(id uuid primary key);create table public.tasks(id uuid primary key);create table public.coach_conversations(id uuid primary key,user_id uuid,unique(id,user_id));create table public.coach_messages(id uuid primary key,user_id uuid,conversation_id uuid);');
  await db.exec(readFileSync('supabase/migrations/202609221055_connected_assistant.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/202610141055_multiple_connected_accounts.sql','utf8'));
  await db.query('insert into auth.users values($1),($2)',[u1,u2]);
  await db.query('insert into coach_conversations values($1,$2),($3,$4)',[c1,u1,c2,u2]);
  await db.query('insert into coach_messages values($1,$2,$3),($4,$5,$6)',[m1,u1,c1,m2,u2,c2]);
  await db.query("insert into connected_accounts(id,user_id,provider,provider_subject,email,encrypted_tokens,scopes) values($1,$2,'google','existing','fixture@example.test','cipher unchanged','openid email')",[a1,u1]);
  await db.exec(readFileSync('supabase/migrations/202610141100_coach_connection_requests.sql','utf8'));
  assert.equal((await db.query('select encrypted_tokens from connected_accounts where id=$1',[a1])).rows[0].encrypted_tokens,'cipher unchanged');
  const insert=(id,user,conversation,message,account)=>db.query("insert into coach_connection_requests(id,user_id,conversation_id,source_message_id,provider,action,services,account_id) values($1,$2,$3,$4,'google','connect',array['email'],$5)",[id,user,conversation,message,account]);
  await insert(r1,u1,c1,m1,a1);
  assert.equal((await db.query('select status from coach_connection_requests')).rows[0].status,'offered');
  await assert.rejects(insert('50000000-0000-4000-8000-000000000002',u2,c1,m2,null),/foreign key/);
  await assert.rejects(insert('50000000-0000-4000-8000-000000000003',u1,c1,m2,a1),/foreign key/);
  await assert.rejects(insert('50000000-0000-4000-8000-000000000004',u2,c2,m2,a1),/foreign key/);
  await assert.rejects(db.query("insert into connection_oauth_states(id,user_id,provider,verifier,expires_at,coach_request_id) values('state',$1,'google','pkce',now()+interval '10 minutes',$2)",[u2,r1]),/foreign key/);
  assert.equal((await db.query("select relrowsecurity from pg_class where relname='coach_connection_requests'")).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from coach_connection_requests'),/permission denied/);
   await assert.rejects(db.query("update coach_connection_requests set status='verified'"),/permission denied/);
   await db.exec('reset role');
  }
 } finally {await db.close();}
});
