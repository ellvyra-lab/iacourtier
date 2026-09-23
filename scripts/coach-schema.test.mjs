// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Executes real PostgreSQL policies locally; does not certify a hosted Supabase deployment.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
test('migration replay, explicit privileges, ownership, context, history and locks', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
    const sql = readFileSync('supabase/migrations/202609211054_coach_conversations.sql','utf8');
    await db.exec(sql); await db.exec(sql);
    const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
    const login = async id => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
    await login(a);
    const c = (await db.query('insert into public.coach_conversations(user_id) values ($1) returning id',[a])).rows[0].id;
    const second = (await db.query('insert into public.coach_conversations(user_id) values ($1) returning id,context',[a])).rows[0];
    assert.notEqual(c,second.id); assert.deepEqual(second.context,{});
    await db.query(`update public.coach_conversations set context='{"current_client_id":"saved"}' where id=$1`,[c]);
    await db.query(`insert into public.coach_messages(id,user_id,conversation_id,text) values (gen_random_uuid(),$1,$2,'Bonjour')`,[a,c]);
    await db.query(`update public.coach_messages set reply='{"text":"Réponse persistée"}', status='completed' where conversation_id=$1`,[c]);
    await login(b);
    assert.equal((await db.query('select * from public.coach_conversations')).rows.length,0);
    assert.equal((await db.query('select * from public.coach_messages')).rows.length,0);
    assert.equal((await db.query('update public.coach_conversations set context=\'{}\' where id=$1 returning id',[c])).rows.length,0);
    assert.equal((await db.query('update public.coach_messages set text=\'forged\' returning id')).rows.length,0);
    await assert.rejects(db.query('insert into public.coach_conversations(user_id) values ($1)',[a]),/row-level security/);
    await assert.rejects(db.query(`insert into public.coach_messages(id,user_id,conversation_id,text) values (gen_random_uuid(),$1,$2,'forged')`,[a,c]),/row-level security/);
    await assert.rejects(db.query(`insert into public.coach_messages(id,user_id,conversation_id,text) values (gen_random_uuid(),$1,$2,'forged')`,[b,c]),/foreign key/);
    await login(a);
    assert.equal((await db.query('select context from public.coach_conversations where id=$1',[c])).rows[0].context.current_client_id,'saved');
    assert.equal((await db.query('select reply from public.coach_messages where conversation_id=$1',[c])).rows[0].reply.text,'Réponse persistée');
    const token='33333333-3333-4333-8333-333333333333';
    assert.equal((await db.query('select public.claim_coach_lock($1) as acquired',[token])).rows[0].acquired,true);
    assert.equal((await db.query('select public.claim_coach_lock($1) as acquired',[token])).rows[0].acquired,false);
    await db.query('select public.release_coach_lock($1)',[token]);
    assert.equal((await db.query('select public.claim_coach_lock($1) as acquired',[token])).rows[0].acquired,true);
    await assert.rejects(db.query('select * from public.coach_processing_locks'),/permission denied/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.coach_conversations'),/permission denied/);
  } finally { await db.close(); }
});
