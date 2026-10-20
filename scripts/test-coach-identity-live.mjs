// Opt-in actual OpenAI classification; never executed by the regression suite.
// Only synthetic context and the listed utterances are transmitted. No DB,
// Gmail, deployment, beta configuration or model/provider mutation.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
import {loader} from './helpers/connected-test-harness.mjs';
const cases=[
 {text:'Bonjour, peux-tu me dire quel est mon nom professionnel, mon agence et mes coordonnées enregistrées dans IACourtier?',tool:'get_professional_profile'},
 {text:'Quelles sont mes coordonnées?',tool:'get_professional_profile'},
 {text:'Quelle est mon agence?',tool:'get_professional_profile'},
 {text:'Quel est mon numéro de téléphone?',tool:'get_professional_profile'},
 {text:'Trouve les coordonnées de Martin',tool:'get_client',query:'Martin'},
 {text:'Prépare un courriel à Martin avec ma signature',tool:'draft_email',query:'Martin'},
 {text:'Ajoute mon téléphone à ce courriel',tool:'revise_email',context:{current_action_id:'11111111-1111-4111-8111-111111111111'}},
 {text:'Combien ai-je de clients?',tool:'count_clients'},
 {text:'Les coordonnées?',tool:'clarify_identity'},
 {text:'Et l’agence?',tool:'get_professional_profile',context:{current_identity_target:'broker'}},
 {text:'Où est-ce que je travaille?',tool:'get_professional_profile'},
];
const selected=cases.map((c,index)=>({caseNumber:index+1,...c})).filter(c=>!process.argv.includes('--skip-followup')||c.caseNumber!==10);
if(process.argv.includes('--plan')){
 console.log(JSON.stringify({actualProviderCalls:false,maximumCalls:10,cases:cases.map(c=>({text:c.text,expected:c.tool}))},null,2));
}else{
 if(process.env.RUN_COACH_IDENTITY_LIVE!=='1')throw Error('Live OpenAI test requires explicit RUN_COACH_IDENTITY_LIVE=1 approval. Use --plan first.');
 if(process.env.APP_ENV && process.env.APP_ENV!=='existing' || process.env.EXPECTED_SUPABASE_PROJECT_ID!==undefined || process.env.BETA_ENABLED_CAPABILITIES!==undefined)throw Error('Never run this test from a beta environment.');
 const config=parseEnv(readFileSync('.env.local','utf8'));
 for(const key of ['OPENAI_API_KEY','OPENAI_MODEL'])if(process.env[key]===undefined && config[key]!==undefined)process.env[key]=config[key];
 const load=loader(),{understandCoachMessage}=load('@/lib/server/coach-intent'),{emailConversationIntent}=load('@/lib/server/coach-professional-context'),{emptyCoachContext}=load('@/lib/coach/conversation');
 let attempted=0,passed=0;
 for(const c of selected){
  const context={...emptyCoachContext(),...c.context};
  try{
   let intent=emailConversationIntent(c.text,context);
   const source=intent?'existing-draft-router':'OpenAI';
   if(!intent){attempted++;assert.ok(attempted<=10);intent=await understandCoachMessage(context,[],c.text);}
   console.log(JSON.stringify({case:c.caseNumber,source,actualTool:intent.tool,expected:c.tool,query:intent.query||null,passed:intent.tool===c.tool&&(!c.query||intent.query===c.query)}));
   assert.equal(intent.tool,c.tool);if(c.query)assert.equal(intent.query,c.query);passed++;
  }catch(error){
   // Do not dump raw provider responses, profile data, credentials or prompts.
   const diagnostic=load('@/lib/openai').getOpenAIErrorPayload(error);
   console.error(JSON.stringify({failedCase:c.caseNumber,error:'Provider error or unexpected routing; no CRM or external action executed.',diagnostic:diagnostic?.body.diagnostic,status:diagnostic?.status,attemptedProviderCalls:attempted}));process.exitCode=1;break;
  }
 }
 console.log(JSON.stringify({requestedModel:process.env.OPENAI_MODEL||'gpt-4o-mini',attemptedProviderCalls:attempted,passedCases:passed,totalCases:selected.length,crmAccess:false,emailSent:false}));
}
