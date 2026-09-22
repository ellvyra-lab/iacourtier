// Opt-in. Synthetic text only; no email account or CRM is contacted.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loader} from './helpers/connected-test-harness.mjs';
const load=loader(),{understandCoachMessage}=load('@/lib/server/coach-intent');
const {emptyCoachContext}=load('@/lib/coach/conversation');
const {dateWindow}=load('@/lib/connections/dates');
const context={...emptyCoachContext(),current_email_id:'11111111-1111-4111-8111-111111111111',current_thread_id:'synthetic-thread',current_action_id:'22222222-2222-4222-8222-222222222222'};
const history=[{text:'Montre-moi le courriel du 91 Régent.',reply:{text:'Jacques demande le certificat de localisation. Il propose une visite jeudi à 14 h.'}}];
for (const [text,tools] of [
  ['Salut, fais-moi mon topo.',['daily_brief']],
  ['Est-ce que Jacques m’a répondu ?',['search_emails']],
  ['Qu’est-ce qu’il dit ?',['get_email_thread','get_email']],
  ['Réponds-lui que jeudi fonctionne.',['reply_email']],
  ['Envoie.',['send_email']],
  ['Fais-moi un rappel à midi.',['create_task']],
  ['Est-ce que je suis libre jeudi après-midi ?',['check_availability']],
  ['Ajoute une visite jeudi à 15 h au 91 Régent.',['create_calendar_event']],
  ['Déplace mon rendez-vous avec Jacques à 15 h.',['update_calendar_event']],
  ['Fais un suivi vendredi s’il ne répond pas.',['conditional_followup']],
  ['Trouve tout ce qui concerne le 91 Régent.',['search_everywhere']],
]) test(`IA réelle 055 : ${text}`,{skip:!process.env.OPENAI_API_KEY},async()=>{
  const intent=await understandCoachMessage(context,structuredClone(history),text);
  assert.ok(tools.includes(intent.tool),JSON.stringify(intent));
  if(text.includes('15 h')||text.includes('midi')) { assert.ok(intent.dateExpression,JSON.stringify(intent)); const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Toronto',hour:'2-digit',hourCycle:'h23'}).format(new Date(dateWindow(intent.dateExpression).start)); assert.equal(hour,text.includes('15 h')?'15':'12',JSON.stringify(intent)); }
  if(text.includes('rappel'))assert.match(intent.title,/certificat|localisation/i);
});
