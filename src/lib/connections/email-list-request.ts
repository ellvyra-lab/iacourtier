import { foldCoach, type CoachIntent } from "@/lib/coach/conversation";

const words = ["zero","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize","dix sept","dix huit","dix neuf"];
for(let n=20;n<100;n++) {
  if(n<70){const unit=n%10;words[n]=["vingt","trente","quarante","cinquante","soixante"][Math.floor(n/10)-2]+(unit===1 ? " et un" : unit ? ` ${words[unit]}` : "");}
  else if(n<80)words[n]=`soixante${n===71 ? " et" : ""} ${words[n-60]}`;
  else words[n]=`quatre vingt${n===80 ? "" : ` ${words[n-80]}`}`;
}
words[100]="cent";
const quantities = [...words].sort((a,b)=>b.length-a.length).join("|");
const countPattern = new RegExp(`\\b(\\d+|${quantities})\\s+(?:(?:plus\\s+)?(?:derniers?|dernieres?|recents?|recentes?|nouveaux|nouvelles|non lus)\\s+)*(?:courriels?|emails?|e mails?|mails?|messages?)\\b`);

// The requested count applies to the combined result, never separately to each account.
// Keep provider reads bounded by their existing maximum (30).
export function emailListRequest(text:string,intent:CoachIntent) {
  const value=foldCoach(text).replace(/\bvingts\b/g,"vingt"), match=value.match(countPattern);
  // Do not mistake the last word of an unsupported compound ("cent cinq") for five.
  if(match && /\b(?:cent|cents|mille|million|millions|milliard|milliards)\s*$/.test(value.slice(0,match.index)))throw new Error("Précise le nombre de courriels en chiffres.");
  const explicit=match ? /^\d+$/.test(match[1]) ? Number(match[1]) : words.indexOf(match[1]) : undefined;
  const supplied=intent.values?.limit;
  if(supplied!==undefined && (typeof supplied!=="number" || !Number.isSafeInteger(supplied) || supplied<1))throw new Error("Le nombre de courriels doit être un entier positif.");
  for(const key of ["latest","receivedOnly"])if(intent.values?.[key]!==undefined && typeof intent.values[key]!=="boolean")throw new Error("Filtre de courriels invalide.");
  const requested=explicit ?? supplied as number|undefined;
  if(requested!==undefined && (!Number.isSafeInteger(requested) || requested<1))throw new Error("Le nombre de courriels doit être un entier positif.");
  return {
    requested, limit:Math.min(30,requested ?? 20),
    latest:intent.values?.latest===true || /\b(derniers?|dernieres?|plus recents?|plus recentes?)\b/.test(value),
    receivedOnly:intent.values?.receivedOnly===true || /\b(recu|recus|recue|recues|reception)\b/.test(value),
  };
}

export function normalizeEmailListIntent(intent:CoachIntent,text:string):CoachIntent {
  if(!["search_emails","get_recent_emails","get_unread_emails"].includes(intent.tool))return intent;
  const request=emailListRequest(text,intent);
  const query=foldCoach(intent.query);
  const generic=query && query.split(" ").every(word=>/^\d+$/.test(word) || [...words.flatMap(w=>w.split(" ")),"gmail","courriel","courriels","email","emails","mail","mails","message","messages","dernier","derniers","derniere","dernieres","recu","recus","recue","recues","recent","recents","mes","les","plus"].includes(word));
  return {...intent,...(generic && (request.latest || request.requested!==undefined) ? {query:undefined}:{}),values:{...intent.values,...(request.requested===undefined?{}:{limit:request.requested}),latest:request.latest,receivedOnly:request.receivedOnly}};
}
