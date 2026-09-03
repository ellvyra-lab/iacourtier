import { generateWithOpenAI } from "@/lib/openai";

export type InboxActionType = "call" | "sms" | "email" | "document" | "research" | "appointment" | "follow_up" | "marketing" | "other";
export type InboxCaseType = "buyer" | "seller" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";

export type InboxAnalysis = {
  person: { firstName: string; lastName: string; email: string; phone: string };
  caseType: InboxCaseType;
  property: { address: string; city: string; propertyType: string };
  request: string;
  urgency: "critical" | "high" | "normal" | "low";
  tasks: Array<{ title: string; description: string; dueAt: string | null; actionType: InboxActionType; priorityScore: number }>;
  missingInformation: string[];
  summary: string;
  confidence: number;
};

const SYSTEM_PROMPT = `Tu analyses une capture rapide pour un CRM immobilier québécois. Retourne uniquement un objet JSON valide, sans markdown.
Schéma: {"person":{"firstName":"","lastName":"","email":"","phone":""},"caseType":"buyer|seller|buy_sell|prospect|renewal|post_transaction|other","property":{"address":"","city":"","propertyType":""},"request":"","urgency":"critical|high|normal|low","tasks":[{"title":"","description":"","dueAt":"ISO-8601 ou null","actionType":"call|sms|email|document|research|appointment|follow_up|marketing|other","priorityScore":0}],"missingInformation":[""],"summary":"","confidence":0.0}.
Ne crée aucune donnée. N'invente jamais un nom, un téléphone, une adresse ou une échéance. Une action promise ou datée doit devenir une tâche distincte. Utilise l'heure de l'Est et le français du Québec.`;

export async function analyzeInboxText(rawText: string, now = new Date()): Promise<{ analysis: InboxAnalysis; engine: "openai" | "deterministic" }> {
  const text = rawText.trim().slice(0, 12_000);
  try {
    const result = await generateWithOpenAI({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Date et heure actuelles: ${now.toISOString()}\nCapture: ${text}`,
      maxTokens: 1200,
      temperature: 0.1,
    });
    return { analysis: normalizeAnalysis(JSON.parse(stripJsonFence(result)), text, now), engine: "openai" };
  } catch {
    return { analysis: deterministicAnalysis(text, now), engine: "deterministic" };
  }
}

export function normalizeAnalysis(input: Partial<InboxAnalysis>, rawText: string, now = new Date()): InboxAnalysis {
  const person = input.person || { firstName: "", lastName: "", email: "", phone: "" };
  const property = input.property || { address: "", city: "", propertyType: "" };
  const allowedCases: InboxCaseType[] = ["buyer", "seller", "buy_sell", "prospect", "renewal", "post_transaction", "other"];
  const allowedUrgency = ["critical", "high", "normal", "low"] as const;
  const allowedActions: InboxActionType[] = ["call", "sms", "email", "document", "research", "appointment", "follow_up", "marketing", "other"];
  const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 12).map((task) => ({
    title: clean(task?.title, 240) || "Faire le suivi",
    description: clean(task?.description, 2000),
    dueAt: validFutureDate(task?.dueAt, now),
    actionType: allowedActions.includes(task?.actionType as InboxActionType) ? task.actionType as InboxActionType : "other",
    priorityScore: Math.max(0, Math.min(100, Number(task?.priorityScore) || 50)),
  })) : [];
  return {
    person: { firstName: clean(person.firstName, 120), lastName: clean(person.lastName, 120), email: clean(person.email, 320).toLowerCase(), phone: clean(person.phone, 60) },
    caseType: allowedCases.includes(input.caseType as InboxCaseType) ? input.caseType as InboxCaseType : inferCaseType(rawText),
    property: { address: clean(property.address, 500), city: clean(property.city, 160), propertyType: clean(property.propertyType, 120) },
    request: clean(input.request, 3000) || rawText,
    urgency: allowedUrgency.includes(input.urgency as typeof allowedUrgency[number]) ? input.urgency as typeof allowedUrgency[number] : inferUrgency(rawText),
    tasks: tasks.length ? tasks : inferTasks(rawText, now),
    missingInformation: uniqueStrings([...(Array.isArray(input.missingInformation) ? input.missingInformation : []), ...missingPerson(person)]),
    summary: clean(input.summary, 2000) || rawText,
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0.55)),
  };
}

export function deterministicAnalysis(text: string, now = new Date()): InboxAnalysis {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/)?.[0] || "";
  const name = text.match(/(?:^|[.!?]\s+)([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)(?:\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+))?\s+(?:est|veut|cherche|souhaite|doit|m['’]a)/);
  const city = text.match(/\b(?:à|dans|secteur)\s+([A-ZÀ-ÖØ-Ý][\p{L}'’-]+(?:[ -][A-ZÀ-ÖØ-Ý][\p{L}'’-]+)?)/u)?.[1] || "";
  const propertyType = text.match(/\b(maison|condo|duplex|triplex|quadruplex|immeuble|terrain|chalet)\b/i)?.[1] || "";
  const person = { firstName: name?.[1] || "", lastName: name?.[2] || "", email, phone };
  const missing = missingPerson(person);
  return {
    person,
    caseType: inferCaseType(text),
    property: { address: "", city, propertyType },
    request: text,
    urgency: inferUrgency(text),
    tasks: inferTasks(text, now),
    missingInformation: missing,
    summary: text,
    confidence: name ? 0.72 : 0.45,
  };
}

function inferTasks(text: string, now: Date): InboxAnalysis["tasks"] {
  const normalized = fold(text);
  const dueAt = inferDueAt(normalized, now);
  const tasks: InboxAnalysis["tasks"] = [];
  if (/appel|appeler|rappel|rappeler|telephone/.test(normalized)) tasks.push({ title: "Appeler le client", description: text, dueAt, actionType: "call", priorityScore: dueAt ? 85 : 70 });
  if (/certificat de localisation/.test(normalized)) tasks.push({ title: "Vérifier le certificat de localisation", description: "Confirmer si un certificat de localisation valide est disponible.", dueAt, actionType: "document", priorityScore: 80 });
  if (/rendez.?vous|rencontre|visite/.test(normalized)) tasks.push({ title: "Préparer le rendez-vous", description: text, dueAt, actionType: "appointment", priorityScore: 85 });
  if (/courriel|email/.test(normalized) && /envoy|ecri/.test(normalized)) tasks.push({ title: "Envoyer le courriel de suivi", description: text, dueAt, actionType: "email", priorityScore: 65 });
  if (!tasks.length) tasks.push({ title: "Faire le suivi", description: text, dueAt, actionType: "follow_up", priorityScore: 50 });
  return tasks;
}

function inferCaseType(text: string): InboxCaseType {
  const value = fold(text);
  const buyer = /acheteur|acheter|achat|cherche une|preapprobation|prequalification/.test(value);
  const seller = /vendeur|vendre|vente|inscription|mise en marche|mandat/.test(value);
  return buyer && seller ? "buy_sell" : seller ? "seller" : buyer ? "buyer" : /renouvellement hypothecaire/.test(value) ? "renewal" : /ancien client|apres.?vente/.test(value) ? "post_transaction" : "prospect";
}

function inferUrgency(text: string): InboxAnalysis["urgency"] {
  const value = fold(text);
  return /urgent|aujourd'hui|condition|notaire|echeance/.test(value) ? "critical" : /rapidement|demain|rappeler|promis/.test(value) ? "high" : /eventuellement|plus tard|long terme/.test(value) ? "low" : "normal";
}

function inferDueAt(text: string, now: Date) {
  const due = new Date(now);
  if (/demain/.test(text)) due.setUTCDate(due.getUTCDate() + 1);
  else if (/aujourd'hui|ce matin|cet apres-midi/.test(text)) { /* today */ }
  else if (/lundi/.test(text)) { const delta = (8 - due.getUTCDay()) % 7 || 7; due.setUTCDate(due.getUTCDate() + delta); }
  else return null;
  due.setUTCHours(/matin/.test(text) ? 14 : /apres-midi/.test(text) ? 19 : 17, 0, 0, 0);
  return due.toISOString();
}

function validFutureDate(value: unknown, now: Date) { if (typeof value !== "string" || !value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) || date.getTime() < now.getTime() - 86_400_000 ? null : date.toISOString(); }
function missingPerson(person: Partial<InboxAnalysis["person"]>) { const values: string[] = []; if (!person.firstName) values.push("Prénom à confirmer"); if (!person.lastName) values.push("Nom de famille à confirmer"); if (!person.email && !person.phone) values.push("Téléphone ou courriel manquant"); return values; }
function uniqueStrings(values: unknown[]) { return [...new Set(values.map((value) => clean(value, 240)).filter(Boolean))]; }
function stripJsonFence(value: string) { return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(); }
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function fold(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

