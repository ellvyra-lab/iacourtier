import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {database,loader} from './helpers/connected-test-harness.mjs';

const pure=loader({'@/lib/server/connections/accounts':{}});
const {emailListRequest,normalizeEmailListIntent}=pure('@/lib/connections/email-list-request');
const {GoogleEmailProvider,MicrosoftEmailProvider}=pure('@/lib/server/connections/providers');
const {emptyCoachContext}=pure('@/lib/coach/conversation');

test('Quantités naturelles : cinq n’est pas une limite fixe, ni une durée de recherche',()=>{
 for(const [text,n] of [['les cinq derniers courriels reçus',5],['mes 2 messages les plus récents',2],['les vingt-cinq derniers emails',25],['trois courriels de Martin',3],['un dernier courriel reçu',1]])assert.equal(emailListRequest(text,{tool:'search_emails'}).limit,n);
 const time=emailListRequest('Cherche les courriels de Martin depuis 5 jours',{tool:'search_emails'});assert.equal(time.requested,undefined);
 const corrected=normalizeEmailListIntent({tool:'search_emails',query:'cinq derniers courriels',values:{limit:20}},'les cinq derniers courriels reçus');
 assert.equal(corrected.query,undefined);assert.equal(corrected.values.limit,5);assert.equal(corrected.values.receivedOnly,true);assert.equal(corrected.values.latest,true);
 assert.equal(normalizeEmailListIntent({tool:'search_emails',query:'Martin'},'les cinq derniers courriels de Martin').query,'Martin');
 for(const limit of [0,-1,1.5,'5',Infinity])assert.throws(()=>emailListRequest('mes courriels',{tool:'search_emails',values:{limit}}),/entier/);
 assert.throws(()=>emailListRequest('zéro courriel',{tool:'search_emails'}),/entier/);
 assert.equal(emailListRequest('les 100 derniers courriels',{tool:'search_emails'}).limit,30);
 for(const text of ['trente et un courriels','soixante et onze messages','quatre-vingts courriels','quatre-vingt-dix-neuf courriels'])assert.equal(emailListRequest(text,{tool:'search_emails'}).limit,30);
 assert.throws(()=>emailListRequest('cent cinq courriels',{tool:'search_emails'}),/en chiffres/);
});

function fixture() {
 const first={id:'a',user_id:'owner',email:'first@example.test',provider:'google',status:'connected',services:['email']};
 const second={...first,id:'b',email:'second@example.test'};
 const db=database({connected_accounts:[first,second,{...first,id:'foreign',user_id:'other',email:'foreign@example.test'}]});
 const messages={},calls=[];let sends=0;
 const loaded=loader({
  '@/lib/openai':{generateWithOpenAI:async()=>{throw Error('No model call in listing');}},
  '@/lib/server/connections/accounts':{connectionStore:()=>db,listAccounts:async owner=>db.tables.connected_accounts.filter(a=>a.user_id===owner),connectionAudit:async()=>{}},
  '@/lib/server/connections/providers':{mailbox:pure('@/lib/server/connections/providers').mailbox,connectedProviders:async(owner,id)=>{
   const account=db.tables.connected_accounts.find(a=>a.user_id===owner&&a.id===id);assert.ok(account,'Foreign account must never be requested');
   return {account,email:{searchMessages:async input=>{calls.push({id,input});if(messages[id] instanceof Error)throw messages[id];return messages[id]||[];},createDraft:async()=>{sends++;throw Error('No draft');},sendMessage:async()=>{sends++;throw Error('No send');}}};
  }},
  '@/lib/server/connections/business-events':{recordConnectionEvent:async()=>{}},
  '@/app/api/clients/[id]/route':{PATCH:async()=>{throw Error('No CRM write');}},
  '@/app/api/properties/[id]/route':{PATCH:async()=>{throw Error('No CRM write');}},
 });
 const scope={db,userId:'owner',conversationId:randomUUID(),messageId:randomUUID(),text:'Montre mes cinq derniers courriels reçus',context:emptyCoachContext()};
 return {db,messages,calls,scope,handlers:loaded('@/lib/server/connections/coach-connected').connectedCoachHandlers,sends:()=>sends};
}
function mail(id,date,extra={}) {return {id,threadId:id,from:`${id}@sender.example`,to:['first@example.test'],subject:id,text:'Synthetic fixture only',receivedAt:date,sent:false,unread:true,...extra};}

test('Cinq reçus au total : mélange chronologique des comptes, provenance, aucun envoyé ni doublon',async()=>{
 const f=fixture();
 f.messages.a=[mail('a8','2026-10-21T08:00:00Z'),mail('sent','2026-10-21T12:00:00Z',{sent:true}),mail('a10','2026-10-21T06:00:00-04:00'),mail('a6','2026-10-21T06:00:00Z'),mail('a10','2026-10-21T10:00:00Z')];
 f.messages.b=[mail('b7','2026-10-21T07:00:00Z'),mail('b11','2026-10-21T11:00:00Z'),mail('b9','2026-10-21T09:00:00Z')];
 const reply=await f.handlers.get_recent_emails(f.scope,{tool:'get_recent_emails',values:{limit:20}});
 assert.deepEqual(reply.cards.map(c=>c.title),['b11','a10','b9','a8','b7']);
 assert.match(reply.text,/5 courriel.*reçu.*affiché/);assert.match(reply.text,/Limite de 5 au total/);assert.doesNotMatch(reply.text,/30 derniers jours|20 résultats/);
 assert.equal(f.calls.length,2);assert.equal(f.calls.every(c=>c.input.limit===5&&c.input.latest&&c.input.receivedOnly&&c.input.since===undefined),true);
 assert.ok(reply.cards[0].detail.includes('second@example.test'));assert.ok(reply.cards[1].detail.includes('first@example.test'));
 assert.equal(f.db.tables.connected_references.length,5);assert.equal(f.sends(),0);
});

test('Compte nommé, peu de résultats, dates absentes et accès partiel ne fabriquent pas cinq résultats',async()=>{
 const f=fixture();f.scope.text='Mes cinq derniers courriels reçus sur second@example.test';f.messages.b=[mail('old','2025-01-01T00:00:00Z'),mail('invalid','invalid')];
 const result=await f.handlers.search_emails(f.scope,{tool:'search_emails'});
 assert.equal(result.cards.length,1);assert.equal(result.cards[0].title,'old');assert.match(result.text,/date exploitable/);assert.match(result.text,/Résultat partiel/);assert.deepEqual(f.calls.map(c=>c.id),['b']);
 const partial=fixture();partial.messages.a=new Error('Reconnexion nécessaire');partial.messages.b=[mail('one','2026-10-21T10:00:00Z')];
 const limited=await partial.handlers.get_recent_emails(partial.scope,{tool:'get_recent_emails'});
 assert.equal(limited.cards.length,1);assert.match(limited.text,/Résultat partiel/);assert.match(limited.text,/first@example.test.*Reconnexion/);
});

test('Même identifiant fournisseur sur deux comptes : deux références distinctes; plafond annoncé',async()=>{
 const f=fixture();f.scope.text='Les 100 derniers courriels reçus';f.messages.a=[mail('same','2026-10-21T10:00:00Z')];f.messages.b=[mail('same','2026-10-21T09:00:00Z')];
 const reply=await f.handlers.get_recent_emails(f.scope,{tool:'get_recent_emails'});
 assert.equal(reply.cards.length,2);assert.notEqual(reply.cards[0].id,reply.cards[1].id);assert.match(reply.text,/Demande de 100.*limité à 30/);
});

test('Routeur existant : quantité et filtre conservés sans régression du destinataire',async()=>{
 const model=loader({'@/lib/openai':{generateWithOpenAI:async()=>JSON.stringify({tool:'search_emails',query:'Gmail',values:{limit:20}})}})('@/lib/server/coach-intent');
 const intent=await model.understandCoachMessage(emptyCoachContext(),[],'Peux-tu me montrer les cinq derniers courriels reçus sur Gmail ?');
 assert.equal(intent.values.limit,5);assert.equal(intent.values.latest,true);assert.equal(intent.values.receivedOnly,true);assert.equal(intent.query,undefined);
});

test('Gmail : requête reçus sans limite de 30 jours pour les derniers; recherche classique inchangée',async()=>{
 const urls=[];const p=new GoogleEmailProvider(async url=>{urls.push(new URL(url,'https://www.googleapis.com'));return {messages:[]};});
 await p.searchMessages({limit:5,latest:true,receivedOnly:true});
 assert.equal(urls[0].searchParams.get('maxResults'),'5');assert.match(urls[0].searchParams.get('q'),/-in:sent/);assert.doesNotMatch(urls[0].searchParams.get('q'),/newer_than|after:/);
 await p.searchMessages({query:'certificat'});assert.match(urls[1].searchParams.get('q'),/newer_than:30d/);
});

test('Microsoft : requête chronologique reçus, ancien courriel admissible et envoyé exclu',async()=>{
 let url;const p=new MicrosoftEmailProvider(async value=>{url=new URL(value,'https://graph.microsoft.com');return {value:[{id:'received',from:{emailAddress:{address:'client@example.test'}},receivedDateTime:'2025-01-01T00:00:00Z',toRecipients:[]},{id:'sent',from:{emailAddress:{address:'me@example.test'}},receivedDateTime:'2026-10-21T10:00:00Z',toRecipients:[]}]};},'me@example.test');
 const result=await p.searchMessages({limit:5,latest:true,receivedOnly:true});
 assert.equal(url.searchParams.get('$top'),'5');assert.equal(url.searchParams.get('$orderby'),'receivedDateTime desc');assert.match(url.searchParams.get('$filter'),/receivedDateTime ge 1970.*from\/emailAddress\/address ne 'me@example.test'/);
 assert.deepEqual(result.map(m=>m.id),['received']);
});
