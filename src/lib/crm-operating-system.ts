export type CrmPipelineType = "buyer" | "seller" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";

export type CrmRequirementKey =
  | "client_identity"
  | "client_contact"
  | "property"
  | "evaluation"
  | "mandate"
  | "listing_assets"
  | "marketing_plan"
  | "prequalification"
  | "buyer_contract"
  | "buyer_criteria"
  | "offer"
  | "conditions"
  | "notary"
  | "transaction_closed";

export type CrmStageDefinition = {
  id: string;
  label: string;
  nextAction: string;
  requirements: CrmRequirementKey[];
  taskTemplates: string[];
};

export type CrmCaseSnapshot = {
  caseType: CrmPipelineType;
  currentStage: string;
  clients: Array<{ firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }>;
  hasProperty: boolean;
  documentCategories: string[];
  openTasks: Array<{ title: string; dueAt?: string | null; category?: string | null }>;
  pendingConflicts: number;
  hasFinancing: boolean;
  hasBuyerContract: boolean;
  hasBuyerCriteria: boolean;
  hasEvaluation: boolean;
  hasMandate: boolean;
  hasListingAssets: boolean;
  hasMarketingPlan: boolean;
  hasOffer: boolean;
  conditionsSatisfied: boolean;
  hasNotaryAppointment: boolean;
  transactionClosed: boolean;
  lastActivityAt?: string | null;
};

export type CrmRequirementStatus = {
  key: CrmRequirementKey;
  label: string;
  status: "complete" | "missing";
  requiredForStage: string;
};

export type CrmOperatingState = {
  pipelineType: CrmPipelineType;
  currentStage: string;
  stageLabel: string;
  pipelineProgress: number;
  completionScore: number;
  healthScore: number;
  priorityScore: number;
  nextAction: string;
  nextActionReason: string;
  requirements: CrmRequirementStatus[];
};

const SELLER_STAGES: CrmStageDefinition[] = [
  stage("new_seller_lead", "Nouveau prospect vendeur", "Établir le premier contact", ["client_identity", "client_contact"], ["Contacter le prospect vendeur"]),
  stage("contact_established", "Contact établi", "Qualifier le projet vendeur", ["client_identity", "client_contact"], ["Qualifier le projet vendeur"]),
  stage("evaluation_appointment", "Rendez-vous d’évaluation", "Préparer le rendez-vous d’évaluation", ["property"], ["Préparer le rendez-vous d’évaluation"]),
  stage("evaluation_completed", "Évaluation réalisée", "Présenter l’évaluation et la stratégie", ["property", "evaluation"], ["Présenter l’évaluation au vendeur"]),
  stage("mandate_to_obtain", "Mandat à obtenir", "Faire signer le contrat de courtage", ["property", "evaluation", "mandate"], ["Faire signer le contrat de courtage"]),
  stage("mandate_signed", "Mandat signé", "Préparer l’inscription et les documents", ["property", "mandate"], ["Vérifier les documents obligatoires"]),
  stage("listing_preparation", "Préparation de l’inscription", "Compléter les photos, mesures et textes", ["property", "mandate", "listing_assets"], ["Préparer les actifs de l’inscription"]),
  stage("ready_for_marketing", "Prêt pour la mise en marché", "Valider le plan de mise en marché", ["listing_assets", "marketing_plan"], ["Valider le plan de mise en marché"]),
  stage("on_market", "Sur le marché", "Suivre les visites et la rétroaction", ["marketing_plan"], ["Faire le suivi des visites"]),
  stage("offer_received", "Offre reçue", "Analyser l’offre avec les vendeurs", ["offer"], ["Analyser l’offre reçue"]),
  stage("offer_accepted", "Offre acceptée", "Planifier le suivi des conditions", ["offer"], ["Planifier le suivi des conditions"]),
  stage("conditions_satisfied", "Conditions réalisées", "Préparer le dossier pour le notaire", ["offer", "conditions"], ["Préparer le dossier pour le notaire"]),
  stage("sold", "Vendu", "Confirmer la clôture de la transaction", ["conditions", "notary", "transaction_closed"], ["Confirmer la clôture de la transaction"]),
  stage("post_sale", "Après-vente", "Planifier le suivi après-vente", ["transaction_closed"], ["Planifier le suivi après-vente"]),
];

const BUYER_STAGES: CrmStageDefinition[] = [
  stage("new_buyer_lead", "Nouveau prospect acheteur", "Établir le premier contact", ["client_identity", "client_contact"], ["Contacter le prospect acheteur"]),
  stage("contact_established", "Contact établi", "Qualifier le projet acheteur", ["client_identity", "client_contact"], ["Qualifier le projet acheteur"]),
  stage("qualification", "Qualification", "Valider la capacité financière", ["client_identity", "client_contact"], ["Compléter la qualification acheteur"]),
  stage("prequalification", "Préqualification", "Obtenir ou valider la préqualification", ["prequalification"], ["Obtenir la préqualification hypothécaire"]),
  stage("buyer_brokerage_contract", "Contrat de courtage achat", "Faire signer le contrat de courtage achat", ["prequalification", "buyer_contract"], ["Faire signer le contrat de courtage achat"]),
  stage("criteria_complete", "Critères complets", "Démarrer la recherche active", ["buyer_contract", "buyer_criteria"], ["Confirmer les critères de recherche"]),
  stage("active_search", "Recherche active", "Proposer les meilleures propriétés", ["buyer_criteria"], ["Proposer des propriétés pertinentes"]),
  stage("visits", "Visites", "Planifier et documenter la prochaine visite", ["buyer_criteria"], ["Planifier la prochaine visite"]),
  stage("offer_preparation", "Préparation d’offre", "Préparer la promesse d’achat", ["property", "prequalification"], ["Préparer la promesse d’achat"]),
  stage("offer_submitted", "Offre déposée", "Suivre la réponse à l’offre", ["offer"], ["Suivre la réponse à l’offre"]),
  stage("offer_accepted", "Offre acceptée", "Planifier l’inspection, le financement et les conditions", ["offer"], ["Planifier les conditions de l’offre"]),
  stage("conditions", "Inspection, financement et conditions", "Suivre toutes les échéances de conditions", ["offer"], ["Suivre les échéances des conditions"]),
  stage("conditions_satisfied", "Conditions réalisées", "Préparer le rendez-vous chez le notaire", ["conditions"], ["Préparer le rendez-vous chez le notaire"]),
  stage("notary", "Notaire", "Confirmer les documents et le rendez-vous", ["conditions", "notary"], ["Confirmer le rendez-vous chez le notaire"]),
  stage("purchase_completed", "Achat complété", "Confirmer la clôture de la transaction", ["notary", "transaction_closed"], ["Confirmer la clôture de la transaction"]),
  stage("post_sale", "Après-vente", "Planifier le suivi après-vente", ["transaction_closed"], ["Planifier le suivi après-vente"]),
];

const REQUIREMENT_LABELS: Record<CrmRequirementKey, string> = {
  client_identity: "Identité du client",
  client_contact: "Téléphone ou courriel",
  property: "Propriété du dossier",
  evaluation: "Évaluation de la propriété",
  mandate: "Contrat de courtage vendeur",
  listing_assets: "Photos, mesures et actifs d’inscription",
  marketing_plan: "Plan de mise en marché",
  prequalification: "Préqualification hypothécaire",
  buyer_contract: "Contrat de courtage achat",
  buyer_criteria: "Critères de recherche",
  offer: "Promesse d’achat ou offre",
  conditions: "Conditions réalisées",
  notary: "Rendez-vous ou documents du notaire",
  transaction_closed: "Transaction clôturée",
};

const SELLER_ALIASES: Record<string, string> = {
  lead: "new_seller_lead", new_prospect: "new_seller_lead", qualification: "contact_established",
  appointment: "evaluation_appointment", evaluation: "evaluation_completed", mandate: "mandate_to_obtain",
  preparation: "listing_preparation", marketing: "on_market", visits: "on_market",
  conditions: "offer_accepted", notary: "conditions_satisfied", transaction_completed: "sold",
  completed: "sold", post_transaction: "post_sale",
};

const BUYER_ALIASES: Record<string, string> = {
  new_contact: "new_buyer_lead", financing: "prequalification", representation_agreement: "buyer_brokerage_contract",
  criteria_defined: "criteria_complete", offer: "offer_submitted", completed: "purchase_completed",
  post_transaction: "post_sale",
};

export function crmPipelineStages(type: CrmPipelineType) {
  if (type === "seller") return SELLER_STAGES;
  if (type === "buyer") return BUYER_STAGES;
  if (type === "buy_sell") return BUYER_STAGES;
  return BUYER_STAGES.slice(0, 3);
}

export function canonicalCrmStage(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type);
  const requested = String(value || "").trim();
  if (stages.some((item) => item.id === requested)) return requested;
  const alias = type === "seller" ? SELLER_ALIASES[requested] : BUYER_ALIASES[requested];
  return alias || stages[0].id;
}

export function pipelineProgress(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type);
  const current = canonicalCrmStage(type, value);
  const index = Math.max(0, stages.findIndex((item) => item.id === current));
  return Math.round(((index + 1) / stages.length) * 100);
}

export function stageDefinition(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type);
  const current = canonicalCrmStage(type, value);
  return stages.find((item) => item.id === current) || stages[0];
}

export function computeCrmOperatingState(snapshot: CrmCaseSnapshot, now = new Date()): CrmOperatingState {
  const pipelineType = snapshot.caseType;
  const stages = crmPipelineStages(pipelineType);
  const currentStage = canonicalCrmStage(pipelineType, snapshot.currentStage);
  const stageIndex = Math.max(0, stages.findIndex((item) => item.id === currentStage));
  const requiredThroughCurrent = new Map<CrmRequirementKey, string>();
  stages.slice(0, stageIndex + 1).forEach((item) => item.requirements.forEach((key) => requiredThroughCurrent.set(key, item.id)));
  const requirements = [...requiredThroughCurrent.entries()].map(([key, requiredForStage]) => ({
    key,
    label: REQUIREMENT_LABELS[key],
    status: requirementIsComplete(key, snapshot) ? "complete" as const : "missing" as const,
    requiredForStage,
  }));
  const completionScore = requirements.length
    ? Math.round((requirements.filter((item) => item.status === "complete").length / requirements.length) * 100)
    : 100;
  const overdue = snapshot.openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
  const inactivityDays = snapshot.lastActivityAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(snapshot.lastActivityAt).getTime()) / 86_400_000))
    : 0;
  const healthScore = clamp(100 - overdue.length * 12 - snapshot.pendingConflicts * 8 - Math.max(0, inactivityDays - 14), 0, 100);
  const closingStage = stageIndex >= Math.max(0, stages.length - 5);
  const priorityScore = clamp(20 + overdue.length * 18 + snapshot.pendingConflicts * 6 + (closingStage ? 20 : 0) + Math.min(20, Math.max(0, inactivityDays - 7)), 0, 100);
  const firstMissing = requirements.find((item) => item.status === "missing");
  const current = stages[stageIndex];
  const nextAction = overdue[0]?.title
    || (snapshot.pendingConflicts ? "Vérifier les informations contradictoires" : "")
    || (firstMissing ? `Compléter : ${firstMissing.label}` : "")
    || current.nextAction;
  const nextActionReason = overdue.length
    ? `${overdue.length} tâche${overdue.length > 1 ? "s" : ""} en retard`
    : snapshot.pendingConflicts
      ? `${snapshot.pendingConflicts} information${snapshot.pendingConflicts > 1 ? "s" : ""} à vérifier`
      : firstMissing
        ? `Requis pour l’étape ${stageLabel(stages, firstMissing.requiredForStage)}`
        : `Prochaine action recommandée pour ${current.label}`;
  return {
    pipelineType,
    currentStage,
    stageLabel: current.label,
    pipelineProgress: pipelineProgress(pipelineType, currentStage),
    completionScore,
    healthScore,
    priorityScore,
    nextAction,
    nextActionReason,
    requirements,
  };
}

export function scoreCentralClientMatch(
  incoming: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; address?: string | null },
  existing: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; address?: string | null },
) {
  const reasons: string[] = [];
  let score = 0;
  const email = normalize(incoming.email);
  const phone = digits(incoming.phone);
  const name = normalize(`${incoming.firstName || ""}${incoming.lastName || ""}`);
  const address = normalize(incoming.address);
  if (email && email === normalize(existing.email)) { score = Math.max(score, 100); reasons.push("courriel exact"); }
  if (phone && phone === digits(existing.phone)) { score = Math.max(score, 96); reasons.push("téléphone normalisé"); }
  if (name && name === normalize(`${existing.firstName || ""}${existing.lastName || ""}`)) {
    if (address && address === normalize(existing.address)) { score = Math.max(score, 92); reasons.push("nom et adresse"); }
    else { score = Math.max(score, 65); reasons.push("prénom et nom"); }
  }
  return { score, confidence: score >= 90 ? "certain" as const : score >= 60 ? "ambiguous" as const : "none" as const, reasons };
}

function requirementIsComplete(key: CrmRequirementKey, snapshot: CrmCaseSnapshot) {
  const categories = snapshot.documentCategories.map(normalize);
  const hasDocument = (...patterns: RegExp[]) => categories.some((value) => patterns.some((pattern) => pattern.test(value)));
  switch (key) {
    case "client_identity": return snapshot.clients.length > 0 && snapshot.clients.every((client) => Boolean(client.firstName || client.lastName));
    case "client_contact": return snapshot.clients.length > 0 && snapshot.clients.every((client) => Boolean(client.email || client.phone));
    case "property": return snapshot.hasProperty;
    case "evaluation": return snapshot.hasEvaluation || hasDocument(/evaluation/, /analyse comparative/, /acm/);
    case "mandate": return snapshot.hasMandate || hasDocument(/contrat de courtage/, /mandat/);
    case "listing_assets": return snapshot.hasListingAssets || hasDocument(/photo/, /certificat de localisation/, /mesure/);
    case "marketing_plan": return snapshot.hasMarketingPlan;
    case "prequalification": return snapshot.hasFinancing || hasDocument(/preapprobation/, /prequalification/);
    case "buyer_contract": return snapshot.hasBuyerContract || hasDocument(/contrat de courtage achat/, /cca/);
    case "buyer_criteria": return snapshot.hasBuyerCriteria;
    case "offer": return snapshot.hasOffer || hasDocument(/promesse d achat/, /offre/);
    case "conditions": return snapshot.conditionsSatisfied;
    case "notary": return snapshot.hasNotaryAppointment || hasDocument(/notaire/);
    case "transaction_closed": return snapshot.transactionClosed;
  }
}

function stage(id: string, label: string, nextAction: string, requirements: CrmRequirementKey[], taskTemplates: string[]): CrmStageDefinition {
  return { id, label, nextAction, requirements, taskTemplates };
}

function stageLabel(stages: CrmStageDefinition[], id: string) { return stages.find((item) => item.id === id)?.label || id; }
function normalize(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase(); }
function digits(value?: string | null) { return String(value || "").replace(/\D/g, ""); }
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, Math.round(value))); }

