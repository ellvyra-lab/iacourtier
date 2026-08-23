export const UNIVERSAL_DOCUMENT_TYPES = [
  "Contrat de courtage vente",
  "Contrat de courtage achat",
  "Promesse d’achat",
  "Modification",
  "Contre-proposition",
  "Acte de vente",
  "Certificat de localisation",
  "Déclaration du vendeur",
  "Préapprobation",
  "Conversation client",
  "Pièce d’identité",
  "Taxes",
  "Autre",
] as const;

export type UniversalDocumentType = (typeof UNIVERSAL_DOCUMENT_TYPES)[number];
export type UniversalProjectType = "seller" | "buyer" | "buy_sell" | "unknown";
export type UniversalPersonRole = "seller" | "buyer" | "owner";
export type UniversalFactStatus = "confirmed" | "to_confirm";

export type UniversalSource = {
  name: string;
  type: UniversalDocumentType;
  sourceType: "pdf" | "image" | "screenshot";
  confidence: number | null;
  pageCount?: number | null;
  analysisMode?: string;
};

export type UniversalPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  roles: UniversalPersonRole[];
  sourceName: string;
  confidence: number | null;
};

export type UniversalProperty = {
  address: string;
  city: string;
  postalCode: string;
  propertyType: string;
  lotNumber: string;
};

export type UniversalBuyerCriteria = {
  budget: string;
  preapprovalStatus: string;
  sectors: string[];
  propertyType: string;
  bedrooms: string;
  importantNeeds: string;
  timeline: string;
  propertyToSell: boolean | null;
};

export type UniversalFact = {
  entity: "person" | "property" | "buyer" | "transaction";
  field: string;
  label: string;
  value: string;
  sourceName: string;
  sourceType: UniversalSource["sourceType"];
  confidence: number | null;
  status: UniversalFactStatus;
  note: string;
};

export type DuplicateMatch = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  matchedOn: string[];
};

export type PersonDuplicate = {
  personId: string;
  matches: DuplicateMatch[];
};

export type PropertyDuplicate = {
  id: string;
  address: string;
  city: string;
};

export type UniversalAnalysis = {
  projectType: UniversalProjectType;
  intentions: string[];
  people: UniversalPerson[];
  property: UniversalProperty;
  buyerCriteria: UniversalBuyerCriteria;
  sources: UniversalSource[];
  facts: UniversalFact[];
  ambiguities: string[];
  sellerStage: string | null;
  buyerStage: string | null;
  stageRationale: string;
  suggestedTasks: string[];
  suggestedAutomations: string[];
  coachSummary: string;
  duplicates?: PersonDuplicate[];
  propertyDuplicate?: PropertyDuplicate | null;
};

export type PersonDecision = {
  personId: string;
  action: "use" | "create";
  existingContactId?: string;
};

const EMPTY_PROPERTY: UniversalProperty = { address: "", city: "", postalCode: "", propertyType: "", lotNumber: "" };
const EMPTY_BUYER: UniversalBuyerCriteria = {
  budget: "", preapprovalStatus: "missing", sectors: [], propertyType: "", bedrooms: "",
  importantNeeds: "", timeline: "", propertyToSell: null,
};

export function universalExtractionPrompt(sourceNames: string[]) {
  return `Tu es le moteur d'analyse documentaire universelle d'un CRM immobilier québécois.

Analyse uniquement les sources fournies : ${sourceNames.join(", ")}.
Elles peuvent être des PDF texte, PDF numérisés, photos de documents ou captures d'écran d'une conversation. Reconstitue une conversation sur plusieurs images dans l'ordre transmis.

Règles absolues :
- N'invente rien. Une information absente reste vide.
- Identifie comme clients seulement les personnes réellement porteuses du projet. Exclue toujours courtier, notaire, témoin, prêteur et signataire technique.
- Garde chaque personne distincte. Ne fusionne que si le nom, courriel ou téléphone indique clairement la même personne.
- Détermine vendeur, acheteur, ou achat + vente d'après le contenu et l'intention, pas seulement le nom du fichier.
- Une ambiguïté, un texte peu lisible ou une déduction doit être to_confirm, jamais confirmed.
- Chaque information doit avoir une provenance : nom exact du fichier, type de source, confiance de 0 à 1 et note si ambiguë.
- Une promesse d'achat place le parcours acheteur à l'étape offer et le vendeur à offer_received.
- Un contrat de courtage vente signé place le vendeur à mandate_signed. Ne place pas systématiquement un dossier à la première étape.
- Classe chaque source dans exactement un type permis : ${UNIVERSAL_DOCUMENT_TYPES.join(", ")}.
- Retourne uniquement du JSON valide, sans Markdown.

Structure obligatoire :
{
  "projectType":"seller|buyer|buy_sell|unknown",
  "intentions":["veut vendre", "cherche une propriété", "demande une visite", "veut déposer une offre", "souhaite une évaluation", "besoin de préapprobation", "autre intention explicite"],
  "people":[{"firstName":"","lastName":"","email":"","phone":"","mailingAddress":"","roles":["seller|buyer|owner"],"sourceName":"nom exact","confidence":0.95}],
  "property":{"address":"","city":"","postalCode":"","propertyType":"","lotNumber":""},
  "buyerCriteria":{"budget":"","preapprovalStatus":"missing|pending|approved|declined","sectors":[],"propertyType":"","bedrooms":"","importantNeeds":"","timeline":"","propertyToSell":null},
  "documents":[{"name":"nom exact","type":"type permis","sourceType":"pdf|image|screenshot","confidence":0.95}],
  "facts":[{"entity":"person|property|buyer|transaction","field":"address","label":"Adresse","value":"","sourceName":"nom exact","sourceType":"pdf|image|screenshot","confidence":0.95,"status":"confirmed|to_confirm","note":""}],
  "ambiguities":[]
}`;
}

export function normalizeUniversalPartial(value: unknown, fallbackSources: UniversalSource[]): UniversalAnalysis {
  const root = record(value);
  const projectType = normalizeProjectType(root.projectType);
  const sources = normalizeSources(root.documents, fallbackSources);
  const people = normalizePeople(root.people);
  const property = normalizeProperty(root.property);
  const buyerCriteria = normalizeBuyerCriteria(root.buyerCriteria);
  const facts = normalizeFacts(root.facts, sources);
  addFallbackFacts(facts, { people, property, buyerCriteria, sources });
  return completeAnalysis({
    projectType,
    intentions: strings(root.intentions),
    people,
    property,
    buyerCriteria,
    sources,
    facts,
    ambiguities: strings(root.ambiguities),
  });
}

export function mergeUniversalAnalyses(items: UniversalAnalysis[]): UniversalAnalysis {
  if (!items.length) return completeAnalysis({
    projectType: "unknown", intentions: [], people: [], property: { ...EMPTY_PROPERTY },
    buyerCriteria: { ...EMPTY_BUYER }, sources: [], facts: [], ambiguities: [],
  });

  const intentions = unique(items.flatMap((item) => item.intentions));
  const sources = dedupeSources(items.flatMap((item) => item.sources));
  const people = mergePeople(items.flatMap((item) => item.people));
  const property = mergeRecord(items.map((item) => item.property), EMPTY_PROPERTY);
  const buyerCriteria = mergeBuyerCriteria(items.map((item) => item.buyerCriteria));
  const facts = dedupeFacts(items.flatMap((item) => item.facts));
  const projectType = mergeProjectTypes(items.map((item) => item.projectType), people);
  return completeAnalysis({
    projectType,
    intentions,
    people,
    property,
    buyerCriteria,
    sources,
    facts,
    ambiguities: unique(items.flatMap((item) => item.ambiguities)),
  });
}

export function sanitizeAnalysisForConfirmation(value: unknown): UniversalAnalysis {
  const root = record(value);
  const fallback = normalizeSources(root.sources, []);
  const normalized = normalizeUniversalPartial({ ...root, documents: root.sources }, fallback);
  normalized.duplicates = Array.isArray(root.duplicates) ? root.duplicates as PersonDuplicate[] : [];
  normalized.propertyDuplicate = root.propertyDuplicate && typeof root.propertyDuplicate === "object"
    ? root.propertyDuplicate as PropertyDuplicate
    : null;
  return normalized;
}

export function normalizeUniversalValue(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inferSourceType(name: string): UniversalSource["sourceType"] {
  const normalized = normalizeUniversalValue(name);
  if (/capture|screenshot|conversation|message|texto|sms|messenger|whatsapp/.test(normalized)) return "screenshot";
  return name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
}

export function inferDocumentType(name: string): UniversalDocumentType {
  const value = normalizeUniversalValue(name);
  if (/promesse|pachat|offre/.test(value)) return "Promesse d’achat";
  if (/contreproposition/.test(value)) return "Contre-proposition";
  if (/modification|(^|[^a-z])mo([^a-z]|$)/.test(value)) return "Modification";
  if (/ccv|contratcourtagevente/.test(value)) return "Contrat de courtage vente";
  if (/cca|contratcourtageachat/.test(value)) return "Contrat de courtage achat";
  if (/actevente/.test(value)) return "Acte de vente";
  if (/certificat|localisation/.test(value)) return "Certificat de localisation";
  if (/declarationvendeur/.test(value)) return "Déclaration du vendeur";
  if (/preappro|financ/.test(value)) return "Préapprobation";
  if (/identite|permis|passeport/.test(value)) return "Pièce d’identité";
  if (/taxe/.test(value)) return "Taxes";
  if (/capture|screenshot|conversation|message|texto|sms|messenger|whatsapp/.test(value)) return "Conversation client";
  return "Autre";
}

function completeAnalysis(input: Pick<UniversalAnalysis, "projectType" | "intentions" | "people" | "property" | "buyerCriteria" | "sources" | "facts" | "ambiguities">): UniversalAnalysis {
  const pipeline = derivePipeline(input.projectType, input.sources, input.intentions);
  const personNames = input.people.map((person) => `${person.firstName} ${person.lastName}`.trim()).filter(Boolean);
  const destination = input.projectType === "buy_sell" ? "un dossier vendeur et un dossier acheteur" : input.projectType === "seller" ? "un dossier vendeur" : input.projectType === "buyer" ? "un dossier acheteur" : "un projet à confirmer";
  const sourceCount = input.sources.length;
  const summary = `${sourceCount} source${sourceCount > 1 ? "s" : ""} analysée${sourceCount > 1 ? "s" : ""}. ${personNames.length ? `Personne${personNames.length > 1 ? "s" : ""} reconnue${personNames.length > 1 ? "s" : ""} : ${personNames.join(", ")}. ` : "Aucune personne certaine n’a été reconnue. "}Le Coach propose ${destination}${pipeline.stageRationale ? `, à l’étape ${pipeline.stageRationale}` : ""}. Valide les ambiguïtés et les doublons avant de créer quoi que ce soit.`;
  return {
    ...input,
    ...pipeline,
    suggestedTasks: suggestedTasks(input.projectType, input.intentions, input.sources),
    suggestedAutomations: suggestedAutomations(input.projectType),
    coachSummary: summary,
  };
}

function derivePipeline(projectType: UniversalProjectType, sources: UniversalSource[], intentions: string[]) {
  const types = new Set(sources.map((source) => source.type));
  const intent = normalizeUniversalValue(intentions.join(" "));
  let sellerStage: string | null = projectType === "seller" || projectType === "buy_sell" ? "lead" : null;
  let buyerStage: string | null = projectType === "buyer" || projectType === "buy_sell" ? "qualification" : null;
  let stageRationale = "départ à valider";

  if (types.has("Acte de vente")) { sellerStage = sellerStage ? "transaction_completed" : null; stageRationale = "transaction complétée (acte de vente)"; }
  if (types.has("Contrat de courtage vente") || types.has("Modification")) { sellerStage = sellerStage ? "mandate_signed" : null; stageRationale = "mandat signé"; }
  if (types.has("Préapprobation")) { buyerStage = buyerStage ? "financing" : null; stageRationale = "financement/préapprobation"; }
  if (types.has("Contrat de courtage achat")) { buyerStage = buyerStage ? "active_search" : null; stageRationale = "contrat acheteur signé"; }
  if (/visite/.test(intent)) { buyerStage = buyerStage ? "visits" : null; stageRationale = "visite demandée"; }
  if (types.has("Promesse d’achat") || types.has("Contre-proposition") || /deposeroffre|faireoffre/.test(intent)) {
    if (sellerStage) sellerStage = "offer_received";
    if (buyerStage) buyerStage = "offer";
    stageRationale = "offre/promesse d’achat";
  }
  return { sellerStage, buyerStage, stageRationale };
}

function suggestedTasks(projectType: UniversalProjectType, intentions: string[], sources: UniversalSource[]) {
  const tasks = ["Valider les personnes, leurs rôles et leurs coordonnées", "Valider les informations ambiguës avec le client"];
  const types = new Set(sources.map((source) => source.type));
  if (projectType === "seller" || projectType === "buy_sell") tasks.push("Valider la propriété et les documents du mandat vendeur");
  if (projectType === "buyer" || projectType === "buy_sell") tasks.push("Confirmer les critères, le budget et l’échéancier acheteur");
  if (types.has("Promesse d’achat")) tasks.push("Réviser les conditions et les échéances de la promesse d’achat");
  if (intentions.some((intent) => /visite/i.test(intent))) tasks.push("Planifier et confirmer la visite demandée");
  return unique(tasks);
}

function suggestedAutomations(projectType: UniversalProjectType) {
  const output: string[] = [];
  if (projectType === "seller" || projectType === "buy_sell") output.push("Bienvenue vendeur", "Documents manquants", "Compte rendu vendeur");
  if (projectType === "buyer" || projectType === "buy_sell") output.push("Bienvenue acheteur", "Guide acheteur", "Préapprobation");
  return output;
}

function normalizeProjectType(value: unknown): UniversalProjectType {
  const normalized = normalizeUniversalValue(String(value || ""));
  if (["buysell", "achatvente", "vendeuracheteur"].includes(normalized)) return "buy_sell";
  if (["seller", "vendeur", "vente"].includes(normalized)) return "seller";
  if (["buyer", "acheteur", "achat"].includes(normalized)) return "buyer";
  return "unknown";
}

function normalizePeople(value: unknown): UniversalPerson[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const person = record(raw);
    const requestedRoles = strings(person.roles).map((role) => normalizeUniversalValue(role));
    const roles = unique(requestedRoles.map((role) => role === "vendeur" ? "seller" : role === "acheteur" ? "buyer" : role).filter((role): role is UniversalPersonRole => ["seller", "buyer", "owner"].includes(role)));
    return {
      id: `person-${index + 1}`,
      firstName: text(person.firstName), lastName: text(person.lastName), email: text(person.email), phone: text(person.phone),
      mailingAddress: text(person.mailingAddress), roles, sourceName: text(person.sourceName), confidence: confidence(person.confidence),
    };
  }).filter((person) => person.firstName || person.lastName || person.email || person.phone);
}

function normalizeProperty(value: unknown): UniversalProperty {
  const property = record(value);
  return { address: text(property.address), city: text(property.city), postalCode: text(property.postalCode), propertyType: text(property.propertyType), lotNumber: text(property.lotNumber) };
}

function normalizeBuyerCriteria(value: unknown): UniversalBuyerCriteria {
  const buyer = record(value);
  const propertyToSell = typeof buyer.propertyToSell === "boolean" ? buyer.propertyToSell : null;
  return {
    budget: text(buyer.budget), preapprovalStatus: text(buyer.preapprovalStatus) || "missing", sectors: strings(buyer.sectors),
    propertyType: text(buyer.propertyType), bedrooms: text(buyer.bedrooms), importantNeeds: text(buyer.importantNeeds), timeline: text(buyer.timeline), propertyToSell,
  };
}

function normalizeSources(value: unknown, fallbacks: UniversalSource[]) {
  const fallbackByName = new Map(fallbacks.map((source) => [source.name, source]));
  const parsed = Array.isArray(value) ? value.map((raw) => {
    const source = record(raw);
    const name = text(source.name);
    const fallback = fallbackByName.get(name);
    const requested = String(source.sourceType || fallback?.sourceType || inferSourceType(name));
    const sourceType: UniversalSource["sourceType"] = ["pdf", "image", "screenshot"].includes(requested) ? requested as UniversalSource["sourceType"] : inferSourceType(name);
    return { name, type: normalizeDocumentType(source.type, name), sourceType, confidence: confidence(source.confidence), pageCount: fallback?.pageCount, analysisMode: fallback?.analysisMode };
  }).filter((source) => source.name) : [];
  return dedupeSources([...parsed, ...fallbacks.filter((fallback) => !parsed.some((source) => source.name === fallback.name))]);
}

function normalizeDocumentType(value: unknown, name: string): UniversalDocumentType {
  const exact = String(value || "") as UniversalDocumentType;
  return (UNIVERSAL_DOCUMENT_TYPES as readonly string[]).includes(exact) ? exact : inferDocumentType(name);
}

function normalizeFacts(value: unknown, sources: UniversalSource[]): UniversalFact[] {
  if (!Array.isArray(value)) return [];
  const byName = new Map(sources.map((source) => [source.name, source]));
  return value.map((raw) => {
    const fact = record(raw);
    const sourceName = text(fact.sourceName);
    const source = byName.get(sourceName);
    const requestedEntity = String(fact.entity || "transaction");
    const entity = ["person", "property", "buyer", "transaction"].includes(requestedEntity) ? requestedEntity as UniversalFact["entity"] : "transaction";
    const valueText = text(fact.value);
    const valueConfidence = confidence(fact.confidence);
    const requestedStatus = String(fact.status || "to_confirm");
    const status: UniversalFactStatus = requestedStatus === "confirmed" && sourceName && (valueConfidence ?? 0) >= 0.75 ? "confirmed" : "to_confirm";
    return {
      entity, field: text(fact.field), label: text(fact.label) || text(fact.field), value: valueText,
      sourceName: sourceName || "Source à confirmer", sourceType: source?.sourceType || inferSourceType(sourceName),
      confidence: valueConfidence, status, note: text(fact.note),
    };
  }).filter((fact) => fact.field && fact.value);
}

function addFallbackFacts(facts: UniversalFact[], context: { people: UniversalPerson[]; property: UniversalProperty; buyerCriteria: UniversalBuyerCriteria; sources: UniversalSource[] }) {
  const defaultSource = context.sources[0];
  const add = (entity: UniversalFact["entity"], field: string, label: string, value: string, sourceName?: string, valueConfidence?: number | null) => {
    if (!value || facts.some((fact) => fact.entity === entity && fact.field === field && normalizeUniversalValue(fact.value) === normalizeUniversalValue(value))) return;
    facts.push({ entity, field, label, value, sourceName: sourceName || defaultSource?.name || "Source à confirmer", sourceType: defaultSource?.sourceType || "image", confidence: valueConfidence ?? null, status: "to_confirm", note: "Provenance détaillée à valider par le courtier." });
  };
  context.people.forEach((person) => {
    const name = `${person.firstName} ${person.lastName}`.trim();
    add("person", "name", "Nom", name, person.sourceName, person.confidence);
    add("person", "email", "Courriel", person.email, person.sourceName, person.confidence);
    add("person", "phone", "Téléphone", person.phone, person.sourceName, person.confidence);
  });
  Object.entries(context.property).forEach(([field, value]) => add("property", field, propertyLabel(field), value));
  Object.entries(context.buyerCriteria).forEach(([field, value]) => {
    const rendered = Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value || "");
    if (rendered && rendered !== "missing") add("buyer", field, propertyLabel(field), rendered);
  });
}

function mergePeople(people: UniversalPerson[]) {
  const output: UniversalPerson[] = [];
  for (const person of people) {
    const match = output.find((existing) => {
      const sameEmail = normalizeUniversalValue(person.email) && normalizeUniversalValue(person.email) === normalizeUniversalValue(existing.email);
      const samePhone = person.phone.replace(/\D/g, "") && person.phone.replace(/\D/g, "") === existing.phone.replace(/\D/g, "");
      const sameName = normalizeUniversalValue(`${person.firstName}${person.lastName}`) && normalizeUniversalValue(`${person.firstName}${person.lastName}`) === normalizeUniversalValue(`${existing.firstName}${existing.lastName}`);
      return Boolean(sameEmail || samePhone || sameName);
    });
    if (!match) { output.push({ ...person, id: `person-${output.length + 1}` }); continue; }
    match.firstName ||= person.firstName; match.lastName ||= person.lastName; match.email ||= person.email; match.phone ||= person.phone;
    match.mailingAddress ||= person.mailingAddress; match.roles = unique([...match.roles, ...person.roles]);
    if ((person.confidence || 0) > (match.confidence || 0)) { match.confidence = person.confidence; match.sourceName = person.sourceName; }
  }
  return output;
}

function mergeProjectTypes(types: UniversalProjectType[], people: UniversalPerson[]) {
  if (types.includes("buy_sell")) return "buy_sell";
  const hasSeller = types.includes("seller") || people.some((person) => person.roles.some((role) => role === "seller" || role === "owner"));
  const hasBuyer = types.includes("buyer") || people.some((person) => person.roles.includes("buyer"));
  return hasSeller && hasBuyer ? "buy_sell" : hasSeller ? "seller" : hasBuyer ? "buyer" : "unknown";
}

function mergeBuyerCriteria(items: UniversalBuyerCriteria[]) {
  const merged = mergeRecord(items, EMPTY_BUYER);
  return { ...merged, sectors: unique(items.flatMap((item) => item.sectors)), propertyToSell: items.find((item) => item.propertyToSell !== null)?.propertyToSell ?? null };
}

function mergeRecord<T extends Record<string, unknown>>(items: T[], empty: T): T {
  const output = { ...empty };
  for (const item of items) for (const [key, value] of Object.entries(item)) {
    const current = output[key];
    const meaningful = Array.isArray(value) ? value.length : value !== null && value !== undefined && value !== "" && value !== "missing";
    const currentEmpty = Array.isArray(current) ? !current.length : current === null || current === undefined || current === "" || current === "missing";
    if (meaningful && currentEmpty) (output as Record<string, unknown>)[key] = value;
  }
  return output;
}

function dedupeSources(sources: UniversalSource[]) {
  const map = new Map<string, UniversalSource>();
  sources.forEach((source) => { if (source.name) map.set(source.name, { ...map.get(source.name), ...source }); });
  return [...map.values()];
}

function dedupeFacts(facts: UniversalFact[]) {
  const map = new Map<string, UniversalFact>();
  facts.forEach((fact) => {
    const key = `${fact.entity}:${fact.field}:${normalizeUniversalValue(fact.value)}:${fact.sourceName}`;
    const existing = map.get(key);
    if (!existing || (fact.confidence || 0) > (existing.confidence || 0)) map.set(key, fact);
  });
  return [...map.values()];
}

function propertyLabel(field: string) {
  const labels: Record<string, string> = { address: "Adresse", city: "Ville", postalCode: "Code postal", propertyType: "Type de propriété", lotNumber: "Numéro de lot", budget: "Budget", preapprovalStatus: "Préapprobation", sectors: "Secteurs", bedrooms: "Chambres", importantNeeds: "Besoins importants", timeline: "Échéancier", propertyToSell: "Propriété à vendre" };
  return labels[field] || field;
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function confidence(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null; }
function unique<T>(values: T[]) { return [...new Set(values)]; }
