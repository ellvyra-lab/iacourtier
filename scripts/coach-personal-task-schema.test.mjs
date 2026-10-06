// PostgreSQL local only; hosted Supabase acceptance requires an authenticated session.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
test('existing task schema reproduces 23502; migration allows personal tasks and keeps owner RLS', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub')::uuid$$;
      grant usage on schema auth to authenticated;
      create table public.clients(id uuid primary key); create table public.client_cases(id uuid primary key);
      insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
    const original = readFileSync('supabase/migrations/202608241900_central_crm_cases.sql','utf8');
    await db.exec(original.match(/create table if not exists public\.tasks \([\s\S]*?\n\);/)[0]);
    await assert.rejects(db.exec(`insert into tasks(user_id,title) values ('11111111-1111-4111-8111-111111111111','Contacter Martin')`), e => e.code === '23502');
    const migration = readFileSync('supabase/migrations/202610061200_personal_crm_tasks.sql','utf8');
    await db.exec(migration); await db.exec(migration);
    await db.exec(`alter table tasks enable row level security; grant select,insert,update on tasks to authenticated;
      create policy owner_select on tasks for select using(auth.uid()=user_id);
      create policy owner_insert on tasks for insert with check(auth.uid()=user_id);
      create policy owner_update on tasks for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
      set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      insert into tasks(user_id,title) values ('11111111-1111-4111-8111-111111111111','Appeler le notaire');`);
    assert.equal((await db.query('select * from tasks')).rows.length,1);
    await db.exec(`select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);`);
    assert.equal((await db.query('select * from tasks')).rows.length,0);
    await assert.rejects(db.exec(`insert into tasks(user_id,title) values ('11111111-1111-4111-8111-111111111111','forged')`), /row-level security/);
  } finally { await db.close(); }
});
