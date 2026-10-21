import "server-only";
import { normalizeBrokerProfile, buildProfessionalSignature } from "@/lib/broker-profile";
import { foldCoach, type CoachContext, type CoachIntent } from "@/lib/coach/conversation";
import type { CoachScope } from "@/lib/server/coach-tools";
import { CoachClarification } from "@/lib/server/coach-pending";

const profileLabels = {fullName:"Nom professionnel",professionalTitle:"Titre",agencyName:"Agence",phone:"Téléphone",mobile:"Cellulaire",email:"Courriel",signature:"Signature"} as const;
type ProfileField = keyof typeof profileLabels;
export function requestedProfessionalFields(text:string):ProfileField[] {
  const t=foldCoach(text), fields:ProfileField[]=[];
  if(/\b(nom|identite|qui suis je)\b/.test(t))fields.push("fullName");
  if(/\b(titre|profession)\b/.test(t))fields.push("professionalTitle");
  if(/\b(agence|banniere)\b/.test(t))fields.push("agencyName");
  if(/\b(telephone|numero)\b/.test(t))fields.push("phone");
  if(/\b(cellulaire|mobile)\b/.test(t))fields.push("mobile");
  if(/\b(courriel|email|adresse electronique)\b/.test(t))fields.push("email");
  if(/\bsignature\b/.test(t))fields.push("signature");
  return /\b(coordonnees|profil|informations professionnelles|renseignements professionnels)\b/.test(t) ? Object.keys(profileLabels) as ProfileField[] : fields;
}
function identityRead(text:string) {
  // Ownership is interpreted only for reads. In particular, "ma signature" in
  // a draft request must never turn that request into a profile lookup.
  const t=foldCoach(text).replace(/\bsans (?:rien )?(?:modifier|changer|enregistrer|supprimer)(?: mes donnees)?\b/g,"");
  return !/\b(prepare|redige|ecris|ajoute|inclus|insere|mets|modifie|change|enregistre|supprime|envoie|retire|utilise)\b/.test(t);
}
export function explicitlyListsClients(text:string) {
  return /\b(liste|affiche|montre|voir|consulter)\b.*\b(clients|contacts|acheteurs|vendeurs)\b|\bqui sont (?:tous )?(?:mes|les) (?:clients|contacts|acheteurs|vendeurs)\b/.test(foldCoach(text));
}
// A boundary on the existing model router, not an alternative chatbot. The
// model still handles natural language; these rules prevent an unsafe semantic
// fallback from a missing entity to "read every client".
export function normalizeIdentityIntent(intent:CoachIntent,text:string,context:CoachContext):CoachIntent {
  const t=foldCoach(text), fields=requestedProfessionalFields(text);
  if(!["get_professional_profile","search_clients","get_client","count_clients","clarify_identity","unavailable","phone_call"].includes(intent.tool))return intent;
  if(!identityRead(text))return intent;
  if(/\bcombien\b.*\b(clients|contacts|acheteurs|vendeurs)\b|\bnombre(?: total)? de (?:clients|contacts|acheteurs|vendeurs)\b/.test(t) && !/\b(dossier|couple|depuis|semaine|mois)\b/.test(t))return {tool:"count_clients",...(/\bacheteurs\b/.test(t)?{role:"buyer"}:/\bvendeurs\b/.test(t)?{role:"seller"}:{})};
  if(!fields.length)return intent;
  const own=/\b(mon|ma|mes) (?:nom|titre|agence|banniere|numero|telephone|cellulaire|mobile|courriel|email|adresse electronique|signature|coordonnees|profil|informations|renseignements)\b|\b(qui suis je|me joindre|me contacter|courtier connecte|profil utilisateur|agence je travaille|informations sur moi)\b/.test(t);
  if(own)return {tool:"get_professional_profile",values:{fields}};
  if(intent.tool==="search_clients" && intent.query)return {...intent,tool:"get_client"};
  // Explicit third-party references win over a previous focus on the broker.
  const other=!!intent.query || /\b(client|cliente|contact|de lui|d elle)\b/.test(t);
  if(context.current_identity_target==="broker" && !other)return {tool:"get_professional_profile",values:{fields}};
  if(other && intent.tool!=="get_professional_profile")return intent;
  if(intent.tool==="get_professional_profile" && intent.query)return {tool:"get_client",query:intent.query};
  if((intent.tool==="search_clients" && !intent.query && !explicitlyListsClients(text)) || intent.tool==="get_professional_profile") {
    if(context.current_identity_target==="client" && context.current_client_id)return {tool:"get_client"};
    return {tool:"clarify_identity",values:{fields}};
  }
  return intent;
}
export async function readProfessionalProfile(s:CoachScope,i:CoachIntent) {
  const {profile,signature}=await professionalContext(s,"Ton profil professionnel n’a pas pu être chargé. Aucun renseignement n’est inventé.");
  const provided=i.values?.fields;
  if(provided!==undefined && (!Array.isArray(provided) || provided.some(k=>typeof k!=="string" || !Object.hasOwn(profileLabels,k))))throw new Error("Champ professionnel invalide.");
  const fields=(Array.isArray(provided) && provided.length ? [...new Set(provided)] : Object.keys(profileLabels)) as ProfileField[];
  // No profile values are ever obtained from a client, the model or another ID.
  const lines=fields.map(field=>`${field==="signature" && !profile.signature && signature ? "Signature composée depuis ton profil" : profileLabels[field]} : ${field==="signature" ? signature || "non renseignée" : (field==="phone" ? profile.phone || profile.mobile : profile[field]) || "non renseigné"}`);
  s.context.current_identity_target="broker";
  return {text:lines.join("\n"),cards:[],context:s.context};
}
export async function clarifyIdentity(_s:CoachScope,_i:CoachIntent):Promise<never> {
  throw new CoachClarification("identity","Parles-tu de ton profil professionnel ou des coordonnées d’un client ? Précise « mon profil » ou le nom du client.");
}

export async function professionalContext(s:CoachScope,failureMessage="Ton profil professionnel n’a pas pu être chargé. Aucun courriel n’a été préparé ou envoyé.") {
  const {data,error}=await s.db.from("profiles").select("professional_profile,full_name,email,updated_at").eq("id",s.userId).single();
  if(error || !data)throw new Error(failureMessage);
  const profile=normalizeBrokerProfile(data.professional_profile);
  // These fallback values are stored on this owner's profile, never taken from a client or Gmail sender.
  profile.fullName=profile.fullName || data.full_name || "";
  profile.email=profile.email || data.email || "";
  for(const field of ["fullName","professionalTitle","agencyName","phone","mobile","email","signature"] as const)if(typeof profile[field] !== "string")profile[field]="";
  return {profile,row:data,signature:buildProfessionalSignature(profile)};
}
export function explicitEmailSubject(text: string): string | undefined {
  const match = text.match(/\b(?:objet|sujet)\s*(?::|=)?\s*[«“"]([^»”"\r\n]{1,200})[»”"]/i);
  return match?.[1].trim() || undefined;
}
export function emailConversationIntent(text:string,context:CoachContext):CoachIntent|undefined {
  const value=foldCoach(text), hasDraft=!!context.current_action_id;
  const coordinate=text.match(/^(?:mon|ma|voici mon|voici ma|enregistre mon|enregistre ma)\s+(téléphone|telephone|courriel|email|numéro|numero|signature|nom|titre|agence)\s*(?:est|:|=)\s*([\s\S]+)$/i);
  if(coordinate){const field=/signature/i.test(coordinate[1])?"signature":/courriel|email/i.test(coordinate[1])?"email":/nom/i.test(coordinate[1])?"fullName":/titre/i.test(coordinate[1])?"professionalTitle":/agence/i.test(coordinate[1])?"agencyName":"phone";return {tool:"propose_professional_update",values:{field,value:coordinate[2].trim()}};}
  if(context.email_question) {
    const read=normalizeIdentityIntent({tool:"unavailable"},text,context);
    if(read.tool==="get_professional_profile")return read;
  }
  if(context.email_question?.field && !/^(trouve|cherche|montre|connecte|annule|ajoute|cree|fais une tache|liste|quels|quelles)/.test(value)) {
    const field=context.email_question.field;
    if(["fullName","professionalTitle","agencyName"].includes(field) && text.trim().length>1 && text.length<160 || field==="phone" && /^[+()\d .-]{7,30}$/.test(text.trim()) || field==="email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim()))return {tool:"propose_professional_update",values:{field,value:text.trim()}};
  }
  if(hasDraft && /^(?:oui )?(?:envoie|envoyer|confirme|confirmer)(?: (?:le|la|oui|maintenant))?[.! ]*$/.test(value))return {tool:"send_email"};
  if(hasDraft && /(?:prepare|pret|parfait).*(?:envoi|envoyer)|^(?:parfait|montre le brouillon|reprends le brouillon)[.! ]*$/.test(value))return {tool:"prepare_email"};
  if(hasDraft && /(?:utilise|choisis|change|passe).*(?:autre (?:courriel|compte)|compte expediteur|courriel expediteur|@)/.test(value))return {tool:"switch_email_account",query:text.match(/[^\s<>"']+@[^\s<>"']+\.[a-z]{2,}/i)?.[0].replace(/[.,;!?]+$/,"")};
  if(hasDraft && /^(?:ajoute|inclus|insere|mets|retire|enleve|rends|raccourcis|reformule|corrige|reecris|allonge|developpe|utilise mon|change le ton)/.test(value) && /telephone|numero|coordonnees|signature|professionnel|chaleureux|court|raccourcis|reformule|ton|brouillon|message|courriel|reecris|corrige|allonge|developpe/.test(value))return {tool:"revise_email",capture:text};
  if(context.email_question && !context.email_question.field && !/^(trouve|cherche|montre|connecte|annule|ajoute|cree|fais une tache|liste|quels|quelles)/.test(value))return {...context.email_question.intent,capture:`${context.email_question.intent.capture || ""}\nPrécision explicite du courtier : ${text}`};
}
