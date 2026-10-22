import test from 'node:test';
import assert from 'node:assert/strict';
import {loader,database} from './helpers/connected-test-harness.mjs';
const {applyCoachPageContext}=loader()('@/lib/server/coach-page-context');
const a='05900000-0000-4000-8000-000000000001',b='05900000-0000-4000-8000-000000000002';
test('page context uses owned records only and rejects direct foreign UUIDs',async()=>{
 const db=database({clients:[{id:a,user_id:a},{id:b,user_id:b}],client_cases:[{id:b,user_id:a}]});
 const context={current_client_id:b,current_case_id:b,ai_provider:'meta',current_action_id:a};
 await applyCoachPageContext(db,a,context,`/tableau-de-bord/clients/${a}`);
 assert.equal(context.current_client_id,a);assert.equal(context.current_case_id,null);
 await applyCoachPageContext(db,a,context,`/tableau-de-bord/clients/${b}`);
 assert.equal(context.current_client_id,null);assert.equal(context.ai_provider,'meta');assert.equal(context.current_action_id,a);
 await applyCoachPageContext(db,a,context,`/tableau-de-bord/dossiers/${b}`);assert.equal(context.current_case_id,b);
 await applyCoachPageContext(db,a,context,'/tableau-de-bord/coach');assert.equal(context.current_case_id,b);
 await applyCoachPageContext(db,a,context,'https://evil.invalid');assert.equal(context.page_path,'/tableau-de-bord/coach');
});
test('page context fails closed on database errors without calling an AI provider',async()=>{
 const db={from(){const q={select(){return q},eq(){return q},maybeSingle(){return {error:Error('database down')}}};return q}};
 await assert.rejects(applyCoachPageContext(db,a,{},`/tableau-de-bord/clients/${a}`),/vérifié/);
});
test('specialized seller pages recheck central case ownership instead of trusting the link',async()=>{
 const db=database({seller_listings:[{id:a,user_id:a,client_case_id:b}],client_cases:[{id:b,user_id:b}]});
 const context={current_case_id:a};
 await applyCoachPageContext(db,a,context,`/tableau-de-bord/inscriptions/${a}`);
 assert.equal(context.current_case_id,null);
 db.tables.client_cases[0].user_id=a;
 await applyCoachPageContext(db,a,context,`/tableau-de-bord/inscriptions/${a}`);
 assert.equal(context.current_case_id,b);
});
