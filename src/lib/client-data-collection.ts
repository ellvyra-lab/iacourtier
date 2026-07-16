import { generateClientCommunication } from "@/lib/client-communication/engine";
import { syncClientAutomations } from "@/lib/client-automations";
import { getSoniaProspect, getSoniaProspects, saveSoniaProspects, updateSoniaProspect } from "@/lib/sonia-beta/storage";
import type { ClientImportProfile, SoniaProspect } from "@/lib/sonia-beta/types";

export type MissingDataField = "mortgageRenewal" | "birthDate" | "transactionDate" | "email" | "phone" | "address" | "projectType" | "communicationConsent" | "lender" | "interests";
export type CollectionRequestStatus = "préparée" | "complétée" | "expirée" | "exclue";

export type CollectionRequest = {
  id: string;
  token: string;
  clientId: string;
  clientFirstName: string;
  fields: MissingDataField[];
  message: string;
  link: string;
  status: CollectionRequestStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
  responseCount: number;
  updatedFields: string[];
};

export type CollectionResponse = {
  mortgageMonth?: string;
  mortgageYear?: string;
  lender?: string;
  mortgagePartnerInterest?: "yes" | "no";
  birthDate?: string;
  transactionDate?: string;
  email?: string;
  phone?: string;
  address?: string;
  projectType?: string;
  communicationConsent?: "yes" | "no";
  interests?: string[];
};

export const MISSING_DATA_LABELS: Record<MissingDataField, string> = {
  mortgageRenewal: "Renouvellement hypothécaire",
  birthDate: "Date de naissance",
  transactionDate: "Date de transaction",
  email: "Courriel",
  phone: "Téléphone",
  address: "Adresse actuelle",
  projectType: "Type de projet",
  communicationConsent: "Consentement de communication",
  lender: "Institution financière",
  interests: "Intérêts immobiliers",
};

const REQUESTS_KEY = "iacourtier_client_data_requests";
const AUTOMATIONS_KEY = "iacourtier_client_automations";
const IMPORT_INDEX_KEY = "iacourtier_client_import_index";
const PROSPECTS_KEY = "iacourtier_sonia_beta_prospects";
const RESET_MARKER_KEY = "iacourtier_client_database_reset";
const REQUEST_TTL_DAYS = 30;

export function getCollectionRequests(): CollectionRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REQUESTS_KEY) || "[]") as CollectionRequest[];
    const now = Date.now();
    let changed = false;
    const requests = Array.isArray(parsed) ? parsed.map((request) => {
      if (request.status === "préparée" && new Date(request.expiresAt).getTime() < now) {
        changed = true;
        return { ...request, status: "expirée" as const };
      }
      return request;
    }) : [];
    if (changed) saveRequests(requests);
    return requests;
  } catch {
    return [];
  }
}

export function getMissingDataFields(contact: SoniaProspect): MissingDataField[] {
  const profile = contact.importProfile;
  return [
    !profile?.mortgageRenewalDate ? "mortgageRenewal" : null,
    !profile?.birthDate ? "birthDate" : null,
    !profile?.transactionDate ? "transactionDate" : null,
    !contact.email ? "email" : null,
    !contact.phone ? "phone" : null,
    !contact.address ? "address" : null,
    !profile?.projectType ? "projectType" : null,
    !profile?.communicationConsent && !profile?.communicationConsentAnsweredAt ? "communicationConsent" : null,
    !profile?.lender ? "lender" : null,
    !profile?.interests?.length ? "interests" : null,
  ].filter((field): field is MissingDataField => Boolean(field));
}

export function isContactExcluded(contact: SoniaProspect) {
  return /ne plus (me )?contacter|do not contact|désabonn|desabonn|plainte active|contact exclu/i.test(contact.notes);
}

export function generateCollectionRequests(field: MissingDataField, contacts = getSoniaProspects()) {
  const existing = getCollectionRequests();
  const activeKeys = new Set(existing.filter((request) => request.status === "préparée").map((request) => `${request.clientId}|${request.fields.join(",")}`));
  const created: CollectionRequest[] = [];

  contacts.filter((contact) => !contact.id.startsWith("sonia-demo-") && getMissingDataFields(contact).includes(field)).forEach((contact) => {
    const key = `${contact.id}|${field}`;
    if (activeKeys.has(key)) return;
    const now = new Date();
    const excluded = isContactExcluded(contact);
    const token = createSecureToken();
    const request: CollectionRequest = {
      id: `request-${token.slice(0, 12)}`,
      token,
      clientId: contact.id,
      clientFirstName: firstName(contact.name),
      fields: [field],
      message: buildCollectionMessage(contact, field),
      link: typeof window === "undefined" ? `/informations-client/${token}` : `${window.location.origin}/informations-client/${token}`,
      status: excluded ? "exclue" : "préparée",
      createdAt: now.toISOString(),
      expiresAt: addDays(now, REQUEST_TTL_DAYS).toISOString(),
      responseCount: 0,
      updatedFields: [],
    };
    created.push(request);
    activeKeys.add(key);
  });

  saveRequests([...existing, ...created]);
  return created;
}

export function getCollectionRequestByToken(token: string) {
  const request = getCollectionRequests().find((item) => safeTokenEqual(item.token, token));
  if (!request) return null;
  const contact = getSoniaProspect(request.clientId);
  if (!contact) return null;
  return {
    request,
    firstName: request.clientFirstName,
    fields: request.fields,
    expired: request.status === "expirée" || new Date(request.expiresAt).getTime() < Date.now(),
    completed: request.status === "complétée",
  };
}

export function submitCollectionResponse(token: string, response: CollectionResponse) {
  const requests = getCollectionRequests();
  const request = requests.find((item) => safeTokenEqual(item.token, token));
  if (!request) throw new Error("Ce lien n’est pas valide.");
  if (request.status === "expirée" || new Date(request.expiresAt).getTime() < Date.now()) throw new Error("Ce lien est expiré.");
  if (request.status === "exclue") throw new Error("Ce contact est exclu des communications.");

  const contact = getSoniaProspect(request.clientId);
  if (!contact || isContactExcluded(contact)) throw new Error("Cette demande n’est plus disponible.");
  const updatedFields: string[] = [];
  const now = new Date().toISOString();

  updateSoniaProspect(contact.id, (current) => {
    const profile: ClientImportProfile = {
      relationshipType: current.importProfile?.relationshipType || (current.clientType === "seller" ? "seller" : "buyer"),
      communicationConsent: current.importProfile?.communicationConsent || false,
      automationEligible: current.importProfile?.automationEligible || [],
      missingInformation: current.importProfile?.missingInformation || [],
      ...current.importProfile,
    };

    if (response.mortgageMonth && response.mortgageYear) {
      const month = String(Number(response.mortgageMonth)).padStart(2, "0");
      profile.mortgageRenewalDate = `${response.mortgageYear}-${month}-01`;
      updatedFields.push("Renouvellement hypothécaire");
    }
    if (response.lender?.trim()) { profile.lender = response.lender.trim(); updatedFields.push("Institution financière"); }
    if (response.mortgagePartnerInterest) {
      profile.mortgagePartnerInterest = response.mortgagePartnerInterest === "yes";
      updatedFields.push("Intérêt partenaire hypothécaire");
    }
    if (response.birthDate) { profile.birthDate = response.birthDate; updatedFields.push("Date de naissance"); }
    if (response.transactionDate) { profile.transactionDate = response.transactionDate; updatedFields.push("Date de transaction"); }
    if (response.email?.trim()) updatedFields.push("Courriel");
    if (response.phone?.trim()) updatedFields.push("Téléphone");
    if (response.projectType?.trim()) { profile.projectType = response.projectType.trim(); updatedFields.push("Type de projet"); }
    if (response.communicationConsent) {
      profile.communicationConsent = response.communicationConsent === "yes";
      profile.communicationConsentAnsweredAt = now;
      updatedFields.push("Consentement de communication");
    }
    if (response.interests?.length) { profile.interests = response.interests; updatedFields.push("Intérêts immobiliers"); }

    profile.lastDataResponseAt = now;
    profile.missingInformation = profile.missingInformation.filter((label) => !updatedFields.includes(label));
    profile.automationEligible = eligibility(profile);
    return {
      ...current,
      email: response.email?.trim() || current.email,
      phone: response.phone?.trim() || current.phone,
      address: response.address?.trim() || current.address,
      importProfile: profile,
      nextAction: getMissingDataFields({ ...current, address: response.address?.trim() || current.address, importProfile: profile }).length ? "Compléter la fiche client" : "Planifier le prochain suivi relationnel",
      history: [{
        id: `history-data-response-${Date.now()}`,
        date: now,
        title: "Informations client reçues",
        description: `Lien sécurisé complété. Fiche mise à jour : ${updatedFields.join(", ") || "aucun champ"}.`,
        type: "status",
      }, ...current.history],
    };
  });

  const next = requests.map((item) => item.id === request.id ? {
    ...item,
    status: "complétée" as const,
    respondedAt: now,
    responseCount: item.responseCount + 1,
    updatedFields,
  } : item);
  saveRequests(next);
  syncClientAutomations(getSoniaProspects());
  return { updatedFields };
}

export function getCollectionSummary(contacts = getSoniaProspects(), requests = getCollectionRequests()) {
  return (Object.keys(MISSING_DATA_LABELS) as MissingDataField[]).map((field) => {
    const relevant = requests.filter((request) => request.fields.includes(field));
    const campaign = buildCampaign(field);
    return {
      field,
      label: MISSING_DATA_LABELS[field],
      missing: contacts.filter((contact) => !contact.id.startsWith("sonia-demo-") && getMissingDataFields(contact).includes(field)).length,
      prepared: relevant.filter((request) => request.status === "préparée").length,
      responses: relevant.reduce((total, request) => total + request.responseCount, 0),
      updated: relevant.filter((request) => request.status === "complétée").length,
      excluded: relevant.filter((request) => request.status === "exclue").length,
      latestLink: relevant.filter((request) => request.status === "préparée").at(-1)?.link,
      latestMessage: relevant.at(-1)?.message || campaign.message,
      campaign,
    };
  });
}

export function getClientDatabaseHealth(contacts = getSoniaProspects()) {
  const clients = contacts.filter((contact) => !contact.id.startsWith("sonia-demo-"));
  const total = clients.length;
  const percentage = (predicate: (contact: SoniaProspect) => boolean) => total ? Math.round((clients.filter(predicate).length / total) * 100) : 0;
  const metrics = {
    complete: percentage((contact) => Boolean(contact.name && (contact.email || contact.phone) && contact.address && contact.importProfile?.relationshipType)),
    emails: percentage((contact) => Boolean(contact.email)),
    phones: percentage((contact) => Boolean(contact.phone)),
    consents: percentage((contact) => Boolean(contact.importProfile?.communicationConsent)),
    mortgageRenewals: percentage((contact) => Boolean(contact.importProfile?.mortgageRenewalDate)),
    birthDates: percentage((contact) => Boolean(contact.importProfile?.birthDate)),
    transactionDates: percentage((contact) => Boolean(contact.importProfile?.transactionDate)),
  };
  return { total, metrics };
}

export function getWorkspaceDeletionSummary() {
  const contacts = getSoniaProspects().filter((contact) => !contact.id.startsWith("sonia-demo-"));
  const automations = readStoredArray(AUTOMATIONS_KEY).length;
  const requests = readStoredArray(REQUESTS_KEY);
  const importIndex = readStoredArray(IMPORT_INDEX_KEY);
  const histories = contacts.reduce((total, contact) => total + contact.history.length, 0);
  const followUps = contacts.reduce((total, contact) => total
    + contact.history.filter((event) => event.type === "task" || event.type === "call").length
    + (/relance|rappeler|suivi/i.test(contact.nextAction) ? 1 : 0), 0);
  return {
    clients: contacts.length,
    automations,
    followUps,
    histories,
    duplicates: importIndex.length,
    campaigns: requests.length,
  };
}

export function isClientDatabaseReset() {
  return typeof window !== "undefined" && window.localStorage.getItem(RESET_MARKER_KEY) === "true";
}

export function clearAllClientWorkspaceData() {
  if (typeof window === "undefined") {
    return { clients: 0, automations: 0, followUps: 0, histories: 0, duplicates: 0, campaigns: 0 };
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && isClientDataKey(key)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));

  const sessionKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key && isClientDataKey(key)) sessionKeys.push(key);
  }
  sessionKeys.forEach((key) => window.sessionStorage.removeItem(key));

  window.localStorage.setItem(PROSPECTS_KEY, "[]");
  window.localStorage.setItem(AUTOMATIONS_KEY, "[]");
  window.localStorage.setItem(REQUESTS_KEY, "[]");
  window.localStorage.setItem(IMPORT_INDEX_KEY, "[]");
  window.localStorage.setItem(RESET_MARKER_KEY, "true");
  saveSoniaProspects([]);

  return getWorkspaceDeletionSummary();
}

function isClientDataKey(key: string) {
  const normalized = key.toLowerCase();
  if (/radar|quota|setting|parametre|paramètre|preference|préférence|config|automation_mode/.test(normalized)) return false;
  return normalized === PROSPECTS_KEY
    || normalized === AUTOMATIONS_KEY
    || normalized === REQUESTS_KEY
    || normalized === IMPORT_INDEX_KEY
    || normalized.startsWith("iacourtier_client_")
    || normalized.startsWith("iacourtier_sonia_beta_")
    || normalized.startsWith("iacourtier_prospect")
    || normalized.startsWith("iacourtier_contact")
    || normalized.startsWith("iacourtier_pipeline_")
    || normalized.startsWith("iacourtier_duplicate")
    || normalized.startsWith("iacourtier_search_")
    || normalized.startsWith("iacourtier_campaign");
}

function readStoredArray(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildCampaign(field: MissingDataField) {
  if (field === "mortgageRenewal") {
    return {
      subject: "Mise à jour de votre dossier — renouvellement hypothécaire",
      email: "Mise à jour du dossier client",
      message: "Bonjour Marie,\n\nJe mets actuellement mes dossiers clients à jour afin de pouvoir mieux vous accompagner.\n\nPeux-tu simplement me dire à quel moment ton hypothèque arrive à renouvellement ?\n\nCela me permettra de te transmettre les bonnes informations au bon moment.\n\nAucune obligation.\n\nMerci !",
      question: "À quel mois et en quelle année votre hypothèque arrive-t-elle à renouvellement?",
    };
  }
  const label = MISSING_DATA_LABELS[field].toLowerCase();
  return {
    subject: `Mise à jour de votre dossier — ${label}`,
    email: "Mise à jour du dossier client",
    message: `Bonjour,\n\nJe mets actuellement mes dossiers clients à jour et il me manque une information : ${label}. Ce court formulaire me permettra de mieux vous accompagner au bon moment, sans pression.\n\nMerci!`,
    question: `Pouvez-vous nous indiquer : ${label}?`,
  };
}

function buildCollectionMessage(contact: SoniaProspect, field: MissingDataField) {
  const campaign = buildCampaign(field);
  const generated = generateClientCommunication({
    clientType: contact.clientType === "seller" ? "vendeur" : "acheteur",
    journeyStage: "mise à jour du dossier client",
    channel: contact.email ? "courriel" : "texto",
    objective: campaign.question,
    warmth: "tiède",
    context: { clientName: contact.name, topic: MISSING_DATA_LABELS[field].toLowerCase() },
    tone: "rassurant",
    length: "courte",
  });
  return `${campaign.message.replace("Marie", firstName(contact.name))}\n\n${generated.shortVersion}`;
}

function eligibility(profile: ClientImportProfile) {
  return [
    profile.communicationConsent ? "Communications relationnelles" : "",
    profile.mortgageRenewalDate ? "Suivi hypothécaire" : "",
    profile.transactionDate ? "Suivi post-transaction" : "",
  ].filter(Boolean);
}
function saveRequests(requests: CollectionRequest[]) { window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests)); }
function firstName(name: string) { return name.trim().split(/\s+/)[0] || "Bonjour"; }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function createSecureToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeTokenEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
