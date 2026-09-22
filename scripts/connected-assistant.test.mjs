import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { database,loader } from './helpers/connected-test-harness.mjs';

const primitives=loader({'@/lib/server/connections/accounts':{}});
const {dateWindow,torontoInstant}=primitives('@/lib/connections/dates');
const {GoogleEmailProvider,MicrosoftEmailProvider,GoogleCalendarProvider,MicrosoftCalendarProvider,googleMime,mailbox}=primitives('@/lib/server/connections/providers');
test('Toronto été/hiver, midi, après-midi, DST ambigu et date invalide',()=>{
  assert.equal(torontoInstant('2026-09-24',14),'2026-09-24T18:00:00.000Z');
  assert.equal(torontoInstant('2026-01-24',14),'2026-01-24T19:00:00.000Z');
  assert.throws(()=>torontoInstant('2026-03-08',2,30),/ambiguë/);
  assert.throws(()=>torontoInstant('2026-11-01',1,30),/ambiguë/);
  assert.throws(()=>torontoInstant('2026-02-30',12),/invalide/);
  const now=new Date('2026-09-22T14:00:00Z');
  assert.equal(dateWindow('jeudi à 15 h',now,true).start,'2026-09-24T19:00:00.000Z');
  assert.equal(dateWindow('aujourd’hui midi',now).start,'2026-09-22T16:00:00.000Z');
  assert.equal(Date.parse(dateWindow('jeudi après-midi',now).end)-Date.parse(dateWindow('jeudi après-midi',now).start),6*3600000);
  assert.throws(()=>dateWindow('vendredi matin',now,true),/heure/);
  assert.equal(dateWindow('jeudi à 15 h',new Date('2026-09-24T18:00:00Z'),true).start,'2026-09-24T19:00:00.000Z');
  assert.equal(dateWindow('2026-09-24T15:00:00',now,true).start,'2026-09-24T19:00:00.000Z');
});
test('MIME UTF-8, destinataire résolu et références du fil',()=>{
  const mime=Buffer.from(googleMime({to:'Jacques <jacques@example.test>',subject:'Réponse\r\nBcc: hidden',text:'Québec',operationId:randomUUID(),replyTo:{internetMessageId:'<initial@test>',references:'<older@test>'}}),'base64url').toString();
  assert.match(mime,/To: jacques@example.test\r\n/);assert.match(mime,/In-Reply-To: <initial@test>/);assert.match(mime,/References: <older@test> <initial@test>/);assert.doesNotMatch(mime,/\r\nBcc:/);assert.throws(()=>mailbox('guess'),/vérifiée/);assert.throws(()=>mailbox('a@test.com\r\nBcc:x@test.com'));
});
test('Gmail brouillon attaché au fil puis un seul appel send',async()=>{
  const calls=[];const email=new GoogleEmailProvider(async(p,i)=>{calls.push([p,i]);return p.endsWith('/send')?{id:'sent',threadId:'thread'}:{id:'draft'};});
  const id=await email.replyToMessage({to:'jacques@example.test',subject:'Re: document',text:'Demain',replyTo:{threadId:'thread',internetMessageId:'<x@test>'},operationId:randomUUID()});
  assert.equal(JSON.parse(calls[0][1].body).message.threadId,'thread');assert.equal(calls.length,1);
  assert.equal((await email.sendMessage(id)).id,'sent');assert.equal(calls.length,2);
});
test('Microsoft createReply conserve le fil et send annonce seulement accepted',async()=>{
  const calls=[];const email=new MicrosoftEmailProvider(async(p,i)=>{calls.push([p,i]);return {id:'draft'};},'me@example.test');
  const id=await email.replyToMessage({to:'jacques@example.test',subject:'Re: document',text:'Demain',replyTo:{id:'source'},operationId:randomUUID()});
  assert.match(calls[0][0],/source\/createReply$/);assert.equal(JSON.parse(calls[1][1].body).toRecipients[0].emailAddress.address,'jacques@example.test');
  assert.equal((await email.sendMessage(id)).accepted,true);
});
test('agenda: pagination ne peut pas donner une fausse disponibilité',async()=>{
  await assert.rejects(new GoogleCalendarProvider(async()=>({nextPageToken:'next',items:[]})).checkAvailability('a','b'),/Trop/);
  await assert.rejects(new MicrosoftCalendarProvider(async()=>({'@odata.nextLink':'next',value:[]})).checkAvailability('a','b'),/Trop/);
});
test('agenda: transactionId et If-Match protègent création et modification',async()=>{
  const calls=[];const api=async(p,i)=>{calls.push([p,i]);return {id:'e',subject:'Visite',start:{dateTime:'2026-09-24T18:00:00',timeZone:'UTC'},end:{dateTime:'2026-09-24T19:00:00',timeZone:'UTC'}};};
  const p=new MicrosoftCalendarProvider(api), input={title:'Visite',start:'2026-09-24T18:00:00Z',end:'2026-09-24T19:00:00Z',location:'91 Régent',operationId:randomUUID()};
  assert.equal((await p.createEvent(input)).start,'2026-09-24T18:00:00Z');assert.equal(JSON.parse(calls[0][1].body).transactionId,input.operationId);
  await p.updateEvent('e',input,'version1');assert.equal(calls[1][1].headers['If-Match'],'version1');
});
test('chiffrement: propriétaire et intégrité authentifiés',()=>{
  process.env.CONNECTIONS_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
  const a=loader({'@/lib/supabase/admin':{}})('@/lib/server/connections/accounts');
  const token=a.encryptTokens({access_token:'private'},'owner:google');
  assert.doesNotMatch(token,/private/);assert.equal(a.decryptTokens(token,'owner:google').access_token,'private');assert.throws(()=>a.decryptTokens(token,'other:google'));
  const parts=token.split('.');parts[1]=Buffer.from('tampered').toString('base64url');assert.throws(()=>a.decryptTokens(parts.join('.'),'owner:google'));
});

let db,model=[],fixtureProviders,sendCalls=0,eventCalls=0,sendError=false,conflicts=[];
const load=loader({
  '@/lib/openai':{generateWithOpenAI:async()=>{const next=model.shift();if(!next)throw Error('Unexpected model call');return typeof next==='string'?next:JSON.stringify(next);}},
  '@/lib/server/connections/accounts':{connectionStore:()=>db,listAccounts:async owner=>(db.tables.connected_accounts||[]).filter(a=>a.user_id===owner),connectionAudit:async()=>{}},
  '@/lib/server/connections/providers':{mailbox,connectedProviders:async(owner,id)=>{if(!db.tables.connected_accounts.some(a=>a.user_id===owner&&a.id===id))throw Error('Compte inaccessible');return fixtureProviders;}},
  '@/app/api/clients/[id]/route':{PATCH:async()=>Response.json({})},'@/app/api/properties/[id]/route':{PATCH:async()=>Response.json({})},
});
const connected=load('@/lib/server/connections/coach-connected');
const {processCoachMessage}=load('@/lib/server/process-coach-message');
const {emptyCoachContext}=load('@/lib/coach/conversation');
function fixture(){
  const accountId=randomUUID(),conversationId=randomUUID(),refId=randomUUID(),clientId=randomUUID(),caseId=randomUUID();
  const email={id:'incoming',threadId:'thread',subject:'Certificat 91 Régent',from:'jacques@example.test',replyTo:'jacques@example.test',to:['me@example.test'],text:'Pouvez-vous envoyer le certificat ?',receivedAt:new Date().toISOString(),sent:false,unread:true,automated:false};
  db=database({connected_accounts:[{id:accountId,user_id:'owner',provider:'google',email:'me@example.test',status:'connected'}],clients:[{id:clientId,user_id:'owner',first_name:'Jacques',last_name:'Test',email:'jacques@example.test'}],client_cases:[{id:caseId,user_id:'owner',primary_client_id:clientId,title:'91 Régent',status:'active',case_type:'seller',pipeline_type:'seller',current_stage:'qualification'}],connected_references:[{id:refId,user_id:'owner',account_id:accountId,kind:'email',remote_id:'incoming',thread_id:'thread',client_id:clientId,case_id:caseId,property_id:null,match_status:'matched'}],coach_conversations:[{id:conversationId,user_id:'owner',context:{...emptyCoachContext(),current_account_id:accountId,current_email_id:refId,current_thread_id:'thread',current_client_id:clientId,current_case_id:caseId}}]});
  model=[];sendCalls=0;eventCalls=0;sendError=false;conflicts=[];
  fixtureProviders={account:db.tables.connected_accounts[0],email:{getMessage:async()=>email,getThread:async()=>[email],listMessages:async()=>[email],searchMessages:async()=>[email],createDraft:async()=> 'draft',sendMessage:async()=>{sendCalls++;if(sendError)throw Error('Gmail a échoué');return {id:'sent',threadId:'thread',accepted:false};}},calendar:{checkAvailability:async()=>conflicts,createEvent:async i=>{eventCalls++;return {id:'event',...i,busy:true};},getEvent:async()=>({id:'event',title:'Visite',start:'2026-09-24T18:00:00Z',end:'2026-09-24T19:00:00Z',location:'91 Régent',busy:true}),listEvents:async()=>[]}};
  const scope={db,userId:'owner',conversationId,messageId:randomUUID(),text:'Réponds-lui que jeudi fonctionne.',context:structuredClone(db.tables.coach_conversations[0].context)};
  return {scope,conversationId,accountId,refId,clientId,caseId,email};
}
test('réponse: aperçu obligatoire, destinataire exact, confirmation et idempotence',async()=>{
  const {scope}=fixture();model.push('Bonjour, jeudi fonctionne.');
  const preview=await connected.connectedCoachHandlers.reply_email(scope,{tool:'reply_email'});
  assert.equal(sendCalls,0);assert.equal(preview.draft.recipient,'jacques@example.test');assert.ok(preview.approval.id);
  const result=await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'});assert.match(result.text,/envoyé/);assert.equal(sendCalls,1);
  await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'});assert.equal(sendCalls,1);assert.equal(db.tables.activity_events.length,1);
});
test('échec ou résultat incertain: aucune fausse réussite ni répétition',async()=>{
  const {scope}=fixture();model.push('Réponse');const preview=await connected.connectedCoachHandlers.reply_email(scope,{tool:'reply_email'});sendError=true;
  await assert.rejects(connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'}),/échoué/);
  assert.equal(db.tables.connected_actions[0].status,'uncertain');await assert.rejects(connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'}),/plus exécutable/);assert.equal(sendCalls,1);
});
test('aperçu modifié sauvegardé, sans envoi; annulation bloque confirmation',async()=>{
  const {scope}=fixture();model.push('Ancien');const preview=await connected.connectedCoachHandlers.reply_email(scope,{tool:'reply_email'});
  scope.messageId=randomUUID();
  const edited=await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'edit',subject:'Suivi',message:'Nouveau'});assert.equal(edited.draft.message,'Nouveau');assert.equal(sendCalls,0);assert.notEqual(edited.approval.id,preview.approval.id);
  await assert.rejects(connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'}));
  await connected.handleConnectedAction(scope,{id:edited.approval.id,mode:'cancel'});await assert.rejects(connected.handleConnectedAction(scope,{id:edited.approval.id,mode:'confirm'}));assert.equal(sendCalls,0);
});
test('compte, référence, aperçu et lien CRM étrangers refusés',async()=>{
  const {scope,refId}=fixture();model.push('Réponse');const preview=await connected.connectedCoachHandlers.reply_email(scope,{tool:'reply_email'});
  await assert.rejects(connected.handleConnectedAction({...scope,userId:'other'},{id:preview.approval.id,mode:'confirm'}),/accessible/);
  await assert.rejects(connected.focusReference({...scope,userId:'other'},refId),/accessible/);
  db.tables.clients[0].user_id='other';await assert.rejects(connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'}),/CRM/);assert.equal(sendCalls,0);
});
test('calendrier recontrôle disponibilité au moment de confirmer',async()=>{
  const {scope}=fixture();scope.text='Ajoute une visite jeudi à 15 h';
  const preview=await connected.connectedCoachHandlers.create_calendar_event(scope,{tool:'create_calendar_event',title:'Visite',dateExpression:'2026-09-24 à 15 h'});
  assert.equal(eventCalls,0);conflicts=[{title:'Autre visite',start:'2026-09-24T19:00:00Z'}];
  const result=await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'});assert.match(result.text,/occupé/);assert.equal(eventCalls,0);
  conflicts=[];await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'});assert.equal(eventCalls,1);await connected.handleConnectedAction(scope,{id:preview.approval.id,mode:'confirm'});assert.equal(eventCalls,1);
});
test('même moteur: courriel → réponse → Envoie → tâche à midi',async()=>{
  const {conversationId,caseId}=fixture();
  const send=async(text,intent)=>{if(intent)model.push(intent);return processCoachMessage(db,'owner',{conversationId,messageId:randomUUID(),text});};
  model.push({tool:'reply_email'},'Bonjour, je vous envoie le certificat aujourd’hui.');
  let r=await send('Réponds-lui que je l’envoie aujourd’hui.');assert.ok(r.approval);
  r=await send('Envoie',{tool:'send_email'});assert.match(r.text,/envoyé/);
  r=await send('Fais une tâche pour midi',{tool:'create_task',title:'Envoyer certificat de localisation',dateExpression:'aujourd’hui midi'});assert.equal(r.changed,true,r.text);
  const task=db.tables.tasks.find(t=>t.title==='Envoyer certificat de localisation');assert.equal(task.case_id,caseId);assert.ok(task.due_at);assert.equal(new Intl.DateTimeFormat('fr-CA',{timeZone:'America/Toronto',hour:'2-digit',hourCycle:'h23'}).format(new Date(task.due_at)), '12 h');
});
test('dernière réponse sortante et newsletter exclues des demandes à répondre',async()=>{
  const {scope,email}=fixture();fixtureProviders.email.getThread=async()=>[{...email,sent:true}];
  let result=await connected.findEmailsNeedingReply(scope);assert.equal(result.items.length,0);
  fixtureProviders.email.getThread=async()=>[{...email,automated:true}];result=await connected.findEmailsNeedingReply(scope);assert.equal(result.items.length,0);
});
test('message courant ne peut confirmer implicitement un envoi',async()=>{
  const {scope}=fixture();model.push('Réponse');await connected.connectedCoachHandlers.reply_email(scope,{tool:'reply_email'});
  scope.text='Envoie un autre courriel à une autre personne';await assert.rejects(connected.connectedCoachHandlers.send_email(scope),/aperçu/);assert.equal(sendCalls,0);
});
