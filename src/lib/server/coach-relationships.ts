import { coachLink, foldCoach, emptyCoachContext, type CoachIntent, type CoachReply } from "@/lib/coach/conversation";
import { relationshipTypes, relationshipLabels, type RelationshipType } from "@/lib/client-relationships";
import { addRelatedParticipant, getClientRelationships, linkClients } from "@/lib/server/client-relationships";
import { audit, CoachChoice, coachRows, requireCase, type CoachScope } from "@/lib/server/coach-tools";
import { connectedCoachHandlers } from "@/lib/server/connections/coach-connected";
type Person={id:string;first_name?:unknown;last_name?:unknown;email?:unknown};
const name=(p:Person)=>`${p.first_name||""} ${p.last_name||""}`.trim();
function choosePerson(s:CoachScope,kind:string,people:Person[]):Person {
 const chosen=s.selections?.[kind]||(s.selected?.kind===kind?s.selected.id:null);
 if(chosen){const person=people.find(p=>p.id===chosen);if(!person)throw new Error("Le contact sélectionné n’est plus disponible.");return person;}
 if(people.length>1)throw new CoachChoice(kind,people.map(p=>({id:p.id,label:`${name(p)}${p.email?` · ${p.email}`:""}`})));
 if(!people.length)throw new Error("Aucun contact correspondant. Aucune fiche n’a été créée.");return people[0];
}
async function findPerson(s:CoachScope,query:unknown,kind:string,fallback?:string|null) {
 const terms=foldCoach(query).split(" ").filter(Boolean);
 const people=await coachRows(s,"clients");
 return choosePerson(s,kind,people.filter(p=>terms.length?terms.every(t=>foldCoach(name(p)).split(" ").some(w=>w.startsWith(t))):p.id===fallback));
}
function relationType(i:CoachIntent):RelationshipType {const t=i.values?.relationshipType||"spouse";if(!relationshipTypes.includes(t as RelationshipType))throw new Error("Quel type de relation veux-tu utiliser ?");return t as RelationshipType;}
async function couple(s:CoachScope,i:CoachIntent) {
 const anchor=await findPerson(s,i.query,"relationship_first",s.context.current_relationship_client_ids?.[0]||s.context.current_client_id);
 const type=relationType(i);const rows=await getClientRelationships(s.db,s.userId,anchor.id);
 const related=choosePerson(s,"relationship_second",rows.filter(r=>r.type===type).map(r=>r.contact));
 const context=s.context.current_client_id===anchor.id?s.context:{...emptyCoachContext(),current_client_id:anchor.id};
 s.context={...context,current_relationship_client_ids:[anchor.id,related.id]};return {anchor,related};
}
function response(s:CoachScope,text:string,people:Person[]=[]):CoachReply{return {text,cards:people.map(p=>({kind:"client",id:p.id,title:name(p),href:coachLink("client",p.id)})),context:s.context};}
async function link(s:CoachScope,i:CoachIntent) {
 const firstName=i.values?.person1,secondName=i.values?.person2;
 if(typeof firstName!=="string"||typeof secondName!=="string")throw new Error("Indique les deux contacts à relier.");
 // Model-supplied names must be present in the original utterance, not generated IDs.
 for(const value of [firstName,secondName])if(!foldCoach(s.text).includes(foldCoach(value)))throw new Error("Précise les noms des deux contacts à relier.");
 const first=await findPerson(s,firstName,"relationship_first"),second=await findPerson(s,secondName,"relationship_second");
 const type=relationType(i);
 await audit(s,"link_clients","client_relationship",null,null,()=>linkClients(s.db,s.userId,first.id,second.id,type));
 s.context={...emptyCoachContext(),current_client_id:first.id,current_relationship_client_ids:[first.id,second.id]};
 return {...response(s,`${name(first)} et ${name(second)} : ${relationshipLabels[type]}. Deux fiches distinctes, aucun dossier ajouté automatiquement.`,[first,second]),changed:true};
}
async function getRelated(s:CoachScope,i:CoachIntent){const {anchor,related}=await couple(s,i);return response(s,`${relationshipLabels[relationType(i)]} de ${name(anchor)} : ${name(related)}.`,[related]);}
async function addToCase(s:CoachScope,i:CoachIntent){const {anchor,related}=await couple(s,i);const clientCase=await requireCase(s,{...i,query:undefined});const result=await audit(s,"add_related_to_case","case",clientCase.id,null,()=>addRelatedParticipant(s.db,s.userId,anchor.id,related.id,clientCase.id));return {...response(s,result.added?`${name(related)} participe maintenant au dossier « ${clientCase.title} ». Les autres dossiers sont inchangés.`:`${name(related)} participe déjà à ce dossier.`,[related]),changed:result.added};}
async function sharedCases(s:CoachScope,i:CoachIntent){const {anchor,related}=await couple(s,i);const cases=await coachRows(s,"client_cases"),members=await coachRows(s,"client_case_clients");const participates=(c:Record<string,unknown>,id:string)=>c.primary_client_id===id||members.some(m=>m.case_id===c.id&&m.client_id===id);const common=cases.filter(c=>participates(c,anchor.id)&&participates(c,related.id));return {...response(s,common.length?`${common.length} dossier(s) commun(s) à ${name(anchor)} et ${name(related)}.`:"Aucun dossier commun. Le lien personnel ne crée pas de participation."),cards:common.map(c=>({kind:"case" as const,id:c.id,title:String(c.title),href:coachLink("case",c.id)}))};}
async function emailCouple(s:CoachScope,i:CoachIntent){const {anchor,related}=await couple(s,i);if(!anchor.email||!related.email)throw new Error("Il manque une adresse courriel sur l’une des deux fiches. Complète-la avant de préparer le courriel commun.");s.emailRecipients=[String(anchor.email),String(related.email)];s.emailRecipientClientIds=[anchor.id,related.id];const handler=connectedCoachHandlers.draft_email;if(!handler)throw new Error("Courriel indisponible.");return handler(s,{...i,tool:"draft_email"});}
export const relationshipCoachHandlers={link_clients:link,get_related_client:getRelated,add_related_to_case:addToCase,get_couple_cases:sharedCases,draft_relationship_email:emailCouple};
