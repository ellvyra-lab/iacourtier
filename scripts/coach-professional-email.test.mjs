import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {database,loader} from './helpers/connected-test-harness.mjs';
let db,models=[],requests=[],outgoing=[],sends=0,failModel=false,failGmail=false;
const load=loader({
 '@/lib/openai':{getOpenAIErrorPayload:()=>null,generateWithOpenAI:async input=>{requests.push(input);if(failModel)throw Error('Modèle indisponible');const next=models.shift();if(!next)throw Error('Unexpected model call');return JSON.stringify(next);}},
 '@/lib/server/connections/accounts':{connectionStore:()=>db,listAccounts:async owner=>(db.tables.connected_accounts || []).filter(a=>a.user_id===owner),connectionAudit:async()=>{}},
 '@/lib/server/connections/providers':{mailbox:value=>{const address=(value.match(/<([^<>]+)>/)?.[1] || value).trim();if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(address))throw Error('Adresse invalide');return address;},connectedProviders:async(owner,id)=>{const account=db.tables.connected_accounts.find(a=>a.user_id===owner&&a.id===id&&a.status==='connected');if(!account)throw Error('Compte inaccessible');const email=db.tables.fixture_emails.find(e=>e.owner===owner);return {account,email:{getMessage:async()=>structuredClone(email),getThread:async()=>[structuredClone(email)],createDraft:async input=>{outgoing.push({account:id,...input});return 'native-draft';},sendMessage:async()=>{sends++;if(failGmail)throw Error('Gmail indisponible');return {id:'sent-real-fixture',threadId:'thread',accepted:false};}}};}},
 '@/app/api/clients/[id]/route':{PATCH:async()=>Response.json({})},'@/app/api/properties/[id]/route':{PATCH:async()=>Response.json({})},
});
const {processCoachMessage}=load('@/lib/server/process-coach-message');
const {connectedCoachHandlers,handleConnectedAction}=load('@/lib/server/connections/coach-connected');
const {emailConversationIntent}=load('@/lib/server/coach-professional-context');
function setup(){
 const conversationId=randomUUID(),accountId=randomUUID(),otherAccountId=randomUUID(),refId=randomUUID(),clientId=randomUUID();
 db=database({profiles:[{id:'owner',professional_profile:{fullName:'Sonia Test',professionalTitle:'Courtière immobilière',agencyName:'Agence Fictive',phone:'514-555-0101',email:'broker@example.test',addressMode:'vous',communicationTones:['chaleureux']},updated_at:'version-1'},{id:'other',professional_profile:{fullName:'Autre Courtier',email:'private@example.test',phone:'450-555-0199',signature:'Signature privée'}}],connected_accounts:[{id:accountId,user_id:'owner',provider:'google',email:'broker@example.test',status:'connected',services:['email'],defaults:['email']},{id:otherAccountId,user_id:'owner',provider:'google',email:'second@example.test',status:'connected',services:['email']}],clients:[{id:clientId,user_id:'owner',first_name:'Client',last_name:'Fictif',email:'client@example.test'}],fixture_emails:[{owner:'owner',id:'incoming',threadId:'thread',from:'Client <client@example.test>',replyTo:'client@example.test',to:['broker@example.test'],subject:'Question sur le dossier',text:'Merci pour votre suivi concernant la visite.',sent:false,receivedAt:new Date().toISOString()}],connected_references:[{id:refId,user_id:'owner',account_id:accountId,kind:'email',remote_id:'incoming',thread_id:'thread',client_id:clientId,case_id:null,property_id:null}],coach_conversations:[{id:conversationId,user_id:'owner',context:{current_email_id:refId,current_thread_id:'thread',current_account_id:accountId,current_client_id:clientId}}]});
 models=[];requests=[];outgoing=[];sends=0;failModel=false;failGmail=false;
 const message=async(text,action)=>processCoachMessage(db,'owner',{conversationId,messageId:randomUUID(),text,action});
 const scope=()=>({db,userId:'owner',conversationId,messageId:randomUUID(),text:'Réponds au client',context:structuredClone(db.tables.coach_conversations[0].context)});
 const draft=async()=>{models.push({tool:'reply_email'},{message:'Bonjour, merci pour votre message.',question:''});return message('Prépare une réponse de remerciement.');};
 return {conversationId,accountId,otherAccountId,refId,clientId,message,scope,draft};
}
test('057 A/B : profil serveur, vrai correspondant, en-têtes, préférences et signature séparés',async()=>{
 const f=setup(),r=await f.draft();assert.equal(r.draft.recipient,'client@example.test');assert.match(r.draft.signature,/Sonia Test/);assert.match(r.draft.signature,/514-555-0101/);assert.equal(r.draft.sender,'broker@example.test');assert.equal(r.draft.accounts.length,2);assert.equal(sends,0);
 const input=JSON.parse(requests[1].userPrompt);assert.equal(input.courtier.nom,'Sonia Test');assert.equal(input.correspondant.adresse,'client@example.test');assert.equal(input.messageRecu.from,'Client <client@example.test>');assert.equal(input.filsRecents.length,1);assert.doesNotMatch(requests[1].userPrompt,/Autre Courtier|450-555-0199|Signature privée/);
 const payload=db.tables.connected_actions[0].payload;assert.equal(payload.originalAccountId,f.accountId);assert.equal(payload.threadId,'thread');assert.equal(payload.referenceId,f.refId);assert.equal(payload.original.to[0],'broker@example.test');
});
test('057 B : Reply-To du courtier ne devient jamais automatiquement le destinataire',async()=>{
 const f=setup();db.tables.fixture_emails[0].replyTo='broker@example.test';const r=await f.draft();assert.equal(r.draft.recipient,'client@example.test');await f.message('Envoie');assert.equal(outgoing[0].to,'client@example.test');assert.equal(sends,1);
});
test('057 C/D : retouches après relecture conservent le destinataire, objet et faits; versions précédentes refusées',async()=>{
 const f=setup(),initial=await f.draft();let r=await f.message('Ajoute mon téléphone');assert.equal(r.draft.message,initial.draft.message);assert.equal(r.draft.recipient,initial.draft.recipient);assert.equal(r.draft.subject,initial.draft.subject);assert.notEqual(r.approval.id,initial.approval.id);assert.equal(requests.length,2);
 const actionBefore=r.approval.id;models.push({message:'Bonjour, merci beaucoup pour votre message.',question:''});r=await f.message('Rends ça plus chaleureux');assert.equal(r.draft.recipient,initial.draft.recipient);assert.equal(r.draft.subject,initial.draft.subject);const prompt=JSON.parse(requests.at(-1).userPrompt);assert.equal(prompt.brouillonPrecedent,initial.draft.message);assert.equal(prompt.messageRecu.threadId,'thread');
 await assert.rejects(handleConnectedAction(f.scope(),{id:actionBefore,mode:'confirm'}),/plus exécutable/);assert.equal(sends,0);
 models.push({message:'Merci pour votre message.',question:''});r=await f.message('Raccourcis');assert.equal(r.draft.message,'Merci pour votre message.');assert.equal(r.draft.recipient,'client@example.test');
});
test('057 E : changement de signature relu depuis le profil au prochain brouillon',async()=>{
 const f=setup();await f.draft();db.tables.profiles[0].professional_profile.signature='Nouvelle signature professionnelle';models.push({tool:'reply_email'},{message:'Bonjour.',question:''});const r=await f.message('Prépare une autre réponse.');assert.equal(r.draft.signature,'Nouvelle signature professionnelle');assert.equal(sends,0);
});
test('057 F/G : compte expéditeur indépendant, propriétaire et conversation contrôlés',async()=>{
 const f=setup(),initial=await f.draft(),r=await f.message('Utilise mon autre courriel');assert.equal(r.draft.accountId,f.otherAccountId);assert.equal(r.draft.message,initial.draft.message);assert.equal(r.draft.subject,initial.draft.subject);assert.equal(r.draft.recipient,'client@example.test');
 await assert.rejects(handleConnectedAction({...f.scope(),userId:'other'},{id:r.approval.id,mode:'confirm'}),/accessible/);await assert.rejects(handleConnectedAction({...f.scope(),conversationId:randomUUID()},{id:r.approval.id,mode:'confirm'}),/accessible/);
 await f.message('Envoie');assert.equal(outgoing[0].account,f.otherAccountId);assert.equal(outgoing[0].replyTo.threadId,'');assert.equal(sends,1);
});
test('057 H : préparer ne signifie pas envoyer; seul le dernier aperçu confirmé est envoyé',async()=>{
 const f=setup(),first=await f.draft();let r=await f.message('Parfait, prépare-le pour l’envoi');assert.equal(sends,0);assert.equal(r.approval.id,first.approval.id);
 r=await f.message('Enregistrer les modifications.',{id:r.approval.id,mode:'edit',recipient:'autre-client@example.test',subject:'Objet corrigé',message:'Corps final',signature:'Signature finale',accountId:f.otherAccountId});assert.equal(sends,0);assert.equal(r.draft.recipient,'autre-client@example.test');assert.notEqual(r.approval.id,first.approval.id);
 await f.message('Confirmer la version finale.',{id:r.approval.id,mode:'confirm'});assert.equal(sends,1);assert.equal(outgoing[0].text,'Corps final\n\nSignature finale');assert.equal(outgoing[0].to[0],'autre-client@example.test');
 await handleConnectedAction(f.scope(),{id:r.approval.id,mode:'confirm'});assert.equal(sends,1);
});
test('057 : téléphone manquant, proposition distincte, confirmation et reprise du même brouillon',async()=>{
 const f=setup();await f.draft();db.tables.profiles[0].professional_profile.phone='';let r=await f.message('Ajoute mon téléphone');assert.equal(r.text,'Quel téléphone professionnel veux-tu ajouter ?');assert.equal(r.draft,undefined);assert.equal(sends,0);
 r=await f.message('514-555-0123');assert.ok(r.profileUpdate);assert.equal(db.tables.profiles[0].professional_profile.phone,'');assert.equal(db.tables.clients[0].phone,undefined);
 r=await f.message('Enregistrer mon profil.',{id:r.profileUpdate.id,mode:'profile_confirm'});assert.equal(db.tables.profiles[0].professional_profile.phone,'514-555-0123');assert.match(r.draft.signature,/514-555-0123/);assert.equal(r.draft.recipient,'client@example.test');assert.equal(sends,0);
});
test('057 : proposition de profil refusée par autre courtier, annulée sans écriture et conflit détecté',async()=>{
 const f=setup();let r=await f.message('Mon téléphone est 514-555-0144');const id=r.profileUpdate.id;await assert.rejects(handleConnectedAction({...f.scope(),userId:'other',context:{}},{id,mode:'profile_confirm'}),/plus active/);
 r=await f.message('Annuler.',{id,mode:'profile_cancel'});assert.equal(db.tables.profiles[0].professional_profile.phone,'514-555-0101');
 r=await f.message('Mon téléphone est 514-555-0144');db.tables.profiles[0].professional_profile.phone='514-555-0155';await assert.rejects(handleConnectedAction(f.scope(),{id:r.profileUpdate.id,mode:'profile_confirm'}),/profil a changé/);
});
test('057 : question métier ciblée, réponse conservée, aucune promesse inventée ni envoi',async()=>{
 const f=setup();models.push({tool:'reply_email'},{message:'',question:'Quelle date de visite est confirmée ?'});let r=await f.message('Réponds avec la date de visite.');assert.match(r.text,/Quelle date/);assert.equal(r.draft,undefined);
 models.push({message:'La visite est confirmée jeudi à 14 h.',question:''});r=await f.message('Jeudi à 14 h');assert.ok(r.draft);assert.match(JSON.parse(requests.at(-1).userPrompt).instructionDuCourtier,/Jeudi à 14 h/);assert.equal(sends,0);
});
test('057 : erreurs modèle/Gmail restent réelles et les messages privés ne vont pas dans les logs',async()=>{
 const f=setup(),r=await f.draft();failModel=true;const logs=[],savedInfo=console.info,savedError=console.error;let failed;try{console.info=(...args)=>logs.push(args);console.error=(...args)=>logs.push(args);failed=await f.message('Rends ça plus professionnel');}finally{console.info=savedInfo;console.error=savedError;}assert.doesNotMatch(JSON.stringify(logs),/Sonia Test|client@example|514-555|Question sur le dossier|Modèle indisponible/);assert.match(failed.text,/Modèle indisponible/);assert.equal(db.tables.connected_actions[0].status,'preview');assert.equal(sends,0);
 failModel=false;failGmail=true;await assert.rejects(handleConnectedAction(f.scope(),{id:r.approval.id,mode:'confirm'}),/Gmail indisponible/);assert.equal(db.tables.connected_actions[0].status,'uncertain');assert.equal(sends,1);
});
test('057 : préparation et retouches explicites ne passent pas dans un nouveau routeur modèle',()=>{
 const context={current_action_id:randomUUID()};for(const phrase of ['Ajoute mon téléphone','Rends ça plus professionnel','Raccourcis'])assert.equal(emailConversationIntent(phrase,context).tool,'revise_email');assert.equal(emailConversationIntent('Parfait, prépare-le pour l’envoi',context).tool,'prepare_email');assert.equal(emailConversationIntent('Utilise mon autre courriel',context).tool,'switch_email_account');
});


test('057 : aucune coordonnée inventée par le routeur n’est enregistrable',async()=>{
 const f=setup();await assert.rejects(connectedCoachHandlers.propose_professional_update(f.scope(),{tool:'propose_professional_update',values:{field:'phone',value:'514-555-0109'}}),/Précise|explicitement/);assert.equal(db.tables.profiles[0].professional_profile.phone,'514-555-0101');
});
