// Opt-in: node --env-file=.env.local --test scripts/coach-intent-live.test.mjs
// Uses only synthetic ticket examples; never reads or mutates CRM data.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const js = ts.transpileModule(readFileSync(`src/${name.slice(2)}.ts`, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }; cache.set(name,module.exports);
  new Function("require","module","exports",js)(load,module,module.exports);return module.exports;
}
const { understandCoachMessage } = load("@/lib/server/coach-intent");
const { emptyCoachContext } = load("@/lib/coach/conversation");
const { analyzeInboxText } = load("@/lib/server/ai-inbox");
test("IA réelle : extraction complète de Chantal avant écriture", {skip:!process.env.OPENAI_API_KEY}, async()=>{
  const {analysis,engine}=await analyzeInboxText("Ajoute Chantal Beaulieu. Elle cherche à Repentigny ou L’Assomption jusqu’à 550 000 $, 3 chambres, garage obligatoire. Elle n’est pas préqualifiée. Rappelle-moi de l’appeler mardi.");
  assert.equal(engine,"openai");assert.equal(analysis.person.firstName,"Chantal");assert.equal(analysis.person.lastName,"Beaulieu");
  assert.equal(analysis.caseType,"buyer");assert.equal(analysis.buyerCriteria.budgetMax,550000);assert.equal(analysis.buyerCriteria.bedroomsMin,3);assert.equal(analysis.buyerCriteria.garageRequired,true);assert.equal(analysis.financing.prequalified,false);
  assert.equal(analysis.buyerCriteria.sectors.length,2);assert.ok(analysis.tasks.some(task=>task.actionType==="call"&&task.dueOn));
});
for (const scenario of [
  { text:"Trouve Jacques Blanchette.",tools:["search_clients","get_client"],query:"Jacques Blanchette" },
  { text:"Ouvre son dossier.",tools:["get_case"],open:true },
  { text:"Qu’est-ce qui manque ?",tools:["get_missing_information"] },
  { text:"Rappelle-moi vendredi de lui demander les documents manquants.",tools:["create_task"] },
  { text:"Ajoute Chantal Beaulieu. Elle cherche à Repentigny ou L’Assomption jusqu’à 550 000 $, 3 chambres, garage obligatoire. Elle n’est pas préqualifiée. Rappelle-moi de l’appeler mardi.",tools:["create_client"] },
  { text:"Change son budget à 600 000 $.",tools:["update_case"] },
  { text:"Ajoute Mascouche dans ses secteurs.",tools:["update_case"] },
  { text:"Écris-y pour demander son certificat de localisation.",tools:["draft_email"] },
  { text:"Appelle Marc Tremblay.",tools:["phone_call"],query:"Marc Tremblay" },
]) test(`IA réelle : ${scenario.text.slice(0,70)}`,{skip:!process.env.OPENAI_API_KEY},async()=>{
  const context={...emptyCoachContext(),current_client_id:"11111111-1111-4111-8111-111111111111",current_case_id:"22222222-2222-4222-8222-222222222222"};
  const intent=await understandCoachMessage(context,[{text:"Trouve Jacques Blanchette.",reply:{text:"J’ai trouvé Jacques Blanchette, vendeur lié au 175 des Hirondelles."}}],scenario.text);
  assert.ok(scenario.tools.includes(intent.tool),JSON.stringify(intent));
  if(scenario.query)assert.equal(intent.query,scenario.query);
  else if(intent.tool!=="create_client")assert.ok(!intent.query,`Pronoun must use persisted IDs, not name extracted from history: ${JSON.stringify(intent)}`);
  if(scenario.open)assert.equal(intent.open,true);
  if(scenario.text.includes("600"))assert.equal(intent.values.budget,600000);
  if(scenario.text.includes("Mascouche"))assert.deepEqual(intent.values.addSectors,["Mascouche"]);
});
