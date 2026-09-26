// Opt-in: synthetic conversation only; no CRM or email account is contacted.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loader} from './helpers/connected-test-harness.mjs';
const load=loader();
const {understandCoachMessage}=load('@/lib/server/coach-intent');
const {emptyCoachContext}=load('@/lib/coach/conversation');
const context={...emptyCoachContext(),current_client_id:'11111111-1111-4111-8111-111111111111',current_relationship_client_ids:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']};
for(const [text,tool] of [
 ['Marie-Claude est la conjointe de Jacques.','link_clients'],
 ['Ajoute la conjointe de Jacques au dossier vendeur.','add_related_to_case'],
 ['Envoie un courriel à Jacques et sa conjointe.','draft_relationship_email'],
 ['Montre-moi les dossiers de ce couple.','get_couple_cases'],
 ['Qui est la conjointe de Jacques ?','get_related_client'],
]) test(`Relations, IA réelle : ${text}`,{skip:!process.env.OPENAI_API_KEY},async()=>{
 const intent=await understandCoachMessage(context,[],text);
 assert.equal(intent.tool,tool,JSON.stringify(intent));
 if(tool==='link_clients')assert.deepEqual(new Set([intent.values?.person1,intent.values?.person2]),new Set(['Marie-Claude','Jacques']));
});
