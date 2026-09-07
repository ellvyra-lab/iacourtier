import { generateWithOpenAI } from "@/lib/openai";

export type InboxActionType = "call" | "sms" | "email" | "document" | "research" | "appointment" | "follow_up" | "marketing" | "other";
export type InboxCaseType = "buyer" | "seller" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";

export type InboxTask = {
  title: string;
  description: string;
  dueAt: string | null;
  dueOn: string | null;
  dueLabel: string | null;
  actionType: InboxActionType;
  priorityScore: number;
};

export type InboxAnalysis = {
  person: { firstName: string; lastName: string; email: string; phone: string };
  caseType: InboxCaseType;
  project: string;
  property: { address: string; city: string; propertyType: string };
  buyerCriteria: { sectors: string[]; budgetMax: number | null; bedroomsMin: number | null; garageRequired: boolean | null; mustHaves: string[]; preferences: string[] };
  financing: { prequalified: boolean | null; amount: number | null };
  request: string;
  urgency: "critical" | "high" | "normal" | "low";
  tasks: InboxTask[];
  missingInformation: string[];
  summary: string;
  correction: boolean;
  confidence: number;
};

const SYSTEM_PROMPT = `Tu analyses une capture rapide vocale ou texte pour un CRM immobilier québécois. Retourne uniquement un objet JSON valide, sans markdown.
Schéma: {"person":{"firstName":"","lastName":"","email":"","phone":""},"caseType":"buyer|seller|buy_sell|prospect|renewal|post_transaction|other","project":"","property":{"address":"","city":"","propertyType":""},"buyerCriteria":{"sectors":[],"budgetMax":null,"bedroomsMin":null,"garageRequired":null,"mustHaves":[],"preferences":[]},"financing":{"prequalified":null,"amount":null},"request":"","urgency":"critical|high|normal|low","tasks":[{"title":"","description":"","dueAt":"ISO-8601 avec heure explicite ou null","dueOn":"YYYY-MM-DD si seule la journée est connue ou null","dueLabel":"expression originale ou null","actionType":"call|sms|email|document|research|appointment|follow_up|marketing|other","priorityScore":0}],"missingInformation":[""],"summary":"","correction":false,"confidence":0.0}.
Ne crée aucune donnée. N'invente jamais un nom, un téléphone, une adresse ou une heure. Chaque action demandée devient une tâche distincte, mais limite-toi aux actions utiles. Utilise l'heure de Toronto et le français du Québec. Une phrase commençant par « correction » corrige la donnée récente.`;

export async function analyzeInboxText(rawText: string, now = new Date()): Promise<{ analysis: InboxAnalysis; engine: "openai" | "deterministic" }> {
  const text = rawText.trim().slice(0, 12_000);
  try {
    const result = await generateWithOpenAI({ systemPrompt: SYSTEM_PROMPT, userPrompt: `Date et heure actuelles: ${now.toISOString()}\nCapture: ${text}`, maxTokens: 1800, temperature: 0.1 });
    return { analysis: normalizeAnalysis(JSON.parse(stripJsonFence(result)), text, now), engine: "openai" };
  } catch {
    return { analysis: deterministicAnalysis(text, now), engine: "deterministic" };
  }
}

export function normalizeAnalysis(input: Partial<InboxAnalysis>, rawText: string, now = new Date()): InboxAnalysis {
  const fallback = deterministicAnalysis(rawText, now);
  const person = input.person || fallback.person;
  const property = input.property || fallback.property;
  const criteria = input.buyerCriteria || fallback.buyerCriteria;
  const financing = input.financing || fallback.financing;
  const allowedCases: InboxCaseType[] = ["buyer", "seller", "buy_sell", "prospect", "renewal", "post_transaction", "other"];
  const allowedUrgency = ["critical", "high", "normal", "low"] as const;
  const allowedActions: InboxActionType[] = ["call", "sms", "email", "document", "research", "appointment", "follow_up", "marketing", "other"];
  const aiTasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 8).map((task) => normalizeTask(task, rawText, now, allowedActions)) : [];
  const normalizedPerson = { firstName: clean(person.firstName, 120) || fallback.person.firstName, lastName: clean(person.lastName, 120) || fallback.person.lastName, email: (clean(person.email, 320) || fallback.person.email).toLowerCase(), phone: clean(person.phone, 60) || fallback.person.phone };
  return {
    person: normalizedPerson,
    caseType: allowedCases.includes(input.caseType as InboxCaseType) ? input.caseType as InboxCaseType : fallback.caseType,
    project: clean(input.project, 240) || fallback.project,
    property: { address: clean(property.address, 500) || fallback.property.address, city: clean(property.city, 160) || fallback.property.city, propertyType: clean(property.propertyType, 120) || fallback.property.propertyType },
    buyerCriteria: {
      sectors: uniqueStrings([...(Array.isArray(criteria.sectors) ? criteria.sectors : []), ...fallback.buyerCriteria.sectors]),
      budgetMax: positiveNumber(criteria.budgetMax) ?? fallback.buyerCriteria.budgetMax,
      bedroomsMin: positiveNumber(criteria.bedroomsMin) ?? fallback.buyerCriteria.bedroomsMin,
      garageRequired: typeof criteria.garageRequired === "boolean" ? criteria.garageRequired : fallback.buyerCriteria.garageRequired,
      mustHaves: uniqueStrings([...(Array.isArray(criteria.mustHaves) ? criteria.mustHaves : []), ...fallback.buyerCriteria.mustHaves]),
      preferences: uniqueStrings([...(Array.isArray(criteria.preferences) ? criteria.preferences : []), ...fallback.buyerCriteria.preferences]),
    },
    financing: { prequalified: typeof financing.prequalified === "boolean" ? financing.prequalified : fallback.financing.prequalified, amount: positiveNumber(financing.amount) ?? fallback.financing.amount },
    request: clean(input.request, 3000) || rawText,
    urgency: allowedUrgency.includes(input.urgency as typeof allowedUrgency[number]) ? input.urgency as typeof allowedUrgency[number] : fallback.urgency,
    tasks: dedupeTasks([...aiTasks, ...fallback.tasks]).slice(0, 8),
    missingInformation: uniqueStrings([...(Array.isArray(input.missingInformation) ? input.missingInformation : []), ...missingPerson(normalizedPerson)]),
    summary: clean(input.summary, 2000) || fallback.summary,
    correction: Boolean(input.correction || fallback.correction),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || fallback.confidence)),
  };
}

export function deterministicAnalysis(text: string, now = new Date()): InboxAnalysis {
  const normalized = fold(text);
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/)?.[0] || "";
  const person = extractPerson(text, email, phone);
  const propertyType = text.match(/\b(maison|condo|duplex|triplex|quadruplex|immeuble|terrain|chalet|bungalow)\b/i)?.[1] || "";
  const address = extractAddress(text);
  const sectors = extractSectors(text, propertyType);
  const city = address ? "" : sectors[0] || "";
  const budgetMax = extractMoney(text);
  const bedroomsMin = extractBedrooms(normalized);
  const garageRequired = /(?:absolument|obligatoire|essentiel)[^.!?]{0,35}garage|garage[^.!?]{0,20}(?:obligatoire|essentiel)/.test(normalized) ? true : null;
  const prequalified = /(?:n['’]est|n est|pas)\s+(?:pas\s+)?(?:encore\s+)?prequalif|prequalification\s+(?:a obtenir|manquante)/.test(normalized) ? false : /(?:maintenant|deja|est)\s+prequalifi|prequalification\s+(?:obtenue|confirmee)/.test(normalized) ? true : null;
  const caseType = inferCaseType(text);
  const firstName = person.firstName || "le client";
  return {
    person,
    caseType,
    project: caseType === "buyer" ? "Achat résidentiel" : caseType === "seller" ? "Vente résidentielle" : "Suivi immobilier",
    property: { address, city, propertyType },
    buyerCriteria: { sectors, budgetMax, bedroomsMin, garageRequired, mustHaves: garageRequired ? ["Garage obligatoire"] : [], preferences: [] },
    financing: { prequalified, amount: prequalified ? budgetMax : null },
    request: text,
    urgency: inferUrgency(text),
    tasks: inferTasks(text, now, firstName, prequalified),
    missingInformation: missingPerson(person),
    summary: text,
    correction: /^(?:non[, ]+)?correction\b/.test(normalized),
    confidence: person.firstName && person.lastName ? 0.82 : person.firstName ? 0.68 : 0.42,
  };
}

export function shouldAutoProcess(analysis: InboxAnalysis, hasUnresolvedAmbiguity: boolean) { return !hasUnresolvedAmbiguity && Boolean(analysis.person.firstName) && analysis.confidence >= 0.68; }

function normalizeTask(task: Partial<InboxTask>, rawText: string, now: Date, allowed: InboxActionType[]): InboxTask {
  const parsed = inferDeadline(clean(task.dueLabel, 120) || rawText, now);
  return { title: clean(task.title, 240) || "Faire le suivi", description: clean(task.description, 2000) || rawText, dueAt: validFutureDate(task.dueAt, now) || parsed.dueAt, dueOn: validDateOnly(task.dueOn) || parsed.dueOn, dueLabel: clean(task.dueLabel, 120) || parsed.dueLabel, actionType: allowed.includes(task.actionType as InboxActionType) ? task.actionType as InboxActionType : "other", priorityScore: Math.max(0, Math.min(100, Number(task.priorityScore) || 50)) };
}

function inferTasks(text: string, now: Date, firstName: string, prequalified: boolean | null): InboxTask[] {
  const value = fold(text);
  const deadline = inferDeadline(text, now);
  const tasks: InboxTask[] = [];
  const push = (title: string, actionType: InboxActionType, priorityScore = 70, useDeadline = false) => tasks.push({ title, description: text, dueAt: useDeadline ? deadline.dueAt : null, dueOn: useDeadline ? deadline.dueOn : null, dueLabel: useDeadline ? deadline.dueLabel : null, actionType, priorityScore });
  if (/rappel(?:er|le)|dois\s+(?:la|le|lui)?\s*rappeler/.test(value)) push(`Rappeler ${firstName}`, "call", 85, true);
  if (/appell?er?\s+(?:le\s+|la\s+)?photographe/.test(value)) push("Appeler le photographe", "call", 75);
  if (/certificat de localisation/.test(value)) push(/recuper/.test(value) ? "Récupérer le certificat de localisation" : "Demander le certificat de localisation", "document", 80);
  if (/comparables|analyse comparative/.test(value)) push("Préparer les comparables", "research", 80);
  if (/demande[^.!?]{0,35}(?:adresse )?(?:courriel|email)/.test(value)) push(`Demander l’adresse courriel de ${firstName}`, "email", 65);
  if (prequalified === false) push(`Obtenir la préqualification de ${firstName}`, "follow_up", 85);
  if (/prendre rendez-vous|fixer (?:un )?rendez-vous/.test(value) && !tasks.some((task) => task.title.startsWith("Rappeler"))) push(`Prendre rendez-vous avec ${firstName}`, "appointment", 80, true);
  if (!tasks.length) push(`Faire le suivi avec ${firstName}`, "follow_up", 50, Boolean(deadline.dueAt || deadline.dueOn));
  return dedupeTasks(tasks);
}

function inferCaseType(text: string): InboxCaseType {
  const value = fold(text);
  const buyer = /acheteur|acheter|achat|cherche (?:une|un)|preapprobation|prequalification|budget/.test(value);
  const seller = /vendeur|vendeuse|vendre|vente|inscription|mise en marche|mandat|pense vendre/.test(value);
  return buyer && seller ? "buy_sell" : seller ? "seller" : buyer ? "buyer" : /renouvellement hypothecaire/.test(value) ? "renewal" : /ancien client|apres.?vente/.test(value) ? "post_transaction" : "prospect";
}

function inferUrgency(text: string): InboxAnalysis["urgency"] {
  const value = fold(text);
  return /urgent|avant\s+\d{1,2}\s*h|aujourd'hui|condition|notaire|echeance|des que possible/.test(value) ? "critical" : /rapidement|demain|rappeler|promis|mardi|mercredi|jeudi|vendredi/.test(value) ? "high" : /pas pressant|eventuellement|plus tard|long terme/.test(value) ? "low" : "normal";
}

function inferDeadline(text: string, now: Date) {
  const value = fold(text);
  const due = new Date(now);
  let recognized = false;
  if (/demain/.test(value)) { due.setUTCDate(due.getUTCDate() + 1); recognized = true; }
  else if (/dans deux semaines/.test(value)) { due.setUTCDate(due.getUTCDate() + 14); recognized = true; }
  else if (/semaine prochaine/.test(value)) { const delta = (8 - due.getUTCDay()) % 7 || 7; due.setUTCDate(due.getUTCDate() + delta); recognized = true; }
  else {
    const weekdays: Array<[RegExp, number]> = [[/dimanche/,0],[/lundi/,1],[/mardi/,2],[/mercredi/,3],[/jeudi/,4],[/vendredi/,5],[/samedi/,6]];
    const match = weekdays.find(([pattern]) => pattern.test(value));
    if (match) { const delta = (match[1] - due.getUTCDay() + 7) % 7 || 7; due.setUTCDate(due.getUTCDate() + delta); recognized = true; }
  }
  const hour = value.match(/avant\s+(\d{1,2})(?:\s*h(?:\s*(\d{2}))?)?/);
  if (recognized && hour) { due.setUTCHours(Number(hour[1]) + 4, Number(hour[2] || 0), 0, 0); return { dueAt: due.toISOString(), dueOn: null, dueLabel: deadlineLabel(text) }; }
  return recognized ? { dueAt: null, dueOn: due.toISOString().slice(0, 10), dueLabel: deadlineLabel(text) } : { dueAt: null, dueOn: null, dueLabel: /apres mon rendez-vous/.test(value) ? "Après mon rendez-vous" : null };
}

function extractPerson(text: string, email: string, phone: string) {
  const patterns = [/(?:parl(?:é|e|er)|appel[ée]?|rappeler|avec)\s+(?:à\s+)?([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)(?:\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+))?/u, /(?:^|[.!?]\s+)([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)\s+(?:vient|pense|cherche|veut|souhaite|est)/u, /^([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)(?:\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+))?\s+vient\b/u];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  return { firstName: match?.[1] || "", lastName: match?.[2] || "", email, phone };
}

function extractAddress(text: string) { return clean(text.match(/\b(\d{1,6}\s+(?:(?:rue|avenue|av\.?|chemin|boulevard|boul\.?|rang|route)\s+)?[A-ZÀ-ÖØ-Ý][\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2})(?=[,.!?]|\s+(?:il|elle|qui|et)\b|$)/u)?.[1], 500); }
function extractSectors(text: string, propertyType: string) { const escapedType = propertyType ? propertyType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "(?:maison|condo|duplex|triplex|bungalow|immeuble|terrain|chalet)"; const match = text.match(new RegExp(`\\b${escapedType}\\s+(?:à|dans)\\s+([^.!?]+?)(?=\\s+(?:jusqu|autour|pour|avec|minimum|maximum|qui)|[.!?]|$)`, "i")); return match ? uniqueStrings(match[1].split(/\s+ou\s+|\s*,\s*/i).map((value) => value.replace(/^(?:le|la|les)\s+/i, ""))) : []; }
function extractMoney(text: string) { const match = text.match(/\b(\d{2,3}(?:[ .]\d{3})+|\d{5,7})\s*\$/); return match ? Number(match[1].replace(/\D/g, "")) : null; }
function extractBedrooms(value: string) { const words: Record<string, number> = { une:1, un:1, deux:2, trois:3, quatre:4, cinq:5, six:6 }; const match = value.match(/(?:minimum\s+)?(\d+|une?|deux|trois|quatre|cinq|six)\s+chambres?/); return match ? Number(match[1]) || words[match[1]] || null : null; }
function deadlineLabel(text: string) { return clean(text.match(/\b(demain|ce matin|cet après-midi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lundi|semaine prochaine|dans deux semaines)(?:\s+matin|\s+après-midi)?/i)?.[0], 120) || null; }
function dedupeTasks(tasks: InboxTask[]) { return [...new Map(tasks.map((task) => [fold(task.title), task])).values()]; }
function validFutureDate(value: unknown, now: Date) { if (typeof value !== "string" || !value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) || date.getTime() < now.getTime() - 86_400_000 ? null : date.toISOString(); }
function validDateOnly(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function positiveNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function missingPerson(person: Partial<InboxAnalysis["person"]>) { const values: string[] = []; if (!person.firstName) values.push("Prénom à confirmer"); if (!person.lastName) values.push("Nom de famille à confirmer"); if (!person.email && !person.phone) values.push("Téléphone ou courriel manquant"); return values; }
function uniqueStrings(values: unknown[]) { return [...new Set(values.map((value) => clean(value, 240)).filter(Boolean))]; }
function stripJsonFence(value: string) { return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(); }
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function fold(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

