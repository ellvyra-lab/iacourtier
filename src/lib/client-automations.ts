import { generateClientCommunication } from "@/lib/client-communication/engine";
import { getSoniaProspects, updateSoniaProspect } from "@/lib/sonia-beta/storage";
import type { SoniaProspect } from "@/lib/sonia-beta/types";

export type AutomationMode = "disabled" | "approval" | "automatic";
export type AutomationStatus = "brouillon" | "planifiée" | "prête" | "envoyée" | "échouée" | "annulée" | "ignorée";
export type AutomationType = "mortgage" | "birthday" | "transaction-anniversary" | "quarterly-report" | "relationship-followup" | "referral" | "review";
export type AutomationEmployee = "Employé IA Hypothèque" | "Employé IA Relation client" | "Employé IA Référencement" | "Employé IA Suivi post-transaction" | "Employé IA Marketing";

export type AutomationHistoryEvent = {
  at: string;
  action: string;
};

export type ClientAutomation = {
  id: string;
  dedupeKey: string;
  clientId: string;
  clientName: string;
  type: AutomationType;
  employee: AutomationEmployee;
  channel: "courriel" | "texto";
  scheduledFor: string;
  period: string;
  message: string;
  shortMessage: string;
  followUpQuestion: string;
  nextAction: string;
  status: AutomationStatus;
  reason: string;
  task?: string;
  clientHref: string;
  createdAt: string;
  updatedAt: string;
  history: AutomationHistoryEvent[];
};

export type AutomationSummary = {
  upcoming: number;
  ready: number;
  overdue: number;
  sent: number;
  errors: number;
  incompleteContacts: number;
  blockedByConsent: number;
  mortgageWithin90Days: number;
  humanInterventions: number;
};

type Candidate = Omit<ClientAutomation, "id" | "dedupeKey" | "message" | "shortMessage" | "followUpQuestion" | "nextAction" | "status" | "createdAt" | "updatedAt" | "history" | "clientName" | "clientHref" | "channel"> & {
  scheduledFor: string;
  period: string;
  objective: string;
  opening: string;
  task?: string;
};

const AUTOMATIONS_KEY = "iacourtier_client_automations";
const MODE_KEY = "iacourtier_automation_mode";

export const AUTOMATION_TYPE_LABELS: Record<AutomationType, string> = {
  mortgage: "Hypothèque",
  birthday: "Bonne fête",
  "transaction-anniversary": "Anniversaire de transaction",
  "quarterly-report": "Rapport trimestriel",
  "relationship-followup": "Relance relationnelle",
  referral: "Référence",
  review: "Avis",
};

export function getAutomationMode(): AutomationMode {
  if (typeof window === "undefined") return "approval";
  const value = window.localStorage.getItem(MODE_KEY);
  return value === "disabled" || value === "automatic" ? value : "approval";
}

export function setAutomationMode(mode: AutomationMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
}

export function getClientAutomations(): ClientAutomation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTOMATIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClientAutomations(automations: ClientAutomation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(automations));
}

export function syncClientAutomations(contacts = getSoniaProspects(), mode = getAutomationMode()) {
  const existing = getClientAutomations();
  if (mode === "disabled") return existing;

  const keys = new Set(existing.map((automation) => automation.dedupeKey));
  const created: ClientAutomation[] = [];

  contacts.filter((contact) => !contact.id.startsWith("sonia-demo-")).forEach((contact) => {
    if (!canCommunicate(contact)) return;
    buildCandidates(contact).forEach((candidate) => {
      const dedupeKey = [contact.id, candidate.type, candidate.period, candidate.scheduledFor.slice(0, 10)].join("|");
      if (keys.has(dedupeKey)) return;
      keys.add(dedupeKey);
      created.push(materialize(contact, candidate, dedupeKey, mode));
    });
  });

  const next = [...existing, ...created].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  saveClientAutomations(next);
  created.forEach((automation) => appendClientHistory(automation.clientId, `Automatisation créée : ${AUTOMATION_TYPE_LABELS[automation.type]}`, `Prévue le ${formatDate(automation.scheduledFor)} · Statut : ${automation.status}. Aucun envoi externe effectué.`));
  return next;
}

export function updateClientAutomation(id: string, changes: Partial<Pick<ClientAutomation, "message" | "scheduledFor" | "status">>) {
  const automations = getClientAutomations();
  let updated: ClientAutomation | undefined;
  const next = automations.map((automation) => {
    if (automation.id !== id) return automation;
    const action = changes.status === "annulée" ? "Annulation" : changes.status === "ignorée" ? "Automatisation ignorée" : changes.status === "planifiée" ? "Réactivation" : "Modification";
    updated = {
      ...automation,
      ...changes,
      updatedAt: new Date().toISOString(),
      history: [...automation.history, { at: new Date().toISOString(), action }],
    };
    return updated;
  });
  saveClientAutomations(next);
  if (updated) appendClientHistory(updated.clientId, `Automatisation : ${AUTOMATION_TYPE_LABELS[updated.type]}`, `${updated.history.at(-1)?.action}. Date prévue : ${formatDate(updated.scheduledFor)} · Statut : ${updated.status}.`);
  return updated;
}

export function getAutomationSummary(automations = getClientAutomations(), contacts = getSoniaProspects()): AutomationSummary {
  const today = dateKey(new Date());
  const active = automations.filter((item) => !["annulée", "ignorée"].includes(item.status));
  const realContacts = contacts.filter((contact) => !contact.id.startsWith("sonia-demo-"));
  return {
    upcoming: active.filter((item) => item.scheduledFor.slice(0, 10) > today && item.status === "planifiée").length,
    ready: active.filter((item) => item.status === "prête").length,
    overdue: active.filter((item) => item.scheduledFor.slice(0, 10) < today && item.status !== "envoyée").length,
    sent: automations.filter((item) => item.status === "envoyée").length,
    errors: automations.filter((item) => item.status === "échouée").length,
    incompleteContacts: realContacts.filter((contact) => contact.importProfile?.missingInformation.length).length,
    blockedByConsent: realContacts.filter((contact) => !canCommunicate(contact)).length,
    mortgageWithin90Days: realContacts.filter((contact) => {
      const renewal = parseDate(contact.importProfile?.mortgageRenewalDate);
      if (!renewal) return false;
      const days = differenceInDays(renewal, new Date());
      return days >= 0 && days <= 90;
    }).length,
    humanInterventions: active.filter((item) => Boolean(item.task) || item.status === "prête").length,
  };
}

export function getCommunicationBlockReason(contact: SoniaProspect) {
  if (/ne plus (me )?contacter|do not contact|désabonn|desabonn|plainte|insatisfaction/i.test(contact.notes)) return "Contact exclu des communications";
  if (!contact.importProfile?.communicationConsent) return "Consentement requis";
  if (!contact.email && !contact.phone) return "Canal autorisé manquant";
  return null;
}

function canCommunicate(contact: SoniaProspect) {
  return !getCommunicationBlockReason(contact);
}

function buildCandidates(contact: SoniaProspect): Candidate[] {
  const candidates: Candidate[] = [];
  const profile = contact.importProfile;
  if (!profile) return candidates;
  const now = new Date();

  const renewal = parseDate(profile.mortgageRenewalDate);
  if (renewal) {
    [
      { months: 12, period: "12m", opening: "Votre renouvellement hypothécaire approche dans la prochaine année.", objective: "Expliquer l'avantage d'analyser tôt les options et proposer une discussion avec un partenaire hypothécaire.", task: undefined },
      { months: 6, period: "6m", opening: "Votre renouvellement hypothécaire arrive dans environ six mois.", objective: "Faire un rappel direct et proposer une mise en contact hypothécaire.", task: "Faire un suivi hypothécaire" },
      { months: 3, period: "3m", opening: "Votre renouvellement hypothécaire est maintenant à moins de trois mois.", objective: "Préparer une communication prioritaire et proposer un court appel.", task: "Appeler le client en priorité" },
      { days: 30, period: "30d", opening: "Votre renouvellement hypothécaire est prévu dans environ trente jours.", objective: "Faire une dernière relance utile et proposer une intervention rapide.", task: "Alerte prioritaire dans le Coach IA" },
    ].forEach((rule) => {
      if (!rule) return;
      candidates.push({
        clientId: contact.id,
        type: "mortgage",
        employee: "Employé IA Hypothèque",
        scheduledFor: toIso("months" in rule && rule.months ? addMonths(renewal, -rule.months) : addDays(renewal, -("days" in rule ? rule.days : 0)), 9),
        period: `${renewal.getFullYear()}-${rule.period}`,
        objective: rule.objective,
        opening: rule.opening,
        reason: `Renouvellement prévu le ${formatDate(renewal.toISOString())} · jalon ${rule.period}.`,
        task: rule.task,
      });
    });
  }

  const birth = parseDate(profile.birthDate);
  if (birth) {
    const nextBirthday = nextAnnualDate(birth, now);
    candidates.push({
      clientId: contact.id, type: "birthday", employee: "Employé IA Relation client",
      scheduledFor: toIso(nextBirthday, 9), period: String(nextBirthday.getFullYear()),
      objective: "Souhaiter une bonne fête de façon personnelle, naturelle et non promotionnelle.",
      opening: `Bonne fête ${firstName(contact.name)}! Je vous souhaite une très belle journée et une année remplie de beaux projets.`,
      reason: "Date de naissance présente à la fiche.",
    });
  }

  const transaction = parseDate(profile.transactionDate);
  if (transaction) {
    const anniversary = nextAnnualDate(transaction, now);
    candidates.push({
      clientId: contact.id, type: "transaction-anniversary", employee: "Employé IA Suivi post-transaction",
      scheduledFor: toIso(anniversary, 10), period: String(anniversary.getFullYear()),
      objective: "Souligner l'anniversaire de transaction, rappeler la disponibilité du courtier et proposer une mise à jour de valeur.",
      opening: "C'est déjà l'anniversaire de votre transaction immobilière. J'espère que votre propriété répond toujours aussi bien à vos projets.",
      reason: `Transaction inscrite le ${formatDate(transaction.toISOString())}.`,
    });

    const satisfactionDate = addDays(transaction, 30);
    candidates.push({
      clientId: contact.id, type: "referral", employee: "Employé IA Référencement",
      scheduledFor: toIso(satisfactionDate, 10), period: `${dateKey(transaction)}-satisfaction`,
      objective: "Faire un suivi de satisfaction trente jours après la transaction, sans demander immédiatement une référence.",
      opening: "Un mois s'est écoulé depuis votre transaction et je voulais simplement vérifier comment les choses se passent.",
      reason: "Suivi de satisfaction prévu 30 jours après la transaction.",
    });

    if (!/plainte|insatisfaction|probl[eè]me/i.test(contact.notes)) {
      candidates.push({
        clientId: contact.id, type: "referral", employee: "Employé IA Référencement",
        scheduledFor: toIso(addDays(transaction, 90), 10), period: `${dateKey(transaction)}-reference`,
        objective: "Demander une référence de façon naturelle, seulement si l'expérience client est positive.",
        opening: "Je suis heureux d'avoir pu vous accompagner et je voulais prendre de vos nouvelles.",
        reason: "Demande de référence admissible 90 jours après une transaction sans insatisfaction connue.",
      });
      candidates.push({
        clientId: contact.id, type: "review", employee: "Employé IA Référencement",
        scheduledFor: toIso(addDays(transaction, 45), 10), period: `${dateKey(transaction)}-avis`,
        objective: "Préparer une demande d'avis sobre, sans publication automatique.",
        opening: "Votre retour d'expérience m'aide à améliorer mon accompagnement et à guider d'autres clients.",
        reason: "Demande d'avis préparée après la transaction; publication soumise à confirmation future.",
      });
    }
  }

  const owner = ["seller", "both", "investor", "former"].includes(profile.relationshipType);
  if (owner) {
    const quarter = nextQuarterDate(now);
    candidates.push({
      clientId: contact.id, type: "quarterly-report", employee: "Employé IA Marketing",
      scheduledFor: toIso(quarter, 9), period: `${quarter.getFullYear()}-Q${Math.floor(quarter.getMonth() / 3) + 1}`,
      objective: "Présenter l'évolution du marché, la valeur potentielle et les options de vendre, refinancer, investir ou réduire l'hypothèque, puis proposer une analyse personnalisée.",
      opening: "Voici votre point immobilier trimestriel : le marché et les propriétés comparables ont évolué depuis notre dernier bilan.",
      reason: "Client propriétaire admissible au rapport immobilier trimestriel.",
    });
  }

  const lastContact = parseDate(profile.lastContact) || parseDate(contact.updatedAt);
  if (lastContact) {
    const daysWithoutContact = differenceInDays(now, lastContact);
    if (daysWithoutContact >= 90) candidates.push({
      clientId: contact.id, type: "relationship-followup", employee: "Employé IA Relation client",
      scheduledFor: toIso(addDays(lastContact, 90), 10), period: `${dateKey(lastContact)}-90d`,
      objective: "Faire une relance relationnelle douce et demander comment évoluent les projets du client.",
      opening: "Ça fait un petit moment qu'on n'a pas échangé et je voulais simplement prendre de vos nouvelles.",
      reason: `Aucun contact depuis ${daysWithoutContact} jours.`,
    });
    if (daysWithoutContact >= 180) candidates.push({
      clientId: contact.id, type: "relationship-followup", employee: "Employé IA Relation client",
      scheduledFor: toIso(addDays(lastContact, 180), 10), period: `${dateKey(lastContact)}-180d`,
      objective: "Proposer un bilan immobilier structuré et une courte conversation sans pression.",
      opening: "Comme plusieurs mois se sont écoulés depuis notre dernier échange, un bref bilan immobilier pourrait vous aider à situer vos options.",
      reason: `Aucun contact depuis ${daysWithoutContact} jours; intervention humaine recommandée.`,
      task: "Appeler pour proposer un bilan immobilier",
    });
  }

  return candidates;
}

function materialize(contact: SoniaProspect, candidate: Candidate, dedupeKey: string, mode: AutomationMode): ClientAutomation {
  const channel = contact.email ? "courriel" : "texto";
  const generated = generateClientCommunication({
    clientType: contact.clientType === "seller" ? "vendeur" : "acheteur",
    journeyStage: candidate.type,
    channel,
    objective: candidate.objective,
    warmth: "tiède",
    context: { clientName: contact.name, topic: candidate.objective, propertyAddress: contact.address || undefined },
    tone: candidate.type === "mortgage" ? "stratégique" : "chaleureux",
    length: "standard",
  });
  const today = dateKey(new Date());
  const due = candidate.scheduledFor.slice(0, 10) <= today;
  const status: AutomationStatus = due ? "prête" : "planifiée";
  const now = new Date().toISOString();
  return {
    ...candidate,
    id: `automation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dedupeKey,
    clientName: contact.name,
    clientHref: `/tableau-de-bord/prospects/${encodeURIComponent(contact.id)}`,
    channel,
    message: `${candidate.opening} ${generated.mainMessage}`,
    shortMessage: generated.shortVersion,
    followUpQuestion: generated.followUpQuestion,
    nextAction: candidate.task || generated.recommendedNextAction,
    status,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, action: `Créée par ${candidate.employee} · futur envoi non connecté` }],
  };
}

function appendClientHistory(clientId: string, title: string, description: string) {
  updateSoniaProspect(clientId, (contact) => ({
    ...contact,
    history: [{
      id: `history-automation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      title,
      description,
      type: "ai",
    }, ...contact.history],
  }));
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function addMonths(date: Date, months: number) { const next = new Date(date); next.setMonth(next.getMonth() + months); return next; }
function differenceInDays(later: Date, earlier: Date) { return Math.floor((later.getTime() - earlier.getTime()) / 86400000); }
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function toIso(date: Date, hour: number) { const next = new Date(date); next.setHours(hour, 0, 0, 0); return next.toISOString(); }
function nextAnnualDate(original: Date, now: Date) { const next = new Date(now.getFullYear(), original.getMonth(), original.getDate()); if (next < now) next.setFullYear(next.getFullYear() + 1); return next; }
function nextQuarterDate(now: Date) { const month = Math.floor(now.getMonth() / 3) * 3 + 3; return new Date(now.getFullYear(), month, 1); }
function firstName(name: string) { return name.trim().split(/\s+/)[0] || ""; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("fr-CA"); }
