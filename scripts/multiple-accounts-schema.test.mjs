import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE);
test('055B SQL réel : migration sans perte, identités uniques, défauts isolés et coffre privé',async()=>{
 const db=new PGlite();
 const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
 const first='20000000-0000-4000-8000-000000000001',second='20000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.clients(id uuid primary key);create table public.client_cases(id uuid primary key);create table public.properties(id uuid primary key);create table public.tasks(id uuid primary key);create table public.coach_conversations(id uuid primary key,user_id uuid,unique(id,user_id));`);
  await db.exec(readFileSync('supabase/migrations/202609221055_connected_assistant.sql','utf8'));
  await db.query('insert into auth.users values ($1),($2)',[owner,other]);
  await db.query("insert into connected_accounts(id,user_id,provider,provider_subject,email,encrypted_tokens,scopes) values($1,$2,'google','first','first@example.test','unchanged ciphertext','https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.events')",[first,owner]);
  await db.exec(readFileSync('supabase/migrations/202610141055_multiple_connected_accounts.sql','utf8'));
  const original=(await db.query('select * from connected_accounts where id=$1',[first])).rows[0];
  assert.equal(original.encrypted_tokens,'unchanged ciphertext');assert.equal(original.token_version,1);assert.equal(original.connected_at,null);
  assert.equal((await db.query('select * from connected_account_defaults')).rows.length,2);
  await db.query("insert into connected_accounts(id,user_id,provider,provider_subject,email,encrypted_tokens,scopes) values($1,$2,'google','second','second@example.test','second cipher','calendar.events')",[second,owner]);
  await assert.rejects(db.query("insert into connected_accounts(user_id,provider,provider_subject,email,encrypted_tokens,scopes) values($1,'google','first','renamed@example.test','x','x')",[owner]),/duplicate key/);
  await db.query("insert into connected_accounts(user_id,provider,provider_subject,email,encrypted_tokens,scopes) values($1,'google','first','first@example.test','other cipher','x')",[other]);
  await assert.rejects(db.query("insert into connected_account_defaults values($1,'contacts',$2)",[other,first]),/foreign key/);
  for(const table of ['connected_accounts','connected_account_defaults','connection_oauth_states']){
   assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1',[table])).rows[0].relrowsecurity,true);
   for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from '+table),/permission denied/);await db.exec('reset role');}
  }
 } finally {await db.close();}
});
