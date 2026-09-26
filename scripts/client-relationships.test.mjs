import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {loader,database} from './helpers/connected-test-harness.mjs';
import {normalizeUniversalPartial,mergeUniversalAnalyses} from '../src/lib/universal-import.ts';
const pure=loader()('@/lib/client-relationships');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('unordered spouse identity and directional parent/child labels',()=>{
 assert.deepEqual(pure.canonicalRelationship(a,b,'spouse'),pure.canonicalRelationship(b,a,'spouse'));
 assert.deepEqual(pure.canonicalRelationship(a,b,'parent'),pure.canonicalRelationship(b,a,'child'));
 assert.throws(()=>pure.canonicalRelationship(a,a,'spouse'));
 const rows=[{id:'r',...pure.canonicalRelationship(a,b,'parent')}],contacts=[{id:a},{id:b}];
 assert.equal(pure.relationshipViews(a,rows,contacts)[0].type,'child');assert.equal(pure.relationshipViews(b,rows,contacts)[0].type,'parent');
});
test('document keeps two named people sharing email, phone and address; only sourced links proposed',()=>{
 const source={name:'contrat.pdf',type:'Contrat de courtage vente',sourceType:'pdf',confidence:1};
 const people=[{firstName:'Jacques',lastName:'Blanchette'},{firstName:'Marie-Claude',lastName:'Lepine-Lavallée'}].map(p=>({...p,email:'couple@example.test',phone:'5145551234',mailingAddress:'175 des Hirondelles',roles:['seller'],sourceName:source.name}));
 const analysis=normalizeUniversalPartial({projectType:'seller',people,relationships:[{person1:'Jacques Blanchette',person2:'Marie-Claude Lepine-Lavallée',type:'spouse',confidence:.95,sourceName:source.name,evidence:'Les conjoints Jacques Blanchette et Marie-Claude Lepine-Lavallée'},{person1:'Jacques Blanchette',person2:'Marie-Claude Lepine-Lavallée',type:'co_owner',confidence:.95,sourceName:'invented.pdf',evidence:'invented'}]},[source]);
 const merged=mergeUniversalAnalyses([analysis,analysis]);assert.equal(merged.people.length,2);assert.equal(merged.relationships.length,1);assert.equal(merged.relationships[0].type,'spouse');
 assert.equal(pure.isCombinedPersonName('Jacques et Marie-Claude'),true);assert.equal(pure.isCombinedPersonName('Marie-Claude Lepine-Lavallée'),false);
 assert.equal(pure.distinctNamedPeople(people[0],people[1]),true);
});
test('Coach link → spouse → one chosen case → shared cases keeps individual records and context',async()=>{
 const caseId=randomUUID(),privateCaseId=randomUUID(),conversationId=randomUUID();let intents=[];
 const db=database({clients:[{id:a,user_id:'owner',first_name:'Jacques',last_name:'Blanchette',email:'jacques@example.test'},{id:b,user_id:'owner',first_name:'Marie-Claude',last_name:'Lepine-Lavallée',email:'marie@example.test'}],client_cases:[{id:caseId,user_id:'owner',primary_client_id:a,title:'175 des Hirondelles',case_type:'seller',status:'active'},{id:privateCaseId,user_id:'owner',primary_client_id:a,title:'Dossier individuel',case_type:'buyer',status:'active'}],coach_conversations:[{id:conversationId,user_id:'owner',context:{}}]});
 const load=loader({'@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async()=>JSON.stringify(intents.shift())},'@/lib/server/connections/coach-connected':{connectedCoachHandlers:{draft_email:async s=>({text:'Aperçu',cards:[],context:s.context,draft:{recipient:s.emailRecipients.join(', '),subject:'Suivi',message:'Bonjour'}})}},'@/app/api/clients/[id]/route':{PATCH:async()=>Response.json({})},'@/app/api/properties/[id]/route':{PATCH:async()=>Response.json({})}});
 const {processCoachMessage}=load('@/lib/server/process-coach-message');
 const send=async(text,intent)=>{intents.push(intent);return processCoachMessage(db,'owner',{conversationId,messageId:randomUUID(),text});};
 let reply=await send('Jacques Blanchette est le conjoint de Marie-Claude Lepine-Lavallée.',{tool:'link_clients',values:{person1:'Jacques Blanchette',person2:'Marie-Claude Lepine-Lavallée',relationshipType:'spouse'}});
 assert.equal(reply.changed,true,reply.text);assert.equal(db.tables.clients.length,2);assert.equal(db.tables.client_relationships.length,1);assert.equal((db.tables.client_case_clients||[]).length,0);
 reply=await send('La conjointe de Jacques',{tool:'get_related_client',query:'Jacques'});assert.equal(reply.cards[0].id,b);
 reply=await send('Ajoute sa conjointe au dossier vendeur',{tool:'add_related_to_case',caseType:'seller'});assert.equal(reply.changed,true,reply.text);assert.deepEqual(db.tables.client_case_clients.map(r=>[r.client_id,r.case_id]),[[b,caseId]]);
 reply=await send('Montre les dossiers de ce couple',{tool:'get_couple_cases'});assert.deepEqual(reply.cards.map(c=>c.id),[caseId]);
 reply=await send('Envoie un courriel à Jacques et sa conjointe',{tool:'draft_relationship_email',query:'Jacques'});assert.equal(reply.draft.recipient,'jacques@example.test, marie@example.test');assert.equal(reply.approval,undefined); // stub stops at recipient resolution; providers tested below
 const service=load('@/lib/server/client-relationships');assert.equal((await service.getClientRelationships(db,'owner',b))[0].contact.id,a);
 await assert.rejects(service.linkClients(db,'other',a,b,'spouse'),/inaccessible/);
 await assert.rejects(service.addRelatedParticipant(db,'owner',b,a,privateCaseId),/départ/);
});
test('Gmail and Graph drafts use both verified recipients without sending',async()=>{
 const {googleMime,MicrosoftEmailProvider}=loader({'@/lib/server/connections/accounts':{}})('@/lib/server/connections/providers');
 const input={to:['jacques@example.test','marie@example.test'],subject:'Suivi',text:'Bonjour',operationId:randomUUID()};
 const raw=Buffer.from(googleMime(input),'base64url').toString();assert.match(raw,/To: jacques@example.test, marie@example.test\r\n/);
 const calls=[];await new MicrosoftEmailProvider(async(path,init)=>{calls.push({path,body:JSON.parse(init.body)});return {id:'draft'};},'broker@example.test').createDraft(input);
 assert.deepEqual(calls[0].body.toRecipients.map(r=>r.emailAddress.address),input.to);assert.equal(calls.length,1);assert.doesNotMatch(calls[0].path,/send/);
});
