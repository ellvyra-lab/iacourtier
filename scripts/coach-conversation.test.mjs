import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";

let db;
let modelReplies = [];
const cache = new Map();
function load(name) {
  if (name === "@/lib/server/connections/coach-connected") return { connectedCoachHandlers:{} };
  if (name === "@/lib/openai") return { generateWithOpenAI: async () => { const next = modelReplies.shift(); if (next instanceof Error) throw next; if (!next) throw Error("Unexpected model request"); return typeof next === "string" ? next : JSON.stringify(next); } };
  if (name === "@/app/api/clients/[id]/route") return { PATCH: async (request, context) => { const { id } = await context.params; const body = await request.json(); const row = db.tables.clients.find(row => row.id === id && row.user_id === "owner"); Object.assign(row, body.values); return Response.json({ client: row }); } };
  if (name === "@/app/api/properties/[id]/route") return { PATCH: async () => Response.json({ error: "Not used in this test" }, {status:400}) };
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(`src/${name.slice(2)}.ts`, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }; cache.set(name, module.exports);
  new Function("require", "module", "exports", js)(load, module, module.exports);
  return module.exports;
}
const { processCoachMessage } = load("@/lib/server/process-coach-message");
const { emptyCoachContext, parseCoachIntent } = load("@/lib/coach/conversation");
const { coachDate } = load("@/lib/server/coach-tools");

// Query-contract test double; the real resolver, tool handlers, capture service and
// operating engine execute here. This is not a substitute for live Supabase RLS QA.
function database(seed = {}) {
  const tables = structuredClone(seed);
  const locks = new Set();
  const result = { tables, rpc(name, args) { if (name === "claim_coach_lock") { if (locks.size) return Promise.resolve({ data:false,error:null }); locks.add(args.lock_token); } else locks.delete(args.lock_token); return Promise.resolve({ data:true,error:null }); }, from(table) {
    const rows = tables[table] ||= [];
    let filters=[],op,values,options={},single=false,start=0,end=Infinity,sort;
    const q = {
      select(){return q;}, eq(k,v){filters.push(r=>r[k]===v);return q;}, neq(k,v){filters.push(r=>r[k]!==v);return q;}, is(k,v){filters.push(r=>(r[k]??null)===v);return q;}, in(k,v){filters.push(r=>v.includes(r[k]));return q;},
      order(k,opts={}){sort={k,asc:opts.ascending!==false};return q;}, range(a,b){start=a;end=b+1;return q;}, limit(n){end=n;return q;}, single(){single=true;return q;}, maybeSingle(){single=true;return q;},
      insert(v){op="insert";values=v;return q;}, update(v){op="update";values=v;return q;}, upsert(v,o={}){op="upsert";values=v;options=o;return q;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        let found=rows.filter(r=>filters.every(f=>f(r)));
        if(sort)found.sort((a,b)=>String(a[sort.k]??"").localeCompare(String(b[sort.k]??""))*(sort.asc?1:-1));
        found=found.slice(start,end);
        if(op==="update")found.forEach(r=>Object.assign(r,structuredClone(values)));
        if(op==="insert"||op==="upsert")found=(Array.isArray(values)?values:[values]).map(v=>{
          const keys=options.onConflict?.split(","); const existing=keys&&rows.find(r=>keys.every(k=>r[k]===v[k]));
          if(existing){if(!options.ignoreDuplicates)Object.assign(existing,structuredClone(v));return existing;}
          const row={id:randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),status:"pending",metadata:{},...structuredClone(v)};rows.push(row);return row;
        });
        return {data:structuredClone(single?found[0]||null:found),error:null};
      }).then(resolve,reject);}
    };return q;
  }};
  return result;
}
function fixture() {
  const clientId=randomUUID(),caseId=randomUUID(),conversationId=randomUUID();
  db=database({clients:[{id:clientId,user_id:"owner",first_name:"Jacques",last_name:"Blanchette",roles:["seller"]}],client_cases:[{id:caseId,user_id:"owner",primary_client_id:clientId,title:"175 des Hirondelles",case_type:"seller",pipeline_type:"seller",status:"active",pipeline_mode:"assisted",current_stage:"qualification"}],coach_conversations:[{id:conversationId,user_id:"owner",context:emptyCoachContext(),pending:null}]});
  return {clientId,caseId,conversationId};
}
async function message(conversationId,text,intent,extra={}){if(intent)modelReplies.push(intent);return processCoachMessage(db,"owner",{conversationId,messageId:randomUUID(),text,...extra});}

test("A: Jacques → dossier → manquants → tâche conserve les IDs et ne duplique pas", async()=>{
  const {clientId,caseId,conversationId}=fixture();
  let answer=await message(conversationId,"Trouve Jacques Blanchette.",{tool:"search_clients",query:"Jacques Blanchette"});
  assert.equal(answer.context.current_client_id,clientId);
  answer=await message(conversationId,"Ouvre son dossier.",{tool:"get_case",open:true});
  assert.equal(answer.navigate,`/tableau-de-bord/dossiers/${caseId}`);
  answer=await message(conversationId,"Qu’est-ce qui manque ?",{tool:"get_missing_information"});
  assert.equal(answer.context.current_case_id,caseId);
  const input={conversationId,messageId:randomUUID(),text:"Ajoute une tâche vendredi pour demander les documents manquants."};
  modelReplies.push({tool:"create_task",title:"Demander les documents manquants",dateExpression:"vendredi"});
  answer=await processCoachMessage(db,"owner",input);
  assert.equal(answer.changed,true);
  const task=db.tables.tasks.find(row=>row.title==="Demander les documents manquants");
  assert.equal(task.case_id,caseId);assert.equal(task.client_id,clientId);
  const before=db.tables.tasks.length;
  await processCoachMessage(db,"owner",input);
  assert.equal(db.tables.tasks.length,before);assert.equal(db.tables.clients.length,1);
});

test("B: Chantal acheteuse, critères, financement, rappel et aucune duplication",async()=>{
  const {conversationId}=fixture();
  const text="Ajoute Chantal Beaulieu. Elle cherche à Repentigny ou L’Assomption jusqu’à 550 000 $, 3 chambres, garage obligatoire. Elle n’est pas préqualifiée. Rappelle-moi de l’appeler mardi.";
  const analysis={person:{firstName:"Chantal",lastName:"Beaulieu",email:"",phone:""},caseType:"buyer",project:"Achat",property:{address:"",city:"",propertyType:""},buyerCriteria:{sectors:["Repentigny","L’Assomption"],budgetMax:550000,bedroomsMin:3,garageRequired:true,mustHaves:["Garage obligatoire"],preferences:[]},financing:{prequalified:false,amount:null},tasks:[{title:"Appeler Chantal",dueLabel:"mardi",actionType:"call",priorityScore:50}],confidence:1};
  modelReplies.push({tool:"create_client",capture:text},analysis);
  const response=await message(conversationId,text);
  assert.equal(response.changed,true,response.text);
  const client=db.tables.clients.find(row=>row.first_name==="Chantal"); assert.ok(client.roles.includes("buyer"));
  const c=db.tables.client_cases.find(row=>row.primary_client_id===client.id);assert.equal(c.case_type,"buyer");
  const buyer=db.tables.buyer_cases.find(row=>row.client_case_id===c.id);assert.equal(buyer.budget,"550000");assert.equal(buyer.bedrooms,"3");assert.ok(buyer.important_needs.includes("Garage"));assert.ok(buyer.sectors.includes("Repentigny"));
  assert.equal(db.tables.buyer_financing.find(row=>row.case_id===buyer.id).status,"missing");
  assert.equal(new Date(db.tables.tasks.find(row=>row.title==="Appeler Chantal").due_on+"T12:00:00Z").getUTCDay(),2);
  modelReplies.push({tool:"create_client",capture:text},analysis);await message(conversationId,text);
  assert.equal(db.tables.clients.filter(row=>row.first_name==="Chantal").length,1);assert.equal(db.tables.client_cases.filter(row=>row.primary_client_id===client.id).length,1);
});

test("C/E: budget et ajout de secteur persistent dans la source centrale; le Coach relit les changements CRM",async()=>{
  const {clientId,caseId,conversationId}=fixture();
  Object.assign(db.tables.clients[0],{first_name:"Chantal",last_name:"Beaulieu",roles:["buyer"]});
  Object.assign(db.tables.client_cases[0],{case_type:"buyer",pipeline_type:"buyer"});
  db.tables.buyer_cases=[{id:randomUUID(),user_id:"owner",contact_id:clientId,client_case_id:caseId,budget:"550000",sectors:["Repentigny","L’Assomption"]}];
  await message(conversationId,"Montre-moi Chantal.",{tool:"search_clients",query:"Chantal"});
  let answer=await message(conversationId,"Change son budget à 600 000 $.",{tool:"update_case",values:{budget:600000}});
  assert.equal(answer.changed,true,answer.text);assert.equal(db.tables.buyer_cases[0].budget,"600000");
  await message(conversationId,"Ajoute Mascouche dans ses secteurs.",{tool:"update_case",values:{addSectors:["Mascouche"]}});
  assert.deepEqual(db.tables.buyer_cases[0].sectors,["Repentigny","L’Assomption","Mascouche"]);
  db.tables.clients[0].phone="514-555-1234";
  answer=await message(conversationId,"Quel est son téléphone ?",{tool:"get_client"});assert.match(answer.text,/514-555-1234/);
  assert.equal(answer.context.current_client_id,clientId);
});

test("D: homonymes exigent un choix; la demande reprend avec le bon ID",async()=>{
  const {conversationId}=fixture();
  db.tables.clients.push(...["Repentigny","Mascouche"].map(city=>({id:randomUUID(),user_id:"owner",first_name:"Marc",last_name:"Tremblay",city,phone:"514-555-0000"})));
  const answer=await message(conversationId,"Appelle Marc Tremblay.",{tool:"phone_call",query:"Marc Tremblay"});
  assert.equal(answer.choices.length,2);assert.equal(answer.context.current_client_id,null);
  const selected=answer.choices[1];const result=await message(conversationId,selected.label,null,{choiceId:selected.id});
  assert.equal(result.context.current_client_id,selected.id);assert.match(result.text,/Tu peux appeler/);
});

test("nouveau client efface dossier/tâche/doc; compte étranger invisible",async()=>{
  const {conversationId,caseId}=fixture();
  await message(conversationId,"Jacques",{tool:"get_case",query:"Jacques"});
  db.tables.clients.push({id:randomUUID(),user_id:"owner",first_name:"Marie",last_name:"Roy"},{id:randomUUID(),user_id:"other",first_name:"Secret",last_name:"Client"});
  let answer=await message(conversationId,"Maintenant Marie",{tool:"search_clients",query:"Marie"});
  assert.notEqual(answer.context.current_case_id,caseId);assert.equal(answer.context.current_case_id,null);
  answer=await message(conversationId,"Trouve Secret Client",{tool:"search_clients",query:"Secret Client"});
  assert.equal(answer.cards.length,0);assert.equal(answer.context.current_client_id,null);
});

test("plusieurs dossiers : aucune tâche avant choix, dossier choisi conservé",async()=>{
  const {conversationId,clientId}=fixture();
  db.tables.client_cases.push({...db.tables.client_cases[0],id:randomUUID(),title:"Deuxième vente"});
  await message(conversationId,"Jacques",{tool:"search_clients",query:"Jacques"});
  const answer=await message(conversationId,"Crée mon rappel",{tool:"create_task",title:"Suivi",dateExpression:"mardi"});
  assert.equal(answer.choices.length,2);assert.equal((db.tables.tasks||[]).length,0);
  const result=await message(conversationId,answer.choices[1].label,null,{choiceId:answer.choices[1].id});
  assert.equal(result.changed,true,result.text);assert.equal(db.tables.tasks.find(row=>row.title==="Suivi").case_id,answer.choices[1].id);assert.equal(result.context.current_client_id,clientId);
});

test("audit avant/après, erreur IA sans succès inventé, outil arbitraire refusé",async()=>{
  const {conversationId}=fixture();
  await message(conversationId,"Change téléphone Jacques",{tool:"update_client",query:"Jacques",values:{phone:"514-555-1234"}});
  const audit=db.tables.coach_action_audit[0];assert.equal(audit.source,"coach_ai");assert.equal(audit.status,"completed");assert.ok(audit.message_id);assert.equal(audit.after_value.client.phone,"514-555-1234");
  const response=await message(conversationId,"Fais une action",new Error("IA indisponible"));assert.equal(response.changed,undefined);assert.match(response.text,/indisponible/);
  assert.throws(()=>parseCoachIntent({tool:"drop_table",user_id:"other"}));
});
test("dates Toronto et dates invalides",()=>{
  assert.equal(coachDate("demain",new Date("2026-09-22T02:00:00Z")),"2026-09-22");
  assert.equal(coachDate("vendredi",new Date("2026-09-21T12:00:00Z")),"2026-09-25");
  assert.throws(()=>coachDate("2026-02-30"));
});

test("choix successifs client puis dossier conservent toutes les résolutions",async()=>{
  const {conversationId}=fixture();
  const people=[randomUUID(),randomUUID()];
  db.tables.clients.push(...people.map(id=>({id,user_id:"owner",first_name:"Marc",last_name:"Tremblay"})));
  db.tables.client_cases.push(...["Vente A","Vente B"].map(title=>({...db.tables.client_cases[0],id:randomUUID(),primary_client_id:people[1],title})));
  let answer=await message(conversationId,"Ajoute un rappel pour Marc Tremblay mardi.",{tool:"create_task",query:"Marc Tremblay",title:"Appeler Marc",dateExpression:"mardi"});
  assert.equal(answer.choices.length,2);
  answer=await message(conversationId,"Marc choisi",null,{choiceId:people[1]});
  assert.equal(answer.choices.length,2);const caseId=answer.choices[1].id;
  answer=await message(conversationId,"Vente B",null,{choiceId:caseId});
  assert.equal(answer.changed,true,answer.text);assert.equal(db.tables.tasks.find(row=>row.title==="Appeler Marc").case_id,caseId);
});
test("ID de carte étranger et choix forgé refusés sans écriture métier",async()=>{
  const {conversationId}=fixture();const taskId=randomUUID();db.tables.tasks=[{id:taskId,user_id:"other",title:"Privé",status:"pending"}];
  let answer=await message(conversationId,"Terminer",null,{taskId});assert.match(answer.text,/inaccessible/);assert.equal(db.tables.tasks[0].status,"pending");
  answer=await message(conversationId,"Un choix forgé",null,{choiceId:randomUUID()});assert.match(answer.text,/ne correspond pas/);assert.equal(db.tables.coach_action_audit,undefined);
});
test("autre utilisateur ne peut ouvrir la conversation",async()=>{
  const {conversationId}=fixture();await assert.rejects(processCoachMessage(db,"other",{conversationId,messageId:randomUUID(),text:"Liste les clients"}),/Conversation introuvable/);
  assert.equal(db.tables.coach_messages.length,0);
});
