import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loader,database} from './helpers/connected-test-harness.mjs';

function fixture() {
  const a=randomUUID(),b=randomUUID(),calls=[];
  const db=database({coach_conversations:[{id:a,user_id:'a',context:{current_client_id:'client-a'},pending:{text:'pending'}},{id:b,user_id:'b',context:{current_client_id:'client-b'}}],profiles:[{id:'a',professional_profile:{fullName:'Courtier A',agencyName:'Agence A'}},{id:'b',professional_profile:{fullName:'Courtier B',agencyName:'Agence B'}}]});
  const load=loader({'@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async()=>{calls.push('openai');return JSON.stringify({tool:'get_professional_profile'});}},'@/app/api/clients/[id]/route':{},'@/app/api/properties/[id]/route':{}});
  return {a,b,db,calls,load,...load('@/lib/server/process-coach-message')};
}
async function metaFixture(work) {
  const saved={MODEL_API_KEY:process.env.MODEL_API_KEY,META_MODEL:process.env.META_MODEL,META_BASE_URL:process.env.META_BASE_URL},fetch=global.fetch;
  Object.assign(process.env,{MODEL_API_KEY:'synthetic-meta-secret',META_MODEL:'fixture-model',META_BASE_URL:'https://api.meta.ai/v1'});
  try { await work(); } finally {global.fetch=fetch;for(const [k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test('provider selection is owned, persistent, preserves pending/context and never calls an AI',async()=>metaFixture(async()=>{
  const f=fixture();
  await f.selectCoachProvider(f.db,'a',f.a,'meta');
  assert.equal(f.db.tables.coach_conversations[0].context.ai_provider,'meta');
  assert.equal(f.db.tables.coach_conversations[0].context.current_client_id,'client-a');
  assert.equal(f.db.tables.coach_conversations[0].pending.text,'pending');
  await assert.rejects(f.selectCoachProvider(f.db,'b',f.a,'openai'),/inaccessible/);
  await assert.rejects(f.selectCoachProvider(f.db,'a',f.a,'unknown'),/invalide/);
  assert.equal(f.calls.length,0);
}));
test('persisted Meta routes classification and profile while another broker remains on OpenAI',async()=>metaFixture(async()=>{
  const f=fixture();let metaCalls=0;
  global.fetch=async(url,init)=>{metaCalls++;assert.equal(url,'https://api.meta.ai/v1/chat/completions');assert.equal(JSON.parse(init.body).model,'fixture-model');return Response.json({choices:[{message:{content:JSON.stringify({tool:'get_professional_profile'})}}]});};
  await f.selectCoachProvider(f.db,'a',f.a,'meta');
  const send=(userId,conversationId)=>f.processCoachMessage(f.db,userId,{conversationId,messageId:randomUUID(),text:'Quelles sont mes coordonnées?'});
  const r=await send('a',f.a);assert.match(r.text,/Courtier A/);assert.doesNotMatch(r.text,/Courtier B/);assert.equal(r.context.ai_provider,'meta');
  const other=await send('b',f.b);assert.match(other.text,/Courtier B/);assert.doesNotMatch(other.text,/Courtier A/);assert.equal(other.context.ai_provider,'openai');
  assert.equal(metaCalls,1);assert.equal(f.calls.length,1);
}));
test('concurrent async requests keep their provider and nested work isolated',async()=>metaFixture(async()=>{
  const f=fixture(),p=f.load('@/lib/server/ai-provider');
  global.fetch=async()=>Response.json({choices:[{message:{content:'meta-answer'}}]});
  const request={systemPrompt:'fixture',userPrompt:'fixture'};
  const result=await Promise.all([p.withCoachAI('meta',async()=>{await new Promise(r=>setTimeout(r,10));assert.equal(p.currentCoachProvider(),'meta');return p.generateWithCoachAI(request);}),p.withCoachAI('openai',async()=>{await Promise.resolve();assert.equal(p.currentCoachProvider(),'openai');return p.generateWithCoachAI(request);})]);
  assert.equal(result[0],'meta-answer');assert.match(result[1],/get_professional_profile/);assert.equal(p.currentCoachProvider(),'openai');
}));
test('Meta failure is persisted honestly, with no OpenAI fallback or raw error disclosure',async()=>metaFixture(async()=>{
  const f=fixture();global.fetch=async()=>new Response('synthetic-meta-secret private-provider-body',{status:402});
  await f.selectCoachProvider(f.db,'a',f.a,'meta');
  const result=await f.processCoachMessage(f.db,'a',{conversationId:f.a,messageId:randomUUID(),text:'Bonjour'});
  assert.match(result.text,/402/);assert.doesNotMatch(result.text,/secret|private-provider-body/);assert.equal(f.calls.length,0);assert.equal(f.db.tables.coach_messages[0].status,'failed');assert.equal(result.cards.length,0);
}));
test('missing Meta configuration cannot be selected and does not erase the default',async()=>{
  const f=fixture(),saved=process.env.MODEL_API_KEY;delete process.env.MODEL_API_KEY;
  try {await assert.rejects(f.selectCoachProvider(f.db,'a',f.a,'meta'),/pas configuré/);assert.equal(f.db.tables.coach_conversations[0].context.ai_provider,undefined);}finally{if(saved!==undefined)process.env.MODEL_API_KEY=saved;}
});
test('explicit quoted email subject survives model omission and contact clarification text',()=>{
  const {explicitEmailSubject}=fixture().load('@/lib/server/coach-professional-context');
  assert.equal(explicitEmailSubject('Prépare à Karelle avec l’objet « Test IACourtier ». Le message est « Bonjour ».'),'Test IACourtier');
  assert.equal(explicitEmailSubject('avec le sujet: "Rendez-vous jeudi"'),'Rendez-vous jeudi');
  assert.equal(explicitEmailSubject('Le message dit « Bonjour ».'),undefined);
});
test('natural conversation uses owned history/profile and preserves a pending action without CRM mutation',async()=>{
  const f=fixture(),requests=[];
  const load=loader({'@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async request=>{requests.push(request);return 'Réponse synthétique du test.';}},'@/app/api/clients/[id]/route':{},'@/app/api/properties/[id]/route':{}});
  f.db.tables.coach_messages=[{user_id:'a',conversation_id:f.a,status:'completed',text:'Contexte A',reply:{text:'Réponse A'}},{user_id:'b',conversation_id:f.b,status:'completed',text:'SECRET COURTIER B',reply:{text:'Réponse privée'}}];
  const scope={db:f.db,userId:'a',conversationId:f.a,messageId:randomUUID(),text:'Explique-moi cela',context:{current_client_id:null,current_case_id:null,current_action_id:'pending-action'}};
  const reply=await load('@/lib/server/coach-tools').coachHandlers.answer(scope,{tool:'answer'});
  assert.equal(reply.text,'Réponse synthétique du test.');assert.equal(reply.context.current_action_id,'pending-action');assert.equal(reply.changed,undefined);
  assert.match(requests[0].userPrompt,/Courtier A|Contexte A/);assert.doesNotMatch(requests[0].userPrompt,/SECRET COURTIER B|Agence B/);
});
