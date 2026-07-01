import type { AiEmployeeId } from "@/lib/pipeline-intelligence/types";

import type { OfficialBuyerStatus, OfficialClientType, OfficialSellerStatus, OfficialWorkflowStatus } from "./real-estate-workflows";

export type BusinessWorkflowAction = {
  id: string;
  employeeId: AiEmployeeId;
  title: string;
  description: string;
  category: "task" | "document_request" | "ai_action" | "followup";
  rule: string;
};

type WorkflowActionTemplate = Omit<BusinessWorkflowAction, "id">;

const sellerActions: Partial<Record<OfficialSellerStatus, WorkflowActionTemplate[]>> = {
  "Prospection": [
    { employeeId: "noah", title: "Préparer l’ouverture de prospection", description: "Créer une approche naturelle et une question ouverte pour valider l'intérêt.", category: "task", rule: "prospecting_opening" },
  ],
  "Prospect vendeur": [
    { employeeId: "noah", title: "Qualifier le prospect vendeur", description: "Valider motivation, échéancier, contexte et niveau d'ouverture.", category: "task", rule: "seller_qualification" },
    { employeeId: "olivia", title: "Créer la première relance vendeur", description: "Planifier une relance si le prospect ne répond pas.", category: "followup", rule: "seller_first_followup" },
  ],
  "Appel / qualification": [
    { employeeId: "noah", title: "Préparer les questions de qualification", description: "Préparer les questions sur motivation, délai, attentes et prochaine étape.", category: "task", rule: "seller_call_questions" },
  ],
  "Rendez-vous vendeur obtenu": [
    { employeeId: "alex", title: "Préparer analyse comparative", description: "Démarrer l'analyse de marché avant le rendez-vous vendeur.", category: "task", rule: "market_analysis_before_mandate" },
    { employeeId: "alex", title: "Préparer arguments vendeur", description: "Structurer les arguments de prix, timing et positionnement.", category: "task", rule: "seller_arguments" },
    { employeeId: "alex", title: "Préparer rapport de marché", description: "Créer un rapport clair à présenter au vendeur.", category: "task", rule: "market_report" },
    { employeeId: "noah", title: "Préparer questions de découverte", description: "Préparer les questions pour découvrir motivation, contraintes et objections.", category: "task", rule: "discovery_questions" },
    { employeeId: "noah", title: "Générer script de rendez-vous vendeur", description: "Créer le script de rencontre vendeur avec ouverture, questions et conclusion.", category: "ai_action", rule: "seller_meeting_script" },
  ],
  "Préparation de l’analyse de marché": [
    { employeeId: "alex", title: "Finaliser les comparables", description: "Comparer les propriétés pertinentes et préparer les ajustements qualitatifs.", category: "task", rule: "finalize_comparables" },
  ],
  "Analyse de marché prête": [
    { employeeId: "alex", title: "Préparer la présentation vendeur", description: "Transformer l'analyse en présentation simple et persuasive.", category: "task", rule: "seller_presentation" },
    { employeeId: "noah", title: "Préparer réponses aux objections prix", description: "Préparer les réponses si le vendeur conteste le positionnement.", category: "task", rule: "price_objection_prep" },
  ],
  "Rendez-vous vendeur effectué": [
    { employeeId: "olivia", title: "Créer suivi après rendez-vous", description: "Planifier une relance claire avec prochaine étape.", category: "followup", rule: "post_meeting_followup" },
  ],
  "Mandat vendeur signé": [
    { employeeId: "emma", title: "Demander certificat de localisation", description: "Envoyer la demande documentaire au vendeur.", category: "document_request", rule: "request_location_certificate" },
    { employeeId: "emma", title: "Demander compte de taxes municipales", description: "Demander le compte de taxes municipales récent.", category: "document_request", rule: "request_municipal_taxes" },
    { employeeId: "emma", title: "Demander taxes scolaires", description: "Demander le compte de taxes scolaires récent.", category: "document_request", rule: "request_school_taxes" },
    { employeeId: "emma", title: "Demander acte de vente", description: "Demander l'acte de vente ou document de propriété pertinent.", category: "document_request", rule: "request_deed" },
    { employeeId: "emma", title: "Demander déclaration du vendeur", description: "Demander ou préparer la déclaration du vendeur.", category: "document_request", rule: "request_seller_declaration" },
    { employeeId: "mia", title: "Préparer description", description: "Préparer la description immobilière à partir du dossier.", category: "task", rule: "prepare_listing_description" },
    { employeeId: "mia", title: "Préparer campagne marketing", description: "Préparer les contenus Facebook, Instagram, TikTok et lancement.", category: "task", rule: "prepare_marketing_campaign" },
  ],
  "Documents vendeur à recevoir": [
    { employeeId: "emma", title: "Suivre documents manquants", description: "Relancer le vendeur pour compléter le dossier documentaire.", category: "followup", rule: "missing_documents_followup" },
  ],
  "Préparation mise en marché": [
    { employeeId: "mia", title: "Finaliser mise en marché", description: "Finaliser description, visuels, publications et séquence de lancement.", category: "task", rule: "launch_preparation" },
  ],
  "En vente": [
    { employeeId: "olivia", title: "Planifier suivi vendeur hebdomadaire", description: "Créer le rythme de suivi sur activité, visites et rétroactions.", category: "followup", rule: "seller_weekly_update" },
  ],
  "Promesse d’achat": [
    { employeeId: "emma", title: "Suivre promesse d'achat", description: "Suivre les documents, délais et communications liées à la promesse.", category: "task", rule: "purchase_offer_tracking" },
  ],
  Conditions: [
    { employeeId: "emma", title: "Suivre conditions", description: "Surveiller inspection, financement et délais critiques.", category: "task", rule: "conditions_tracking" },
  ],
  Notaire: [
    { employeeId: "emma", title: "Préparer dossier notaire", description: "Confirmer les documents et informations à transmettre au notaire.", category: "task", rule: "notary_package" },
  ],
  Vendu: [
    { employeeId: "mia", title: "Préparer publication vendu", description: "Créer le contenu de clôture et de preuve sociale.", category: "task", rule: "sold_marketing" },
    { employeeId: "olivia", title: "Créer suivi après vente", description: "Préparer remerciement, témoignage et rappel futur.", category: "followup", rule: "post_sale_followup" },
  ],
  "Suivi après-vente": [
    { employeeId: "olivia", title: "Entretenir la relation client", description: "Planifier les suivis de satisfaction et références.", category: "followup", rule: "relationship_nurture" },
  ],
};

const buyerActions: Partial<Record<OfficialBuyerStatus, WorkflowActionTemplate[]>> = {
  "Prospect acheteur": [
    { employeeId: "noah", title: "Qualifier l'acheteur", description: "Valider budget, secteur, échéancier et motivation.", category: "task", rule: "buyer_qualification" },
  ],
  "Qualification acheteur": [
    { employeeId: "noah", title: "Structurer le profil acheteur", description: "Synthétiser critères, contraintes et capacité d'achat.", category: "task", rule: "buyer_profile" },
  ],
  "Préautorisation demandée": [
    { employeeId: "emma", title: "Suivre préautorisation", description: "Créer une relance pour obtenir la preuve de préautorisation.", category: "followup", rule: "preapproval_followup" },
  ],
  "Contrat acheteur signé": [
    { employeeId: "emma", title: "Préparer dossier acheteur", description: "Créer le dossier de recherche et les documents contractuels.", category: "task", rule: "buyer_contract_package" },
  ],
  "Recherche active": [
    { employeeId: "alex", title: "Analyser propriétés ciblées", description: "Comparer les propriétés repérées avec les critères et le marché.", category: "task", rule: "buyer_property_analysis" },
    { employeeId: "olivia", title: "Planifier suivi de recherche", description: "Créer un rythme de suivi des nouvelles inscriptions.", category: "followup", rule: "buyer_search_followup" },
  ],
  Visites: [
    { employeeId: "noah", title: "Préparer questions de visite", description: "Créer une grille d'observations pour les visites.", category: "task", rule: "showing_questions" },
  ],
  "Promesse d’achat": [
    { employeeId: "emma", title: "Suivre promesse d'achat acheteur", description: "Préparer documents, délais et communications.", category: "task", rule: "buyer_offer_tracking" },
  ],
  Conditions: [
    { employeeId: "emma", title: "Suivre conditions acheteur", description: "Surveiller inspection, financement et échéances.", category: "task", rule: "buyer_conditions" },
  ],
  Notaire: [
    { employeeId: "emma", title: "Préparer notaire acheteur", description: "Préparer rappels, documents et informations pratiques.", category: "task", rule: "buyer_notary" },
  ],
  "Suivi après-achat": [
    { employeeId: "olivia", title: "Créer suivi après achat", description: "Préparer satisfaction, références et rappels utiles.", category: "followup", rule: "post_purchase_followup" },
  ],
};

export function getAutomaticWorkflowActions({
  clientType,
  currentStatus,
  nextStatus,
}: {
  clientType: OfficialClientType;
  currentStatus?: OfficialWorkflowStatus;
  nextStatus: OfficialWorkflowStatus;
}): BusinessWorkflowAction[] {
  const source = clientType === "vendeur" ? sellerActions[nextStatus as OfficialSellerStatus] : buyerActions[nextStatus as OfficialBuyerStatus];
  const actions = source || [];

  return actions.map((action, index) => ({
    ...action,
    id: `${clientType}-${currentStatus || "start"}-${nextStatus}-${action.rule}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  }));
}

export function shouldCreateFinalMarketAnalysisUpdate(status: OfficialWorkflowStatus) {
  return status === "Mandat vendeur signé";
}
