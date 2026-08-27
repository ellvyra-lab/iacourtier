export type CrmPipelineType = "buyer" | "seller" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";
export type CrmPipelineMode = "automatic" | "assisted" | "manual";
export type CrmPriorityLevel = "critical" | "today" | "this_week" | "watch" | "long_term";

export type CrmRequirementKey =
  | "client_identity" | "client_contact" | "qualification" | "property" | "evaluation_appointment"
  | "evaluation" | "mandate" | "essential_documents" | "listing_assets" | "marketing_plan"
  | "prequalification" | "buyer_contract" | "buyer_criteria" | "visits" | "offer"
  | "offer_accepted" | "conditions" | "notary" | "transaction_closed";

export type CrmStageDefinition = {
  id: string;
  label: string;
  nextAction: string;
  requirements: CrmRequirementKey[];
  taskTemplates: string[];
  automationTemplates: string[];
};

export type CrmConditionSnapshot = { title: string; status?: "pending" | "satisfied" | "waived" | string | null; dueAt?: string | null };

export type CrmCaseSnapshot = {
  caseType: CrmPipelineType;
  currentStage: string;
  pipelineMode?: CrmPipelineMode | null;
  clients: Array<{ firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }>;
  hasProperty: boolean;
  documentCategories: string[];
  openTasks: Array<{ title: string; dueAt?: string | null; category?: string | null }>;
  pendingConflicts: number;
  hasContactEstablished?: boolean;
  hasQualification?: boolean;
  hasFinancing: boolean;
  hasBuyerContract: boolean;
  hasBuyerCriteria: boolean;
  hasEvaluationAppointment?: boolean;
  hasEvaluation: boolean;
  hasMandate: boolean;
  hasEssentialDocuments?: boolean;
  photoCount?: number;
  hasDescription?: boolean;
  hasPrice?: boolean;
  hasSellerInstructions?: boolean;
  hasListingAssets: boolean;
  hasMarketingPlan: boolean;
  isPublished?: boolean;
  hasVisits?: boolean;
  hasOffer: boolean;
  hasOfferAccepted?: boolean;
  conditions?: CrmConditionSnapshot[];
  conditionsSatisfied: boolean;
  hasNotaryAppointment: boolean;
  transactionClosed: boolean;
  eventTypes?: string[];
  lastContactAt?: string | null;
  lastActivityAt?: string | null;
};

export type CrmRequirementStatus = { key: CrmRequirementKey; label: string; status: "complete" | "missing"; requiredForStage: string };
export type CrmAlert = { code: string; level: "critical" | "warning" | "info"; title: string; detail: string; dueAt?: string | null };

export type CrmOperatingState = {
  pipelineType: CrmPipelineType;
  pipelineMode: CrmPipelineMode;
  currentStage: string;
  stageLabel: string;
  evidenceStage: string;
  suggestedStage: string | null;
  suggestedStageReason: string | null;
  suggestionConfidence: number;
  pipelineProgress: number;
  completionScore: number;
  healthScore: number;
  priorityScore: number;
  priorityLevel: CrmPriorityLevel;
  nextAction: string;
  nextBestAction: string;
  nextActionReason: string;
  nextActionDueAt: string | null;
  requirements: CrmRequirementStatus[];
  missingItems: string[];
  alerts: CrmAlert[];
  recommendedTasks: string[];
  recommendedAutomations: string[];
};

const SELLER_STAGES: CrmStageDefinition[] = [
  stage("new_seller_lead", "Nouveau prospect", "Établir le premier contact", ["client_identity", "client_contact"], ["Contacter le prospect vendeur"]),
  stage("contact_established", "Contact établi", "Qualifier le projet vendeur", ["client_identity", "client_contact"], ["Qualifier le projet vendeur"]),
  stage("qualification", "Qualification", "Confirmer la motivation, l’échéancier et la propriété", ["qualification", "property"], ["Compléter la qualification vendeur"]),
  stage("evaluation_appointment", "Rendez-vous d’évaluation", "Préparer le rendez-vous d’évaluation", ["property", "evaluation_appointment"], ["Préparer le rendez-vous d’évaluation"]),
  stage("evaluation_completed", "Évaluation réalisée", "Présenter l’évaluation et la stratégie", ["property", "evaluation"], ["Présenter l’évaluation au vendeur"]),
  stage("mandate_to_obtain", "Mandat à obtenir", "Faire signer le contrat de courtage", ["evaluation", "mandate"], ["Faire signer le contrat de courtage"]),
  stage("mandate_signed", "Mandat signé", "Valider tous les documents requis", ["property", "mandate"], ["Vérifier les documents obligatoires"]),
  stage("documents_to_complete", "Documents à compléter", "Obtenir les documents manquants", ["essential_documents"], ["Obtenir les documents vendeur manquants"]),
  stage("listing_preparation", "Préparation mise en marché", "Compléter photos, description et prix", ["listing_assets"], ["Préparer les actifs de mise en marché"]),
  stage("ready_to_publish", "Prêt à publier", "Valider la publication et le plan marketing", ["listing_assets", "marketing_plan"], ["Valider la publication avec le vendeur"]),
  stage("on_market", "En marché", "Suivre les visites et la rétroaction", ["marketing_plan"], ["Faire le suivi de la mise en marché"]),
  stage("visits_followups", "Visites / suivis", "Documenter les visites et relancer les courtiers", ["visits"], ["Faire le suivi des visites"]),
  stage("offer_received", "Offre reçue", "Analyser l’offre avec les vendeurs", ["offer"], ["Analyser l’offre reçue"]),
  stage("offer_accepted", "Offre acceptée", "Planifier toutes les conditions", ["offer", "offer_accepted"], ["Planifier les conditions de l’offre"]),
  stage("conditions_in_progress", "Conditions en cours", "Suivre les conditions et leurs échéances", ["offer_accepted"], ["Suivre les échéances des conditions"]),
  stage("conditions_satisfied", "Conditions réalisées", "Préparer le dossier pour le notaire", ["conditions"], ["Préparer le dossier pour le notaire"]),
  stage("notary", "Notaire", "Confirmer les documents et le rendez-vous", ["conditions", "notary"], ["Confirmer le rendez-vous chez le notaire"]),
  stage("sold", "Vendu", "Confirmer la clôture de la transaction", ["notary", "transaction_closed"], ["Confirmer la clôture de la transaction"]),
  stage("post_sale", "Après-vente", "Démarrer le parcours relationnel après-vente", ["transaction_closed"], ["Planifier le suivi après-vente"], ["Préparer le suivi après-vente"]),
];

const BUYER_STAGES: CrmStageDefinition[] = [
  stage("new_buyer_lead", "Nouveau prospect", "Établir le premier contact", ["client_identity", "client_contact"], ["Contacter le prospect acheteur"]),
  stage("contact_established", "Contact établi", "Qualifier le projet acheteur", ["client_identity", "client_contact"], ["Qualifier le projet acheteur"]),
  stage("qualification", "Qualification", "Valider la capacité financière", ["qualification"], ["Compléter la qualification acheteur"]),
  stage("prequalification", "Préqualification", "Obtenir ou valider la préqualification", ["prequalification"], ["Obtenir la préqualification hypothécaire"]),
  stage("buyer_brokerage_contract", "Contrat de courtage achat", "Faire signer le contrat de courtage achat", ["prequalification", "buyer_contract"], ["Faire signer le contrat de courtage achat"]),
  stage("criteria_to_complete", "Critères à compléter", "Confirmer tous les critères de recherche", ["buyer_contract", "buyer_criteria"], ["Confirmer les critères de recherche"]),
  stage("active_search", "Recherche active", "Proposer les meilleures propriétés", ["buyer_criteria"], ["Proposer des propriétés pertinentes"]),
  stage("visits", "Visites", "Planifier et documenter la prochaine visite", ["buyer_criteria", "visits"], ["Planifier la prochaine visite"]),
  stage("offer_preparation", "Offre à préparer", "Préparer la promesse d’achat", ["property", "prequalification"], ["Préparer la promesse d’achat"]),
  stage("offer_submitted", "Offre déposée", "Suivre la réponse à l’offre", ["offer"], ["Suivre la réponse à l’offre"]),
  stage("offer_accepted", "Offre acceptée", "Planifier l’inspection, le financement et les conditions", ["offer", "offer_accepted"], ["Planifier les conditions de l’offre"]),
  stage("conditions_in_progress", "Conditions en cours", "Suivre toutes les échéances de conditions", ["offer_accepted"], ["Suivre les échéances des conditions"]),
  stage("conditions_satisfied", "Conditions réalisées", "Préparer le rendez-vous chez le notaire", ["conditions"], ["Préparer le rendez-vous chez le notaire"]),
  stage("notary", "Notaire", "Confirmer les documents et le rendez-vous", ["conditions", "notary"], ["Confirmer le rendez-vous chez le notaire"]),
  stage("purchase_completed", "Achat complété", "Confirmer la clôture de la transaction", ["notary", "transaction_closed"], ["Confirmer la clôture de la transaction"]),
  stage("post_sale", "Après-vente", "Démarrer le parcours relationnel après-vente", ["transaction_closed"], ["Planifier le suivi après-vente"], ["Préparer le suivi après-vente"]),
];

const POST_SALE_STAGES: CrmStageDefinition[] = [
  stage("transaction_completed", "Transaction complétée", "Préparer les remerciements", ["transaction_closed"], ["Vérifier la clôture du dossier"]),
  stage("thank_you", "Remerciement", "Faire parvenir le remerciement après transaction", [], ["Préparer le remerciement client"], ["Préparer le remerciement client"]),
  stage("google_review", "Avis Google", "Demander un avis au bon moment", [], ["Préparer la demande d’avis"], ["Préparer la demande d’avis Google"]),
  stage("followup_30_days", "Suivi 30 jours", "Prendre des nouvelles du client", [], ["Faire le suivi 30 jours"], ["Planifier le suivi 30 jours"]),
  stage("followup_3_months", "Suivi 3 mois", "Maintenir la relation client", [], ["Faire le suivi 3 mois"], ["Planifier le suivi 3 mois"]),
  stage("transaction_anniversary", "Anniversaire de transaction", "Préparer l’anniversaire de transaction", [], ["Préparer l’anniversaire de transaction"], ["Planifier l’anniversaire de transaction"]),
  stage("mortgage_renewal", "Renouvellement hypothécaire", "Valider la date de renouvellement", [], ["Valider le renouvellement hypothécaire"], ["Planifier le suivi de renouvellement"]),
  stage("market_report", "Rapport de marché", "Préparer un rapport pertinent", [], ["Préparer le rapport de marché"], ["Préparer le rapport de marché"]),
  stage("referral", "Demande de référence", "Préparer une demande de référence", [], ["Préparer la demande de référence"], ["Préparer la demande de référence"]),
  stage("new_opportunity", "Nouvelle opportunité", "Qualifier le prochain projet", [], ["Qualifier la nouvelle opportunité"]),
];

const REQUIREMENT_LABELS: Record<CrmRequirementKey, string> = {
  client_identity: "Identité du client", client_contact: "Téléphone ou courriel", qualification: "Qualification du projet",
  property: "Propriété du dossier", evaluation_appointment: "Rendez-vous d’évaluation", evaluation: "Évaluation de la propriété",
  mandate: "Contrat de courtage vendeur", essential_documents: "Documents essentiels du vendeur",
  listing_assets: "Photos, description et prix", marketing_plan: "Plan de mise en marché", prequalification: "Préqualification hypothécaire",
  buyer_contract: "Contrat de courtage achat", buyer_criteria: "Critères de recherche", visits: "Visite documentée",
  offer: "Promesse d’achat ou offre", offer_accepted: "Offre acceptée", conditions: "Conditions réalisées",
  notary: "Rendez-vous ou documents du notaire", transaction_closed: "Transaction clôturée",
};

const SELLER_ALIASES: Record<string, string> = {
  lead: "new_seller_lead", new_prospect: "new_seller_lead", appointment: "evaluation_appointment", evaluation: "evaluation_completed",
  mandate: "mandate_to_obtain", preparation: "listing_preparation", ready_for_marketing: "ready_to_publish", marketing: "on_market",
  visits: "visits_followups", conditions: "conditions_in_progress", transaction_completed: "sold", completed: "sold", post_transaction: "post_sale",
};
const BUYER_ALIASES: Record<string, string> = {
  new_contact: "new_buyer_lead", financing: "prequalification", representation_agreement: "buyer_brokerage_contract",
  criteria_defined: "criteria_to_complete", criteria_complete: "criteria_to_complete", offer: "offer_submitted",
  conditions: "conditions_in_progress", completed: "purchase_completed", post_transaction: "post_sale",
};

export function crmPipelineStages(type: CrmPipelineType) {
  if (type === "seller") return SELLER_STAGES;
  if (type === "buyer" || type === "buy_sell") return BUYER_STAGES;
  if (type === "post_transaction") return POST_SALE_STAGES;
  return BUYER_STAGES.slice(0, 3);
}

export function canonicalCrmStage(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type); const requested = String(value || "").trim();
  if (stages.some((item) => item.id === requested)) return requested;
  const alias = type === "seller" ? SELLER_ALIASES[requested] : BUYER_ALIASES[requested];
  return alias || stages[0].id;
}
export function pipelineProgress(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type); const current = canonicalCrmStage(type, value);
  return Math.round(((Math.max(0, stages.findIndex((item) => item.id === current)) + 1) / stages.length) * 100);
}
export function stageDefinition(type: CrmPipelineType, value?: string | null) {
  const stages = crmPipelineStages(type); const current = canonicalCrmStage(type, value);
  return stages.find((item) => item.id === current) || stages[0];
}

export function evaluateCaseState(snapshot: CrmCaseSnapshot, now = new Date()): CrmOperatingState {
  const pipelineType = snapshot.caseType; const pipelineMode = snapshot.pipelineMode || "assisted"; const stages = crmPipelineStages(pipelineType);
  const storedStage = canonicalCrmStage(pipelineType, snapshot.currentStage); const storedIndex = Math.max(0, stages.findIndex((item) => item.id === storedStage));
  const evidence = evidenceStage(snapshot, stages); const evidenceIndex = Math.max(0, stages.findIndex((item) => item.id === evidence.stage));
  const canAdvance = evidenceIndex > storedIndex;
  const currentStage = pipelineMode === "automatic" && canAdvance && evidence.confidence >= 0.9 ? evidence.stage : storedStage;
  const currentIndex = Math.max(0, stages.findIndex((item) => item.id === currentStage));
  const suggestedStage = currentIndex < evidenceIndex && pipelineMode !== "manual" ? evidence.stage : null;
  const requiredThroughCurrent = new Map<CrmRequirementKey, string>();
  stages.slice(0, currentIndex + 1).forEach((item) => item.requirements.forEach((key) => requiredThroughCurrent.set(key, item.id)));
  const requirements = [...requiredThroughCurrent.entries()].map(([key, requiredForStage]) => ({ key, label: REQUIREMENT_LABELS[key], status: requirementIsComplete(key, snapshot) ? "complete" as const : "missing" as const, requiredForStage }));
  const completionScore = requirements.length ? Math.round((requirements.filter((item) => item.status === "complete").length / requirements.length) * 100) : 100;
  const overdue = snapshot.openTasks.filter((task) => task.dueAt && validDate(task.dueAt) < now.getTime());
  const inactivityDays = daysSince(snapshot.lastActivityAt, now); const alerts = buildAlerts(snapshot, overdue, inactivityDays, now);
  const healthScore = clamp(100 - overdue.length * 12 - snapshot.pendingConflicts * 8 - alerts.filter((a) => a.level === "critical").length * 12 - Math.max(0, inactivityDays - 14), 0, 100);
  const closingStage = currentIndex >= Math.max(0, stages.length - 5);
  const priorityScore = clamp(20 + overdue.length * 18 + snapshot.pendingConflicts * 6 + alerts.filter((a) => a.level === "critical").length * 20 + (closingStage ? 15 : 0) + Math.min(15, Math.max(0, inactivityDays - 7)), 0, 100);
  const priorityLevel = resolvePriorityLevel(priorityScore, alerts, overdue.length); const firstMissing = requirements.find((item) => item.status === "missing"); const current = stages[currentIndex];
  const urgentCondition = (snapshot.conditions || []).filter((item) => item.status === "pending" && item.dueAt).sort((a, b) => validDate(a.dueAt) - validDate(b.dueAt))[0];
  const nextAction = overdue[0]?.title || (urgentCondition ? `Réaliser la condition : ${urgentCondition.title}` : "") || (snapshot.pendingConflicts ? "Vérifier les informations contradictoires" : "") || (firstMissing ? `Compléter : ${firstMissing.label}` : "") || current.nextAction;
  const nextActionReason = overdue.length ? `${overdue.length} tâche${overdue.length > 1 ? "s" : ""} en retard` : urgentCondition ? `Échéance ${formatRelativeDue(urgentCondition.dueAt, now)}` : snapshot.pendingConflicts ? `${snapshot.pendingConflicts} information${snapshot.pendingConflicts > 1 ? "s" : ""} à vérifier` : firstMissing ? `Requis pour l’étape ${stageLabel(stages, firstMissing.requiredForStage)}` : suggestedStage ? evidence.reason : `Prochaine action recommandée pour ${current.label}`;
  const nextActionDueAt = overdue[0]?.dueAt || urgentCondition?.dueAt || null;
  return { pipelineType, pipelineMode, currentStage, stageLabel: current.label, evidenceStage: evidence.stage, suggestedStage, suggestedStageReason: suggestedStage ? evidence.reason : null, suggestionConfidence: suggestedStage ? evidence.confidence : 0, pipelineProgress: pipelineProgress(pipelineType, currentStage), completionScore, healthScore, priorityScore, priorityLevel, nextAction, nextBestAction: nextAction, nextActionReason, nextActionDueAt, requirements, missingItems: requirements.filter((item) => item.status === "missing").map((item) => item.label), alerts, recommendedTasks: dedupe([nextAction, ...current.taskTemplates]), recommendedAutomations: current.automationTemplates };
}
export const computeCrmOperatingState = evaluateCaseState;

export function scoreCentralClientMatch(incoming: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; address?: string | null }, existing: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; address?: string | null }) {
  const reasons: string[] = []; let score = 0; const email = normalize(incoming.email); const phone = digits(incoming.phone); const name = normalize(`${incoming.firstName || ""}${incoming.lastName || ""}`); const address = normalize(incoming.address);
  if (email && email === normalize(existing.email)) { score = Math.max(score, 100); reasons.push("courriel exact"); }
  if (phone && phone === digits(existing.phone)) { score = Math.max(score, 96); reasons.push("téléphone normalisé"); }
  if (name && name === normalize(`${existing.firstName || ""}${existing.lastName || ""}`)) { if (address && address === normalize(existing.address)) { score = Math.max(score, 92); reasons.push("nom et adresse"); } else { score = Math.max(score, 65); reasons.push("prénom et nom"); } }
  return { score, confidence: score >= 90 ? "certain" as const : score >= 60 ? "ambiguous" as const : "none" as const, reasons };
}

function evidenceStage(snapshot: CrmCaseSnapshot, stages: CrmStageDefinition[]) {
  if (snapshot.caseType === "post_transaction") return { stage: canonicalCrmStage(snapshot.caseType, snapshot.currentStage), confidence: 1, reason: "Étape relationnelle confirmée" };
  const events = (snapshot.eventTypes || []).map(normalize); const hasEvent = (...values: string[]) => values.some((value) => events.includes(normalize(value)));
  const candidates: Array<{ id: string; ok: boolean; confidence: number; reason: string }> = snapshot.caseType === "seller" ? [
    { id: "contact_established", ok: Boolean(snapshot.hasContactEstablished), confidence: 0.95, reason: "Un contact client est consigné" },
    { id: "qualification", ok: Boolean(snapshot.hasQualification), confidence: 0.92, reason: "La qualification vendeur est consignée" },
    { id: "evaluation_appointment", ok: Boolean(snapshot.hasEvaluationAppointment), confidence: 0.95, reason: "Un rendez-vous d’évaluation est planifié" },
    { id: "evaluation_completed", ok: snapshot.hasEvaluation, confidence: 0.95, reason: "Une évaluation est enregistrée" },
    { id: "mandate_signed", ok: snapshot.hasMandate, confidence: 0.98, reason: "Le contrat de courtage vendeur est présent" },
    { id: "documents_to_complete", ok: snapshot.hasMandate, confidence: 0.9, reason: "Le mandat est signé; les documents doivent être validés" },
    { id: "listing_preparation", ok: Boolean(snapshot.hasEssentialDocuments), confidence: 0.9, reason: "Les documents essentiels sont présents" },
    { id: "ready_to_publish", ok: snapshot.hasListingAssets && snapshot.hasMarketingPlan, confidence: 0.94, reason: "Photos, description, prix et plan marketing sont prêts" },
    { id: "on_market", ok: Boolean(snapshot.isPublished) || hasEvent("listing_published", "property_published"), confidence: 0.98, reason: "La propriété est publiée" },
    { id: "visits_followups", ok: Boolean(snapshot.hasVisits), confidence: 0.92, reason: "Une visite ou un suivi de visite est consigné" },
    { id: "offer_received", ok: snapshot.hasOffer, confidence: 0.98, reason: "Une offre est enregistrée" },
    { id: "offer_accepted", ok: Boolean(snapshot.hasOfferAccepted), confidence: 0.99, reason: "L’acceptation de l’offre est confirmée" },
    { id: "conditions_in_progress", ok: Boolean(snapshot.hasOfferAccepted && (snapshot.conditions || []).some((item) => item.status === "pending")), confidence: 0.98, reason: "Des conditions acceptées sont en cours" },
    { id: "conditions_satisfied", ok: snapshot.conditionsSatisfied, confidence: 0.99, reason: "Toutes les conditions sont réalisées ou levées" },
    { id: "notary", ok: snapshot.hasNotaryAppointment, confidence: 0.98, reason: "Le rendez-vous chez le notaire est planifié" },
    { id: "sold", ok: snapshot.transactionClosed, confidence: 1, reason: "La transaction est clôturée" },
  ] : [
    { id: "contact_established", ok: Boolean(snapshot.hasContactEstablished), confidence: 0.95, reason: "Un contact client est consigné" },
    { id: "qualification", ok: Boolean(snapshot.hasQualification), confidence: 0.92, reason: "La qualification acheteur est consignée" },
    { id: "prequalification", ok: snapshot.hasFinancing, confidence: 0.98, reason: "La préqualification est enregistrée" },
    { id: "buyer_brokerage_contract", ok: snapshot.hasBuyerContract, confidence: 0.98, reason: "Le contrat de courtage achat est présent" },
    { id: "criteria_to_complete", ok: snapshot.hasBuyerContract, confidence: 0.9, reason: "Le contrat est signé; les critères doivent être confirmés" },
    { id: "active_search", ok: snapshot.hasBuyerCriteria, confidence: 0.94, reason: "Les critères de recherche sont complets" },
    { id: "visits", ok: Boolean(snapshot.hasVisits), confidence: 0.95, reason: "Une visite est consignée" },
    { id: "offer_preparation", ok: snapshot.hasProperty && snapshot.hasFinancing && hasEvent("offer_preparation_started"), confidence: 0.92, reason: "Une offre est en préparation" },
    { id: "offer_submitted", ok: snapshot.hasOffer, confidence: 0.98, reason: "Une offre est enregistrée" },
    { id: "offer_accepted", ok: Boolean(snapshot.hasOfferAccepted), confidence: 0.99, reason: "L’acceptation de l’offre est confirmée" },
    { id: "conditions_in_progress", ok: Boolean(snapshot.hasOfferAccepted && (snapshot.conditions || []).some((item) => item.status === "pending")), confidence: 0.98, reason: "Des conditions acceptées sont en cours" },
    { id: "conditions_satisfied", ok: snapshot.conditionsSatisfied, confidence: 0.99, reason: "Toutes les conditions sont réalisées ou levées" },
    { id: "notary", ok: snapshot.hasNotaryAppointment, confidence: 0.98, reason: "Le rendez-vous chez le notaire est planifié" },
    { id: "purchase_completed", ok: snapshot.transactionClosed, confidence: 1, reason: "La transaction est clôturée" },
  ];
  const matched = candidates.filter((item) => item.ok && stages.some((stageItem) => stageItem.id === item.id));
  if (!matched.length) return { stage: stages[0].id, confidence: 1, reason: "Aucune preuve d’une étape ultérieure" };
  const selected = matched.sort((a, b) => stages.findIndex((s) => s.id === b.id) - stages.findIndex((s) => s.id === a.id))[0];
  return { stage: selected.id, confidence: selected.confidence, reason: selected.reason };
}

function requirementIsComplete(key: CrmRequirementKey, snapshot: CrmCaseSnapshot) {
  const categories = snapshot.documentCategories.map(normalize); const hasDocument = (...patterns: RegExp[]) => categories.some((value) => patterns.some((pattern) => pattern.test(value)));
  switch (key) {
    case "client_identity": return snapshot.clients.length > 0 && snapshot.clients.every((client) => Boolean(client.firstName || client.lastName));
    case "client_contact": return snapshot.clients.length > 0 && snapshot.clients.every((client) => Boolean(client.email || client.phone));
    case "qualification": return Boolean(snapshot.hasQualification);
    case "property": return snapshot.hasProperty;
    case "evaluation_appointment": return Boolean(snapshot.hasEvaluationAppointment);
    case "evaluation": return snapshot.hasEvaluation || hasDocument(/evaluation/, /analysecomparative/, /acm/);
    case "mandate": return snapshot.hasMandate || hasDocument(/contratdecourtage.*vente/, /mandat/);
    case "essential_documents": return Boolean(snapshot.hasEssentialDocuments);
    case "listing_assets": return snapshot.hasListingAssets || Boolean((snapshot.photoCount || 0) > 0 && snapshot.hasDescription && snapshot.hasPrice);
    case "marketing_plan": return snapshot.hasMarketingPlan;
    case "prequalification": return snapshot.hasFinancing || hasDocument(/preapprobation/, /prequalification/);
    case "buyer_contract": return snapshot.hasBuyerContract || hasDocument(/contratdecourtage.*achat/, /cca/);
    case "buyer_criteria": return snapshot.hasBuyerCriteria;
    case "visits": return Boolean(snapshot.hasVisits);
    case "offer": return snapshot.hasOffer || hasDocument(/promessedachat/, /offre/);
    case "offer_accepted": return Boolean(snapshot.hasOfferAccepted);
    case "conditions": return snapshot.conditionsSatisfied;
    case "notary": return snapshot.hasNotaryAppointment || hasDocument(/notaire/);
    case "transaction_closed": return snapshot.transactionClosed;
  }
}

function buildAlerts(snapshot: CrmCaseSnapshot, overdue: CrmCaseSnapshot["openTasks"], inactivityDays: number, now: Date): CrmAlert[] {
  const alerts: CrmAlert[] = [];
  overdue.forEach((task) => alerts.push({ code: `overdue:${normalize(task.title)}`, level: "critical", title: "Tâche en retard", detail: task.title, dueAt: task.dueAt }));
  (snapshot.conditions || []).filter((item) => item.status === "pending" && item.dueAt).forEach((item) => { const hours = (validDate(item.dueAt) - now.getTime()) / 3_600_000; if (hours <= 72) alerts.push({ code: `condition:${normalize(item.title)}`, level: hours <= 24 ? "critical" : "warning", title: "Condition à échéance", detail: `${item.title} — ${formatRelativeDue(item.dueAt, now)}`, dueAt: item.dueAt }); });
  if (snapshot.pendingConflicts) alerts.push({ code: "data_conflicts", level: "warning", title: "Informations à vérifier", detail: `${snapshot.pendingConflicts} contradiction${snapshot.pendingConflicts > 1 ? "s" : ""} détectée${snapshot.pendingConflicts > 1 ? "s" : ""}` });
  if (inactivityDays >= 14) alerts.push({ code: "inactive", level: inactivityDays >= 30 ? "critical" : "warning", title: "Dossier sans activité", detail: `Aucune activité depuis ${inactivityDays} jours` });
  if (snapshot.hasMandate && !snapshot.hasListingAssets) alerts.push({ code: "listing_assets_missing", level: "warning", title: "Mise en marché incomplète", detail: "Le mandat est signé, mais les photos, la description ou le prix ne sont pas prêts." });
  if (snapshot.hasFinancing && !snapshot.hasBuyerContract && (snapshot.caseType === "buyer" || snapshot.caseType === "buy_sell")) alerts.push({ code: "buyer_contract_missing", level: "warning", title: "Contrat acheteur manquant", detail: "La préqualification est présente, mais le contrat de courtage achat n’est pas confirmé." });
  return dedupeByCode(alerts);
}
function resolvePriorityLevel(score: number, alerts: CrmAlert[], overdueCount: number): CrmPriorityLevel { if (overdueCount || alerts.some((alert) => alert.level === "critical")) return "critical"; if (score >= 70) return "today"; if (score >= 50) return "this_week"; if (score >= 30) return "watch"; return "long_term"; }
function stage(id: string, label: string, nextAction: string, requirements: CrmRequirementKey[], taskTemplates: string[], automationTemplates: string[] = []): CrmStageDefinition { return { id, label, nextAction, requirements, taskTemplates, automationTemplates }; }
function stageLabel(stages: CrmStageDefinition[], id: string) { return stages.find((item) => item.id === id)?.label || id; }
function normalize(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase(); }
function digits(value?: string | null) { return String(value || "").replace(/\D/g, ""); }
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, Math.round(value))); }
function validDate(value?: string | null) { const time = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY; return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY; }
function daysSince(value: string | null | undefined, now: Date) { const time = validDate(value); return Number.isFinite(time) ? Math.max(0, Math.floor((now.getTime() - time) / 86_400_000)) : 0; }
function formatRelativeDue(value: string | null | undefined, now: Date) { const hours = Math.ceil((validDate(value) - now.getTime()) / 3_600_000); return hours < 0 ? `dépassée de ${Math.abs(hours)} h` : hours <= 24 ? `dans ${hours} h` : `dans ${Math.ceil(hours / 24)} jours`; }
function dedupe(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function dedupeByCode(values: CrmAlert[]) { return [...new Map(values.map((value) => [value.code, value])).values()]; }

