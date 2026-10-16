import "server-only";
import { normalizeBrokerProfile, buildProfessionalSignature } from "@/lib/broker-profile";
import { foldCoach, type CoachContext, type CoachIntent } from "@/lib/coach/conversation";
import type { CoachScope } from "@/lib/server/coach-tools";

export async function professionalContext(s:CoachScope) {
  const {data,error}=await s.db.from("profiles").select("professional_profile,full_name,email,updated_at").eq("id",s.userId).single();
  if(error || !data)throw new Error("Ton profil professionnel n’a pas pu être chargé. Aucun courriel n’a été préparé ou envoyé.");
  const profile=normalizeBrokerProfile(data.professional_profile);
  // These fallback values are stored on this owner's profile, never taken from a client or Gmail sender.
  profile.fullName=profile.fullName || data.full_name || "";
  profile.email=profile.email || data.email || "";
  for(const field of ["fullName","professionalTitle","agencyName","phone","mobile","email","signature"] as const)if(typeof profile[field] !== "string")profile[field]="";
  return {profile,row:data,signature:buildProfessionalSignature(profile)};
}
export function emailConversationIntent(text:string,context:CoachContext):CoachIntent|undefined {
  const value=foldCoach(text), hasDraft=!!context.current_action_id;
  const coordinate=text.match(/^(?:mon|ma|voici mon|voici ma|enregistre mon|enregistre ma)\s+(téléphone|telephone|courriel|email|numéro|numero|signature|nom|titre|agence)\s*(?:est|:|=)\s*([\s\S]+)$/i);
  if(coordinate){const field=/signature/i.test(coordinate[1])?"signature":/courriel|email/i.test(coordinate[1])?"email":/nom/i.test(coordinate[1])?"fullName":/titre/i.test(coordinate[1])?"professionalTitle":/agence/i.test(coordinate[1])?"agencyName":"phone";return {tool:"propose_professional_update",values:{field,value:coordinate[2].trim()}};}
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
