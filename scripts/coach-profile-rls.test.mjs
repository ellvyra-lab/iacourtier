// Real local PostgreSQL authorization; not two hosted GoTrue sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {loader} from './helpers/connected-test-harness.mjs';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
test('059 actual profile RLS + server lookup isolate two PostgreSQL identities without any beta database',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to authenticated;`);
  const source=readFileSync('supabase/schema.sql','utf8');
  const profileSQL=source.match(/create table if not exists public\.profiles\s*\([\s\S]+?create policy "Les utilisateurs modifient leur propre profil"[\s\S]+?using \(auth\.uid\(\) = id\);/);
  assert.ok(profileSQL,'Existing profile DDL and policies must be tested, not duplicated.');
  await db.exec(profileSQL[0]);await db.exec('grant select,update on public.profiles to authenticated;');
  const a=randomUUID(),b=randomUUID();
  await db.query('insert into auth.users(id) values ($1),($2)',[a,b]);
  for(const [id,name,agency]of [[a,'Courtier A','Agence A'],[b,'Courtier B','Agence B']])await db.query('insert into public.profiles(id,professional_profile) values ($1,$2)',[id,JSON.stringify({fullName:name,agencyName:agency,phone:id===a?'514-555-0101':'450-555-0199'})]);
  const scoped={from(table){assert.equal(table,'profiles');let id;const q={select(){return q;},eq(column,value){assert.equal(column,'id');id=value;return q;},async single(){const {rows}=await db.query('select professional_profile,full_name,email,updated_at from public.profiles where id=$1',[id]);return {data:rows[0]||null,error:rows.length?null:Error('No visible profile')};}};return q;}};
  const {readProfessionalProfile}=loader()('@/lib/server/coach-professional-context');
  await db.exec('set role authenticated;');
  for(const [owner,other,name,agency]of [[a,b,'Courtier A','Agence B'],[b,a,'Courtier B','Agence A']]){
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
   const scope={db:scoped,userId:owner,context:{},text:'Mes coordonnées',conversationId:randomUUID(),messageId:randomUUID()};
   const result=await readProfessionalProfile(scope,{tool:'get_professional_profile'});assert.ok(result.text.includes(name));assert.ok(!result.text.includes(agency));
   assert.equal((await db.query('select id from public.profiles')).rows.length,1);
   assert.equal((await db.query("update public.profiles set full_name='forged' where id=$1 returning id",[other])).rows.length,0);
   await assert.rejects(readProfessionalProfile({...scope,userId:other},{tool:'get_professional_profile'}),/profil professionnel n’a pas pu être chargé/);
  }
 }finally{await db.close();}
});
