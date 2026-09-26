import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
// Opt-in PostgreSQL engine. Point PGLITE_MODULE at an installed @electric-sql/pglite.
const PGlite=process.env.PGLITE_MODULE?(await import(process.env.PGLITE_MODULE)).PGlite:null;
test('real PostgreSQL: symmetric uniqueness, owner isolation, inverse labels storage and independent addresses',{skip:!PGlite},async()=>{
 const db=new PGlite();const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',foreign='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${owner}'),('${other}');create table public.clients(id uuid primary key,user_id uuid not null references auth.users(id),mailing_address text);alter table public.clients enable row level security;create policy owner on public.clients for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant select,insert,update on public.clients to authenticated;insert into public.clients values ('${a}','${owner}','175 des Hirondelles'),('${b}','${owner}','175 des Hirondelles'),('${foreign}','${other}','Private');`);
 const initial=readFileSync('supabase/migrations/202608251200_crm_operating_system.sql','utf8').match(/create table if not exists public\.client_relationships \([\s\S]*?\n\);/)[0];await db.exec(initial);
 const migration=readFileSync('supabase/migrations/202609231100_client_relationships.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
 await db.query('insert into public.client_relationships(user_id,client_id,related_client_id,relationship_type) values ($1,$2,$3,$4)',[owner,b,a,'spouse']);
 await assert.rejects(db.query('insert into public.client_relationships(user_id,client_id,related_client_id,relationship_type) values ($1,$2,$3,$4)',[owner,a,b,'spouse']),/unique/);
 const rows=(await db.query('select * from public.client_relationships')).rows;assert.equal(rows.length,1);assert.equal(rows[0].client_id,a);
 await assert.rejects(db.query('insert into public.client_relationships(user_id,client_id,related_client_id,relationship_type) values ($1,$2,$3,$4)',[owner,a,foreign,'spouse']),/row-level security|foreign key/);
 await assert.rejects(db.query('insert into public.client_relationships(user_id,client_id,related_client_id,relationship_type) values ($1,$2,$3,$4)',[owner,a,a,'spouse']),/distinct/);
 await db.query('update public.clients set mailing_address=$1 where id=$2',['Nouvelle adresse',a]);assert.equal((await db.query('select mailing_address from public.clients where id=$1',[b])).rows[0].mailing_address,'175 des Hirondelles');
 await db.query('insert into public.client_relationships(user_id,client_id,related_client_id,relationship_type) values ($1,$2,$3,$4)',[owner,b,a,'child']);assert.equal((await db.query("select client_id from public.client_relationships where relationship_type='parent'")).rows[0].client_id,a);
 await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from public.client_relationships')).rows.length,0);assert.equal((await db.query("update public.client_relationships set notes='forged' returning id")).rows.length,0);
 await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.client_relationships'),/permission denied/);
 }finally{await db.close();}
});
