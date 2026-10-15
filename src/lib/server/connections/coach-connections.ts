import "server-only";
import { createHash } from "node:crypto";
import { foldCoach, type CoachCard, type CoachConnectionCard, type CoachIntent, type CoachMessage, type CoachReply } from "@/lib/coach/conversation";
import type { ConnectionService, Provider } from "@/lib/connections/types";
import { type CoachScope } from "@/lib/server/coach-tools";
import { beginOAuth, configurationReady, connectionStore, disconnectAccount, listAccounts } from "./accounts";
import { verifyAccountAccess } from "./verify";
import { centrisProvider } from "./centris";

type RequestRow = {id:string;user_id:string;conversation_id:string;provider:Provider;action:"connect"|"disconnect";services:ConnectionService[];account_id:string|null;status:CoachConnectionCard["status"];result_message:string|null;verified_at:string|null;expires_at:string};
const settings = "/tableau-de-bord/reglages/connexions";
const serviceLabels = {email:"Gmail / courriels",calendar:"Calendar / calendrier",contacts:"Contacts en lecture seule"};
const uuid = (value:unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const stateHash = (state:string) => { if(!/^[\w-]{40,100}$/.test(state))throw new Error("Retour OAuth invalide.");return createHash("sha256").update(state).digest("hex"); };

// These explicit connection commands do not need a model to request a password or invent a success.
export function connectionIntent(text:string): CoachIntent | undefined {
  const value = foldCoach(text), email = text.match(/[^\s<>"']+@[^\s<>"']+\.[a-z]{2,}/i)?.[0].replace(/[.,;!?]+$/,"");
  if (/^(quels?|quelles?|liste|montre|affiche|mes)\b/.test(value) && /comptes?.*(connect|branch)|connexions|services.*connect/.test(value)) return {tool:"list_connections"};
  if (/^(deconnecte|deconnecter|revoque|retire la connexion)\b/.test(value)) return {tool:"disconnect_account",...(email ? {query:email} : {})};
  if (!/^(connecte|connecter|reconnecte|reconnecter|branche|ajoute|ajouter)\b/.test(value)) return;
  if (/\bcentris\b/.test(value)) return {tool:"get_centris_status"};
  if (!/gmail|google|microsoft|outlook|calendrier|calendar|contacts|agenda/.test(value) || /rendez vous|evenement|rappel|a mon calendrier|dans mon calendrier/.test(value)) return;
  return {tool:"connect_service",...(email ? {query:email} : {}),values:{provider:/microsoft|outlook/.test(value) ? "microsoft" : "google",service:/calendrier|calendar|agenda/.test(value) ? "calendar" : /contacts/.test(value) ? "contacts" : "email",reconnect:/^reconnect/.test(value)}};
}
function card(row:RequestRow, email?:string): CoachCard {
  return {kind:"connection",id:row.id,title:email || `${row.provider === "google" ? "Google" : "Microsoft"} — ${row.services.map(s=>serviceLabels[s]).join(", ")}`,href:settings,
    detail:row.result_message || (row.action === "disconnect" ? "Confirme le compte à déconnecter. Son autorisation sera révoquée; les autres comptes resteront connectés." : "Autorise les services uniquement sur le site officiel. Aucun mot de passe n’est demandé dans cette conversation."),
    connection:{provider:row.provider,action:row.action,status:row.status,services:row.services,accountId:row.account_id || undefined,email,verifiedAt:row.verified_at}};
}
async function createRequest(s:CoachScope, provider:Provider, action:"connect"|"disconnect", services:ConnectionService[],accountId?:string) {
  const {data,error} = await connectionStore().from("coach_connection_requests").insert({user_id:s.userId,conversation_id:s.conversationId,source_message_id:s.messageId,provider,action,services,account_id:accountId || null,status:"offered"}).select("*").single();
  if(error || !data)throw new Error("Impossible de préparer la connexion. Vérifie la migration du Coach.");return data as RequestRow;
}
async function ownedRequest(userId:string,id:string,conversationId?:string) {
  if(!uuid(id) || conversationId !== undefined && !uuid(conversationId))throw new Error("Demande de connexion invalide.");
  let query = connectionStore().from("coach_connection_requests").select("*").eq("id",id).eq("user_id",userId);
  if(conversationId)query=query.eq("conversation_id",conversationId);
  const {data,error}=await query.single();
  if(error || !data)throw new Error("Cette connexion n’est pas accessible dans cette conversation.");return data as RequestRow;
}
async function finishRequest(userId:string,id:string,status:RequestRow["status"],message:string,accountId?:string) {
  const saved=await connectionStore().from("coach_connection_requests").update({status,result_message:message.slice(0,1000),...(accountId ? {account_id:accountId} : {}),verified_at:status === "verified" ? new Date().toISOString() : null}).eq("id",id).eq("user_id",userId).in("status",["pending","verifying"]);
  if(saved.error)throw new Error("Le résultat de connexion n’a pas pu être conservé. Vérifie les connexions avant de réessayer.");
}
export async function connectionRequestAction(userId:string,id:string,conversationId:string,action:string) {
  const row=await ownedRequest(userId,id,conversationId), db=connectionStore();
  if(new Date(row.expires_at).getTime() <= Date.now())throw new Error("Cette carte a expiré. Demande une nouvelle connexion au Coach.");
  if(action === "cancel") {
    const saved=await db.from("coach_connection_requests").update({status:"cancelled",result_message:"Demande annulée. Aucun compte déconnecté par cette demande."}).eq("id",id).eq("user_id",userId).in("status",["offered","failed","pending"]).select("id").single();
    if(saved.error || !saved.data)throw new Error("La demande est déjà traitée ou en vérification. Attends son résultat avant de déconnecter le compte.");
    const removed=await db.from("connection_oauth_states").delete().eq("user_id",userId).eq("coach_request_id",id);
    if(removed.error)throw new Error("Demande annulée, mais nettoyage OAuth indisponible.");return {};
  }
  if(!["offered","failed"].includes(row.status))throw new Error(["pending","verifying"].includes(row.status) ? "La connexion est déjà en attente. Termine le parcours OAuth ou demande son annulation." : "Cette demande a déjà été traitée. Recharge la conversation.");
  if(action !== (row.action === "connect" ? "start" : "confirm"))throw new Error("Action de connexion invalide.");
  const claimed=await db.from("coach_connection_requests").update({status:"pending",expires_at:row.action === "connect" ? new Date(Date.now()+600000).toISOString() : row.expires_at,result_message:row.action === "connect" ? "En attente de l’autorisation officielle et de la vérification serveur." : "Déconnexion en cours."}).eq("id",id).eq("user_id",userId).in("status",["offered","failed"]).select("id").single();
  if(claimed.error || !claimed.data)throw new Error("Cette demande est déjà en traitement.");
  try {
    if(row.action === "disconnect") {
      if(!row.account_id)throw new Error("Compte à déconnecter manquant.");
      const message=await disconnectAccount(userId,row.provider,row.account_id);
      const account=(await listAccounts(userId)).find(a=>a.id===row.account_id);
      if(account && account.status !== "disconnected")throw new Error("La déconnexion n’a pas été confirmée par le serveur.");
      await finishRequest(userId,id,"disconnected",message);return {};
    }
    const removed=await db.from("connection_oauth_states").delete().eq("user_id",userId).eq("coach_request_id",id);
    if(removed.error)throw new Error("Impossible de renouveler la demande OAuth.");
    const url=await beginOAuth(userId,row.provider,row.services,row.account_id || undefined,id);
    const saved=await db.from("coach_connection_requests").update({oauth_state_hash:stateHash(new URL(url).searchParams.get("state") || "")}).eq("id",id).eq("user_id",userId).eq("status","pending");
    if(saved.error)throw new Error("Impossible de conserver le retour dans cette conversation.");
    return {url};
  } catch(error) {await finishRequest(userId,id,"failed",error instanceof Error ? error.message : "Connexion non confirmée.");throw error;}
}
export async function coachOAuthRequest(userId:string,provider:Provider,state:string) {
  const {data,error}=await connectionStore().from("connection_oauth_states").select("coach_request_id").eq("id",stateHash(state)).eq("user_id",userId).eq("provider",provider).maybeSingle();
  if(error)throw new Error("État OAuth indisponible.");
  if(data?.coach_request_id)return ownedRequest(userId,data.coach_request_id);
  const previous=await connectionStore().from("coach_connection_requests").select("*").eq("user_id",userId).eq("provider",provider).eq("oauth_state_hash",stateHash(state)).maybeSingle();
  if(previous.error)throw new Error("Retour de conversation indisponible.");
  return previous.data ? previous.data as RequestRow : null;
}
export async function completeCoachOAuth(userId:string,row:RequestRow,accountId:string) {
  const current=await ownedRequest(userId,row.id,row.conversation_id);
  if(current.status !== "verifying")throw new Error("Cette demande OAuth n’est plus en vérification.");
  const account=await verifyAccountAccess(userId,accountId,row.services);
  const db=connectionStore();
  const conversation=await db.from("coach_conversations").select("context").eq("id",row.conversation_id).eq("user_id",userId).single();
  if(conversation.error || !conversation.data)throw new Error("La conversation d’origine n’est plus accessible.");
  const updated=await db.from("coach_conversations").update({context:{...conversation.data.context,current_account_id:account.id},updated_at:new Date().toISOString()}).eq("id",row.conversation_id).eq("user_id",userId);
  if(updated.error)throw new Error("Accès vérifié, mais reprise de conversation indisponible. Vérifie Réglages → Connexions.");
  await finishRequest(userId,row.id,"verified",`Connexion vérifiée côté serveur : ${account.email} — ${row.services.map(s=>serviceLabels[s]).join(", ")}. Aucun message envoyé et aucun événement créé.`,accountId);
}
export async function claimCoachOAuthRequest(userId:string,row:RequestRow) {
  const claimed=await connectionStore().from("coach_connection_requests").update({status:"verifying",result_message:"Autorisation reçue. Vérification des accès côté serveur en cours."}).eq("id",row.id).eq("user_id",userId).eq("status","pending").select("id").single();
  if(claimed.error || !claimed.data)throw new Error("Cette demande OAuth est annulée ou déjà en traitement.");
}
export async function failCoachOAuth(userId:string,row:RequestRow,message:string,cancelled=false) {
  await finishRequest(userId,row.id,cancelled ? "cancelled" : "failed",message);
}
export async function discardOAuthState(userId:string,provider:Provider,state:string) {
  const removed=await connectionStore().from("connection_oauth_states").delete().eq("id",stateHash(state)).eq("user_id",userId).eq("provider",provider);
  if(removed.error)throw new Error("Impossible d’annuler le retour OAuth.");
}
export async function hydrateConnectionMessages(userId:string,conversationId:string,messages:CoachMessage[]) {
  if(!messages.some(m=>m.reply?.cards?.some(c=>c.kind === "connection")))return messages;
  const {data,error}=await connectionStore().from("coach_connection_requests").select("*").eq("user_id",userId).eq("conversation_id",conversationId);
  if(error)throw new Error("Les états de connexion sont indisponibles.");
  const accounts=await listAccounts(userId);
  return messages.map(m=>!m.reply ? m : {...m,reply:{...m.reply,cards:m.reply.cards.map(c=>{
    if(c.kind !== "connection" || c.connection?.provider === "centris")return c;
    if(c.connection?.action === "inspect") {
      const account=accounts.find(a=>a.id===c.id);
      return {...c,connection:{...c.connection,status:account?.status === "connected" ? "connected" : account?.status === "reconnect" ? "reconnect" : "disconnected",services:account?.services || []}};
    }
    const row=(data || []).find(r=>r.id===c.id) as RequestRow|undefined;
    const account=accounts.find(a=>a.id===row?.account_id);
    return row ? card({...row,...(row.status === "verified" && account?.status !== "connected" ? {status:account?.status === "reconnect" ? "reconnect" as const : "disconnected" as const,result_message:"Ce compte a été vérifié auparavant, mais son accès n’est plus actif. Reconnecte-le pour l’utiliser."} : {}),...(new Date(row.expires_at).getTime() <= Date.now() && ["pending","verifying"].includes(row.status) ? {status:"failed" as const,result_message:"La connexion n’a pas été confirmée. Recommence le parcours OAuth."} : {})},account?.email) : {...c,detail:"Demande inaccessible. Prépare une nouvelle connexion.",connection:c.connection ? {...c.connection,status:"failed" as const} : undefined};
  })}});
}
async function connectService(s:CoachScope,i:CoachIntent) {
  const provider:Provider=i.values?.provider === "microsoft" ? "microsoft" : "google";
  const service:ConnectionService=i.values?.service === "calendar" ? "calendar" : i.values?.service === "contacts" ? "contacts" : "email";
  const accounts=await listAccounts(s.userId);
  const target=accounts.find(a=>a.provider===provider && i.query && a.email.toLowerCase()===i.query.toLowerCase());
  if(i.query && !target)throw new Error("Le compte à reconnecter n’a pas été trouvé. Demande plutôt d’ajouter un compte.");
  const services=[...new Set([...(target?.services || []),service])];
  if(!configurationReady(provider))return {text:"La connexion doit être configurée par l’administrateur. Aucun accès n’a été accordé.",cards:[{kind:"case" as const,id:"connections",title:"Réglages → Connexions",href:settings}],context:s.context};
  const row=await createRequest(s,provider,"connect",services,target?.id);
  if(target)s.context.current_account_id=target.id;
  return {text:target ? `Reconnecte ${target.email} avec le bouton officiel. Je confirmerai seulement après vérification serveur.` : `Ajoute un compte ${provider === "google" ? "Google" : "Microsoft"} indépendant pour ${serviceLabels[service]}. Choisis le compte voulu chez le fournisseur. Les autres comptes restent conservés.`,cards:[card(row,target?.email)],context:s.context};
}
async function disconnectService(s:CoachScope,i:CoachIntent) {
  const accounts=(await listAccounts(s.userId)).filter(a=>a.status !== "disconnected");
  const named=accounts.filter(a=>i.query ? a.email.toLowerCase()===i.query.toLowerCase() : s.text.toLowerCase().includes(a.email.toLowerCase()));
  const selected=accounts.find(a=>a.id===s.selections?.account) || (named.length===1 ? named[0] : undefined) || accounts.find(a=>a.id===s.context.current_account_id);
  if(i.query && !named.length)throw new Error("Ce compte n’est pas connecté à ton espace.");
  if(!selected && accounts.length>1) {
    const cards=[];
    for(const account of accounts)cards.push(card(await createRequest(s,account.provider,"disconnect",account.services || [],account.id),account.email));
    return {text:"Quel compte veux-tu déconnecter ? Confirme uniquement la carte du compte concerné.",cards,context:s.context};
  }
  const account=selected || accounts[0];
  if(!account)throw new Error("Aucun compte à déconnecter.");
  if(i.query && !named.length)throw new Error("Ce compte n’est pas connecté à ton espace.");
  s.context.current_account_id=account.id;
  const row=await createRequest(s,account.provider,"disconnect",account.services || [],account.id);
  return {text:`Déconnecter ${account.email} ? Confirme la carte ci-dessous. Les autres comptes seront conservés.`,cards:[card(row,account.email)],context:s.context};
}
export const coachConnectionHandlers = {
  connect_service:connectService,disconnect_account:disconnectService,
  list_connections:async(s:CoachScope):Promise<CoachReply>=>{
    const accounts=await listAccounts(s.userId);
    s.context.current_account_id=accounts.length === 1 ? accounts[0].id : null;
    return {text:accounts.length ? `${accounts.length} compte(s) enregistré(s). Les états et permissions ci-dessous proviennent du serveur.` : "Aucun compte enregistré. Demande « Connecte mon Gmail » ou « Ajoute mon calendrier ».",context:s.context,cards:accounts.map(a=>({kind:"connection",id:a.id,title:a.email,detail:`${a.provider} · ${(a.services || []).map(v=>serviceLabels[v]).join(", ")}${a.defaults?.length ? ` · Par défaut : ${a.defaults.map(v=>serviceLabels[v]).join(", ")}` : ""}`,href:settings,connection:{provider:a.provider,action:"inspect",status:a.status === "connected" ? "connected" : a.status === "reconnect" ? "reconnect" : "disconnected",services:a.services || [],accountId:a.id,email:a.email}}))};
  },
  get_centris_status:async(s:CoachScope):Promise<CoachReply>=>{
    const status=await centrisProvider(s.userId).getConnectionStatus();
    return {text:`${status.message} Tu peux préparer tes dossiers et documents dans le CRM; aucune recherche ou transmission Centris n’est activée.`,context:s.context,cards:[{kind:"connection",id:"centris",title:"Centris — intégration non disponible",detail:status.message,href:"/tableau-de-bord/dossiers",connection:{provider:"centris",action:"inspect",status:"unavailable",services:[]}}]};
  },
};
