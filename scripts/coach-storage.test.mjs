import test from 'node:test';
import assert from 'node:assert/strict';
import { loader, database } from './helpers/connected-test-harness.mjs';
const load = loader();
const { coachStorageError } = load('@/lib/server/coach-storage-error');
test('API creates distinct owned conversations and restores only owned history',async()=>{
  const db=database();let owner='owner';db.auth={getUser:async()=>({data:{user:owner?{id:owner}:null}})};
  const route=loader({'@/lib/supabase/server':{createSupabaseServerClient:async()=>db},'@/lib/server/connections/coach-connected':{connectedCoachHandlers:{}}})('@/app/api/coach/conversation/route');
  const create=()=>route.POST(new Request('https://example.test/api/coach/conversation',{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({action:'new',user_id:'forged'})}));
  const first=await (await create()).json(), second=await (await create()).json();
  assert.notEqual(first.id,second.id);assert.equal(db.tables.coach_conversations[0].user_id,'owner');
  db.tables.coach_messages=[{id:'message',conversation_id:first.id,user_id:'owner',text:'Bonjour',reply:{text:'Persisté',cards:[]},created_at:new Date().toISOString()}];
  const request=new Request(`https://example.test/api/coach/conversation?id=${first.id}`);
  assert.equal((await (await route.GET(request)).json()).messages[0].reply.text,'Persisté');
  assert.equal((await (await route.GET(new Request(`https://example.test/api/coach/conversation?id=${second.id}`))).json()).messages.length,0);
  owner='other';assert.equal((await route.GET(request)).status,404);
  owner=null;assert.equal((await create()).status,401);
});
test('storage diagnostics distinguish missing schema, access denial and service outage',()=>{
  assert.match(coachStorageError({code:'42P01'},'créer').message,/202609211054_coach_conversations.sql/);
  assert.match(coachStorageError({code:'42501'},'créer').message,/policies RLS/);
  assert.doesNotMatch(coachStorageError({code:'08006'},'créer').message,/migration|schéma.*incomplet/);
});
test('real OpenAI wrapper rejects failures, exposes only public error and saves failed status',async()=>{
  const ai=load('@/lib/openai');
  const previousKey=process.env.OPENAI_API_KEY, previousFetch=globalThis.fetch;
  try {
    process.env.OPENAI_API_KEY='sk-test-not-a-real-key';
    globalThis.fetch=async()=>new Response('sensitive provider detail',{status:401});
    const db=database({coach_conversations:[{id:'11111111-1111-4111-8111-111111111111',user_id:'owner',context:{}}]});
    const run=loader({'@/lib/openai':ai,'@/lib/server/connections/coach-connected':{connectedCoachHandlers:{}}});
    const {processCoachMessage}=run('@/lib/server/process-coach-message');
    const reply=await processCoachMessage(db,'owner',{conversationId:db.tables.coach_conversations[0].id,messageId:'22222222-2222-4222-8222-222222222222',text:'Bonjour'});
    assert.match(reply.text,/invalide ou refusee/);
    assert.doesNotMatch(reply.text,/sensitive provider detail|sk-test/);
    assert.equal(reply.changed,undefined);assert.deepEqual(reply.cards,[]);
    assert.equal(db.tables.coach_messages[0].status,'failed');
  } finally { globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey; }
});
