import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {database,loader} from './helpers/connected-test-harness.mjs';
let db,actor='owner',scopeGranted='',transportCalls=0,verifyFailure=false;
const load=loader({
 '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>db},
 '@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async()=>{throw Error('Connection commands must not need the model');}},
 '@/app/api/clients/[id]/route':{PATCH:async()=>{throw Error('No CRM mutation');}},
 '@/app/api/properties/[id]/route':{PATCH:async()=>{throw Error('No CRM mutation');}},
});
const accounts=load('@/lib/server/connections/accounts');
const connections=load('@/lib/server/connections/coach-connections');
const {processCoachMessage}=load('@/lib/server/process-coach-message');
const callback=load('@/app/api/connections/[provider]/callback/route');
const route=load('@/app/api/coach/connections/route');
function setup() {
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',CONNECTIONS_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64'),CONNECTIONS_APP_URL:'https://example.test',GOOGLE_CLIENT_ID:'synthetic-client',GOOGLE_CLIENT_SECRET:'synthetic-secret'});
 const conversationId=randomUUID(),otherConversation=randomUUID(),accountId=randomUUID();
 actor='owner';scopeGranted='';transportCalls=0;verifyFailure=false;
 db=database({coach_conversations:[{id:conversationId,user_id:'owner',context:{current_client_id:'preserved-client'}},{id:otherConversation,user_id:'owner',context:{}}],connected_accounts:[{id:accountId,user_id:'owner',provider:'google',provider_subject:'existing',email:'existing@example.test',status:'connected',scopes:accounts.scopes.google.join(' '),encrypted_tokens:accounts.encryptTokens({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Date.now()+3600000},'owner:google')}],connected_account_defaults:[{user_id:'owner',service:'email',account_id:accountId},{user_id:'owner',service:'calendar',account_id:accountId}]});
 db.auth={getUser:async()=>({data:{user:actor ? {id:actor} : null}})};
 const scope={db,userId:'owner',conversationId,messageId:randomUUID(),text:'Connecte mon deuxième Gmail',context:{}};
 return {conversationId,otherConversation,accountId,scope};
}
async function message(conversationId,text) {return processCoachMessage(db,'owner',{conversationId,messageId:randomUUID(),text});}
async function offer(conversationId) {const result=await message(conversationId,'Connecte mon deuxième Gmail');assert.equal(result.cards[0].connection.status,'offered');return result.cards[0].id;}
async function start(id,conversationId) {
 const result=await connections.connectionRequestAction('owner',id,conversationId,'start');
 const url=new URL(result.url);scopeGranted=url.searchParams.get('scope');return url.searchParams.get('state');
}
function transport(url) {
 transportCalls++;
 if(String(url).includes('/token'))return Promise.resolve(Response.json({access_token:'new-fixture-access',refresh_token:'new-fixture-refresh',expires_in:3600,scope:scopeGranted}));
 if(String(url).includes('/userinfo'))return Promise.resolve(Response.json({sub:'new-google',email:'new@example.test'}));
 if(verifyFailure)return Promise.resolve(new Response(null,{status:503}));
 return Promise.resolve(Response.json({messages:[],items:[]}));
}
async function oauth(state,extra='code=fixture-code') {return callback.GET(new Request(`https://example.test/api/connections/google/callback?state=${state}&${extra}`),{params:{provider:'google'}});}
async function hydrate(conversationId) {return connections.hydrateConnectionMessages('owner',conversationId,db.tables.coach_messages.filter(m=>m.conversation_id===conversationId));}

test('055C: commandes de connexion reconnues sans modèle; événements calendaires préservés',async()=>{
 const {conversationId}=setup();
 assert.equal(connections.connectionIntent('Connecte mon deuxième Gmail').tool,'connect_service');
 assert.equal(connections.connectionIntent('Ajoute mon calendrier').values.service,'calendar');
 assert.equal(connections.connectionIntent('Quels comptes sont connectés ?').tool,'list_connections');
 assert.equal(connections.connectionIntent('Déconnecte ce compte').tool,'disconnect_account');
 assert.equal(connections.connectionIntent('Connecte Centris').tool,'get_centris_status');
 assert.equal(connections.connectionIntent('Ajoute un rendez-vous à mon calendrier'),undefined);
 const result=await message(conversationId,'Quels comptes sont connectés ?');
 assert.equal(result.cards[0].connection.email,'existing@example.test');
 assert.doesNotMatch(JSON.stringify(result),/encrypted_tokens|fixture-refresh|fixture-access|synthetic-secret/);
 const centris=await message(conversationId,'Connecte Centris');
 assert.equal(centris.cards[0].connection.status,'unavailable');assert.match(centris.text,/aucune recherche ou transmission/i);
});

test('055C: OAuth officiel, retour même conversation, succès uniquement après vérification serveur',async()=>{
 const {conversationId,otherConversation}=setup(),id=await offer(conversationId),state=await start(id,conversationId);
 assert.equal(db.tables.coach_connection_requests[0].status,'pending');
 await assert.rejects(connections.connectionRequestAction('owner',id,conversationId,'start'),/déjà/);
 const original=global.fetch;global.fetch=transport;
 try {
  const response=await oauth(state),destination=new URL(response.headers.get('location'));
  assert.equal(destination.pathname,'/tableau-de-bord/coach');assert.equal(destination.searchParams.get('conversation'),conversationId);
  const row=db.tables.coach_connection_requests[0];assert.equal(row.status,'verified');assert.ok(row.verified_at);
  assert.equal(transportCalls,3);assert.equal(db.tables.connected_accounts.length,2);
  assert.equal(db.tables.coach_conversations.find(c=>c.id===conversationId).context.current_account_id,row.account_id);
  assert.equal(db.tables.coach_conversations.find(c=>c.id===conversationId).context.current_client_id,'preserved-client');
  assert.equal(db.tables.coach_conversations.find(c=>c.id===otherConversation).context.current_account_id,undefined);
  const history=await hydrate(conversationId);assert.equal(history[0].reply.cards[0].connection.status,'verified');assert.match(history[0].reply.cards[0].detail,/vérifiée côté serveur/);
  await oauth(state);assert.equal(transportCalls,3);assert.equal(db.tables.connected_accounts.length,2);
 } finally {global.fetch=original;}
});

test('055C: accès fournisseur échoué après OAuth : aucune fausse confirmation',async()=>{
 const {conversationId}=setup(),id=await offer(conversationId),state=await start(id,conversationId);
 verifyFailure=true;const original=global.fetch;global.fetch=transport;
 try {await oauth(state);const row=db.tables.coach_connection_requests[0];assert.equal(row.status,'failed');assert.equal(row.verified_at,null);const history=await hydrate(conversationId);assert.equal(history[0].reply.cards[0].connection.status,'failed');assert.doesNotMatch(history[0].reply.cards[0].detail,/Connexion vérifiée/);}
 finally {global.fetch=original;}
});

test('055C: refus Google et annulation dans le Coach retournent au fil sans appel fournisseur',async()=>{
 for(const cancelInCoach of [false,true]) {
  const {conversationId}=setup(),id=await offer(conversationId),state=await start(id,conversationId);
  if(cancelInCoach)await connections.connectionRequestAction('owner',id,conversationId,'cancel');
  const original=global.fetch;global.fetch=transport;
  try {const response=await oauth(state,'error=access_denied');assert.equal(new URL(response.headers.get('location')).searchParams.get('conversation'),conversationId);assert.equal(db.tables.coach_connection_requests[0].status,'cancelled');assert.equal(db.tables.connected_accounts.length,1);assert.equal(transportCalls,0);}
  finally {global.fetch=original;}
 }
});

test('055C: propriétaire, conversation et origine vérifiés; retour libre ignoré',async()=>{
 const {conversationId,otherConversation}=setup(),id=await offer(conversationId);
 await assert.rejects(connections.connectionRequestAction('other',id,conversationId,'start'),/accessible/);
 await assert.rejects(connections.connectionRequestAction('owner',id,otherConversation,'start'),/accessible/);
 const denied=await route.POST(new Request('https://example.test/api/coach/connections',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({id,conversationId,action:'start'})}));assert.equal(denied.status,403);
 actor='';const unauth=await route.POST(new Request('https://example.test/api/coach/connections',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:'{}'}));assert.equal(unauth.status,401);actor='owner';
 const result=await route.POST(new Request('https://example.test/api/coach/connections',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({id,conversationId,action:'start',returnUrl:'https://evil.test'})}));
 const url=new URL((await result.json()).url);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),'https://example.test/api/connections/google/callback');
 actor='other';const original=global.fetch;global.fetch=transport;
 try {const r=await oauth(url.searchParams.get('state'));assert.equal(new URL(r.headers.get('location')).pathname,'/tableau-de-bord/reglages/connexions');assert.equal(transportCalls,0);assert.equal(db.tables.coach_connection_requests[0].status,'pending');}
 finally {global.fetch=original;}
});

test('055C: déconnexion explicite confirmée, idempotente et limitée au compte choisi',async()=>{
 const {conversationId,accountId}=setup();db.tables.connected_accounts.push({...db.tables.connected_accounts[0],id:randomUUID(),provider_subject:'second',email:'second@example.test'});
 const reply=await message(conversationId,'Déconnecte le compte existing@example.test');const id=reply.cards[0].id;
 assert.equal(db.tables.connected_accounts[0].status,'connected');assert.equal(reply.cards[0].connection.action,'disconnect');
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response(null,{status:200});};
 try {await connections.connectionRequestAction('owner',id,conversationId,'confirm');assert.equal(db.tables.connected_accounts.find(a=>a.id===accountId).status,'disconnected');assert.equal(db.tables.connected_accounts[1].status,'connected');await assert.rejects(connections.connectionRequestAction('owner',id,conversationId,'confirm'),/déjà/);assert.equal(calls,1);}
 finally {global.fetch=original;}
});

test('055C: les connexions préservent la clarification et son action après OAuth',async()=>{
 const {conversationId}=setup();
 const conversation=db.tables.coach_conversations.find(c=>c.id===conversationId);
 const pending={intent:{tool:'create_calendar_event',title:'Vérifier le rendez-vous avec la maman de Francis',dateExpression:'2026-10-16'},text:'Ajoute demain un rappel',kind:'title',options:[],mode:'clarification',timeZone:'America/Toronto'};
 conversation.pending=structuredClone(pending);conversation.context.current_action_id=randomUUID();
 const actionId=conversation.context.current_action_id;
 for(const text of ['Quels comptes sont connectés ?','Connecte Centris','Ajoute mon calendrier']) {
  await message(conversationId,text);assert.deepEqual(conversation.pending,pending);assert.equal(conversation.context.current_action_id,actionId);
 }
 const id=await offer(conversationId),state=await start(id,conversationId);
 const original=global.fetch;global.fetch=transport;
 try {await oauth(state);assert.equal(db.tables.coach_connection_requests.find(r=>r.id===id).status,'verified');assert.deepEqual(conversation.pending,pending);assert.equal(conversation.context.current_action_id,actionId);}
 finally {global.fetch=original;}
});

test('055C: plusieurs comptes offrent des confirmations ciblées sans remplacer le rappel',async()=>{
 const {conversationId,accountId}=setup();
 const second={...db.tables.connected_accounts[0],id:randomUUID(),provider_subject:'second',email:'second@example.test'};
 db.tables.connected_accounts.push(second);
 const conversation=db.tables.coach_conversations.find(c=>c.id===conversationId);
 conversation.pending={intent:{tool:'create_calendar_event',title:'Rappel Francis',dateExpression:'2026-10-16'},text:'Rappel demain',kind:'time',options:[],mode:'clarification',timeZone:'America/Toronto'};
 const before=structuredClone(conversation.pending);
 const result=await message(conversationId,'Déconnecte ce compte');
 assert.equal(result.cards.length,2);assert.deepEqual(conversation.pending,before);
 assert.deepEqual(result.cards.map(c=>c.connection.accountId),[accountId,second.id]);
 assert.equal(db.tables.connected_accounts.every(a=>a.status==='connected'),true);
 assert.equal(db.tables.coach_connection_requests.every(r=>r.status==='offered'),true);
});

test('055C: une vérification engagée ne peut plus être annulée en concurrence',async()=>{
 const {conversationId}=setup(),id=await offer(conversationId),state=await start(id,conversationId);
 const row=await connections.coachOAuthRequest('owner','google',state);
 await connections.claimCoachOAuthRequest('owner',row);
 await assert.rejects(connections.connectionRequestAction('owner',row.id,conversationId,'cancel'),/vérification/);
 assert.equal(db.tables.coach_connection_requests.find(r=>r.id===row.id).status,'verifying');
});
