import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loader,database} from './helpers/connected-test-harness.mjs';

function setup(seed={}) {
 const owner='owner',conversationId=randomUUID(),martin=randomUUID(),calls=[],models=[];
 const db=database({profiles:[{id:owner,professional_profile:{fullName:'Sonia Test',agencyName:'Agence Test',phone:'514-555-0101',email:'broker@example.test',signature:'Signature Sonia'}},{id:'other',professional_profile:{fullName:'Autre Courtier',agencyName:'Agence privée',phone:'450-555-0199',email:'private@example.test',signature:'Signature privée'}}],clients:[{id:martin,user_id:owner,first_name:'Martin',last_name:'Roy',email:'martin@example.test',phone:'514-555-0123'},{id:randomUUID(),user_id:'other',first_name:'Martin',last_name:'Privé',phone:'450-555-0199'}],coach_conversations:[{id:conversationId,user_id:owner,context:{}}],...seed});
 const base=db.from.bind(db);db.from=table=>{calls.push({table});const q=base(table),select=q.select;q.select=(cols,opts)=>{calls.push({table,cols,opts});return select.call(q,cols,opts);};return q;};
 const load=loader({'@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async()=>{const next=models.shift();if(next instanceof Error)throw next;if(!next)throw Error('Unexpected model call');return JSON.stringify(next);}},'@/app/api/clients/[id]/route':{},'@/app/api/properties/[id]/route':{}});
 const {processCoachMessage}=load('@/lib/server/process-coach-message');
 const message=async(text,intent,userId=owner,id=conversationId)=>{if(intent)models.push(intent);return processCoachMessage(db,userId,{conversationId:id,messageId:randomUUID(),text});};
 return {db,calls,models,load,message,conversationId,martin};
}
test('059 regression: wrong model search intent becomes the authenticated broker profile, never 1,896 clients',async()=>{
 const f=setup();
 const r=await f.message('Bonjour, peux-tu me dire quel est mon nom professionnel, mon agence et mes coordonnées enregistrées dans IACourtier?',{tool:'search_clients',query:'nom professionnel'});
 assert.match(r.text,/Sonia Test/);assert.match(r.text,/Agence Test/);assert.match(r.text,/514-555-0101/);assert.match(r.text,/broker@example.test/);assert.match(r.text,/Signature Sonia/);
 assert.equal(r.cards.length,0);assert.ok(!f.calls.some(c=>c.table==='clients'));assert.doesNotMatch(r.text,/Autre Courtier|privée|clients trouv/);
});
test('059 owner questions select the requested fields instead of client records, even with a current client',async()=>{
 const f=setup();f.db.tables.coach_conversations[0].context={current_client_id:f.martin};
 for(const [text,wanted,absent]of [['Quelles sont mes coordonnées?','Sonia Test','Martin'],['Quelle est mon agence?','Agence Test','514-555'],['Quel est mon numéro de téléphone?','514-555-0101','martin@example']]){
  const r=await f.message(text,{tool:'search_clients'});assert.ok(r.text.includes(wanted));assert.ok(!r.text.includes(absent));assert.equal(r.context.current_client_id,f.martin);
 }
 assert.ok(!f.calls.some(c=>c.table==='clients'));
});
test('059 broker follow-ups persist without cancelling a draft or changing its client',async()=>{
 const f=setup(),actionId=randomUUID();f.db.tables.coach_conversations[0].context={current_action_id:actionId,current_client_id:f.martin};
 await f.message('Quelles sont mes coordonnées?',{tool:'get_professional_profile'});
 const r=await f.message('Et l’agence?',{tool:'search_clients'});
 assert.match(r.text,/Agence Test/);assert.equal(r.context.current_action_id,actionId);assert.equal(r.context.current_client_id,f.martin);assert.equal(f.db.tables.coach_conversations[0].context.current_identity_target,'broker');
 assert.equal(f.db.tables.coach_messages.length,2);
 const next=await f.message('Et son courriel?',{tool:'get_client'});assert.match(next.text,/broker@example.test/);assert.doesNotMatch(next.text,/martin@example/);
});
test('059 named client coordinates and client follow-ups stay distinct from the broker',async()=>{
 const f=setup();await f.message('Quelle est mon agence?',{tool:'get_professional_profile'});
 let r=await f.message('Trouve les coordonnées de Martin',{tool:'get_client',query:'Martin'});
 assert.match(r.text,/Martin Roy/);assert.match(r.text,/martin@example.test/);assert.equal(r.context.current_identity_target,'client');assert.doesNotMatch(r.text,/Sonia Test|Agence Test|450-555/);
 r=await f.message('Et son téléphone?',{tool:'get_client'});assert.match(r.text,/514-555-0123/);
});
test('059 counting uses an exact HEAD query scoped to the broker, no list or 30/500-row truncation',async()=>{
 const clients=Array.from({length:1896},(_,i)=>({id:randomUUID(),user_id:'owner',first_name:'Fixture',roles:i%2?['seller']:['buyer']})).concat([{id:randomUUID(),user_id:'other',first_name:'Privé'}]);
 const f=setup({clients});const r=await f.message('Combien ai-je de clients?',{tool:'search_clients'});
 assert.match(r.text,/1896/);assert.equal(r.cards.length,0);
 assert.deepEqual(f.calls.filter(c=>c.cols),[{table:'coach_messages',cols:'reply,status,conversation_id',opts:undefined},{table:'coach_conversations',cols:'*',opts:undefined},{table:'coach_messages',cols:'text,reply',opts:undefined},{table:'clients',cols:'id',opts:{count:'exact',head:true}}]);
 const buyers=await f.message('Combien ai-je d’acheteurs?',{tool:'count_clients',role:'buyer'});assert.match(buyers.text,/948/);assert.equal(buyers.cards.length,0);
});
test('059 ambiguous identity asks for clarification before any CRM read, then resumes the same pending action',async()=>{
 const f=setup();let r=await f.message('Les coordonnées?',{tool:'search_clients'});
 assert.match(r.text,/profil professionnel ou.*client/);assert.ok(!f.calls.some(c=>c.table==='clients'||c.table==='profiles'));
 assert.equal(f.db.tables.coach_conversations[0].pending.kind,'identity');
 r=await f.message('Moi');assert.match(r.text,/Sonia Test/);assert.equal(f.db.tables.coach_conversations[0].pending,null);assert.equal(f.models.length,0);
});
test('059 no default client scan; only an explicit list permits listing',async()=>{
 const f=setup();let r=await f.message('Bonjour',{tool:'search_clients'});assert.match(r.text,/Quel client/);assert.ok(!f.calls.some(c=>c.table==='clients'));
 r=await f.message('Liste mes clients',{tool:'search_clients',filter:'list'});assert.equal(r.cards.length,1);assert.match(r.text,/1 client/);
});
test('059 missing fields and stored profile fallbacks never borrow from a client or invent coordinates',async()=>{
 const f=setup({profiles:[{id:'owner',full_name:'Nom enregistré',email:'stored@example.test',professional_profile:{}},{id:'other',professional_profile:{agencyName:'Agence privée',phone:'450-555-0199'}}]});
 const r=await f.message('Quelles sont mes coordonnées?',{tool:'get_professional_profile',values:{user_id:'other'}});
 assert.match(r.text,/Nom enregistré/);assert.match(r.text,/stored@example.test/);assert.match(r.text,/Agence : non renseigné/);assert.match(r.text,/Téléphone : non renseigné/);assert.doesNotMatch(r.text,/Martin|450-555|Agence privée/);
 assert.ok(!f.calls.some(c=>c.table==='clients'));assert.equal(f.db.tables.profiles[0].professional_profile.phone,undefined);
});
test('059 two brokers have independent profiles, counts and conversations',async()=>{
 const f=setup(),second=randomUUID();f.db.tables.coach_conversations.push({id:second,user_id:'other',context:{}});
 const a=await f.message('Quelle est mon agence?',{tool:'get_professional_profile'}),b=await f.message('Quelle est mon agence?',{tool:'get_professional_profile'},'other',second);
 assert.match(a.text,/Agence Test/);assert.doesNotMatch(a.text,/privée/);assert.match(b.text,/Agence privée/);assert.doesNotMatch(b.text,/Agence Test/);
 const count=await f.message('Combien ai-je de clients?',{tool:'count_clients'},'other',second);assert.match(count.text,/1 client/);
 await assert.rejects(f.message('Mes coordonnées?',null,'other',f.conversationId),/Conversation introuvable/);
});
test('059 a profile read during a missing email field is never interpreted as a new coordinate to save',()=>{
 const f=setup(),{emailConversationIntent}=f.load('@/lib/server/coach-professional-context');
 assert.equal(emailConversationIntent('Quelle est mon agence?',{email_question:{field:'agencyName',intent:{tool:'draft_email'},question:'Quelle agence?'}}).tool,'get_professional_profile');
 for(const text of ['Ajoute mon téléphone à ce courriel','Rends ça plus chaleureux','Raccourcis'])assert.equal(emailConversationIntent(text,{current_action_id:randomUUID()}).tool,'revise_email');
 const {normalizeIdentityIntent}=f.load('@/lib/server/coach-professional-context');
 assert.equal(normalizeIdentityIntent({tool:'revise_email'},'Peux-tu rajouter mon numéro au brouillon?',{}).tool,'revise_email');
});
test('059 provider failure does not fall back to a client list or invented broker details',async()=>{
 const f=setup();const r=await f.message('Quelle est mon agence?',new Error('Provider indisponible'));
 assert.match(r.text,/Provider indisponible/);assert.ok(!f.calls.some(c=>c.table==='clients'||c.table==='profiles'));assert.equal(f.db.tables.coach_messages[0].status,'failed');
});
