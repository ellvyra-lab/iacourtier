import { officialBuyerWorkflow, officialSellerWorkflow } from "@/lib/business-rules";

export type AiActionContext =
  | "prospect vendeur"
  | "prospect acheteur"
  | "rendez-vous vendeur obtenu"
  | "evaluation en preparation"
  | "mandat vendeur signe"
  | "propriete en marche"
  | "propriete vendue"
  | "acheteur qualifie"
  | "contrat acheteur signe"
  | "prospection generale"
  | "suivi client";

export type ContextualAiAction = {
  id: string;
  label: string;
  description: string;
  context: AiActionContext;
  primary?: boolean;
  outputs: string[];
  href?: string;
  assistantSlug?: string;
  serviceSlugs?: string[];
  serviceLabels?: string[];
};

export const aiActionContexts: Array<{ id: AiActionContext; label: string; description: string }> = [
  {
    id: "prospect vendeur",
    label: "Prospect vendeur",
    description: "Ouvrir une conversation naturelle et créer une occasion de rendez-vous.",
  },
  {
    id: "prospect acheteur",
    label: "Prospect acheteur",
    description: "Qualifier le besoin, clarifier le budget et proposer la prochaine etape.",
  },
  {
    id: "rendez-vous vendeur obtenu",
    label: "Rendez-vous vendeur obtenu",
    description: "Préparer la rencontre vendeur avant d'arriver chez le client.",
  },
  {
    id: "evaluation en preparation",
    label: "Evaluation en preparation",
    description: "Structurer les comparables, les arguments et les questions de decouverte.",
  },
  {
    id: "mandat vendeur signe",
    label: "Mandat vendeur signé",
    description: "Lancer la mise en marché sans ressaisir les informations du dossier.",
  },
  {
    id: "propriete en marche",
    label: "Propriete en marche",
    description: "Soutenir la promotion, les suivis et les ajustements pendant la mise en marche.",
  },
  {
    id: "propriete vendue",
    label: "Propriete vendue",
    description: "Transformer la vente en preuve sociale et en relances intelligentes.",
  },
  {
    id: "acheteur qualifie",
    label: "Acheteur qualifie",
    description: "Preparer la recherche, les suivis et les messages de qualification.",
  },
  {
    id: "contrat acheteur signe",
    label: "Contrat acheteur signe",
    description: "Organiser les recherches, visites et suivis acheteur.",
  },
  {
    id: "prospection generale",
    label: "Prospection generale",
    description: "Creer des messages et scripts libres sans client ou mandat lie.",
  },
  {
    id: "suivi client",
    label: "Suivi client",
    description: "Preparer les relances et maintenir une relation active.",
  },
];

const marketingLaunchOutputs = [
  "Description Centris courte",
  "Description Centris longue",
  "Publication Facebook",
  "Publication Instagram",
  "Story",
  "Texte TikTok",
  "Courriel aux acheteurs",
  "Texto aux acheteurs",
  "Script visite libre",
  "Points forts de la propriete",
  "Questions/reponses vendeur",
];

const soldCampaignOutputs = [
  "Publication Facebook vendu",
  "Instagram vendu",
  "Story vendu",
  "Message remerciement client",
  "Publication preuve sociale",
  "Message aux anciens clients",
];

const sellerProspectOutputs = [
  "Premier appel",
  "Premier texto",
  "Premier courriel",
  "Message Facebook",
  "Relance 7 jours",
  "Relance 30 jours",
  "Reponses aux objections",
];

const sellerAppointmentOutputs = [
  "Preparer analyse de marche",
  "Preparer questions de decouverte",
  "Preparer arguments vendeur",
  "Script rendez-vous vendeur",
  "Liste des documents a demander si mandat signe",
];

const contextualActions: ContextualAiAction[] = [
  {
    id: "generate-marketing-launch",
    label: "Lancer la mise en marché",
    description: "Préparer en une seule mission les textes essentiels pour sortir la propriété proprement.",
    context: "mandat vendeur signe",
    primary: true,
    outputs: marketingLaunchOutputs,
    href: "/tableau-de-bord/actions/generate-marketing-launch",
    assistantSlug: "description-centris",
    serviceSlugs: ["description-centris", "publication-facebook", "script-video", "courriel-vendeur", "plan-marketing"],
    serviceLabels: ["Description Centris", "Publication Facebook", "Script vidéo", "Courriel acheteurs", "Plan marketing"],
  },
  {
    id: "generate-sold-campaign",
    label: "Générer la campagne vendu",
    description: "Transformer une vente conclue en preuve sociale et en relances intelligentes.",
    context: "propriete vendue",
    primary: true,
    outputs: soldCampaignOutputs,
    href: "/tableau-de-bord/actions/generate-sold-campaign",
    assistantSlug: "publication-facebook",
    serviceSlugs: ["publication-facebook", "suivi-client"],
    serviceLabels: ["Publications vendu", "Messages de remerciement et anciens clients"],
  },
  {
    id: "prepare-first-seller-call",
    label: "Préparer un premier contact",
    description: "Préparer l’appel, le texto, le courriel et les relances sans révéler pourquoi le prospect a été choisi.",
    context: "prospect vendeur",
    primary: true,
    outputs: sellerProspectOutputs,
    href: "/tableau-de-bord/actions/prepare-first-seller-call",
    assistantSlug: "message-prospection",
    serviceSlugs: ["message-prospection"],
    serviceLabels: ["Scripts de premier contact et relances"],
  },
  {
    id: "prepare-market-analysis",
    label: "Préparer le rendez-vous vendeur",
    description: "Assembler l’analyse de marché, les questions et les arguments avant la rencontre.",
    context: "rendez-vous vendeur obtenu",
    primary: true,
    outputs: sellerAppointmentOutputs,
    href: "/tableau-de-bord/actions/prepare-market-analysis",
    serviceSlugs: ["message-prospection", "reponse-objection"],
    serviceLabels: ["Questions vendeur", "Arguments et objections", "Script de rendez-vous"],
  },
  {
    id: "prepare-evaluation-materials",
    label: "Structurer l’évaluation vendeur",
    description: "Consolider les comparables, les angles de présentation et les objections probables.",
    context: "evaluation en preparation",
    primary: true,
    outputs: sellerAppointmentOutputs,
    href: "/tableau-de-bord/actions/prepare-evaluation-materials",
    serviceSlugs: ["reponse-objection", "courriel-vendeur"],
    serviceLabels: ["Arguments vendeur", "Présentation et objections"],
  },
  {
    id: "market-property-followup",
    label: "Faire le suivi de mise en marché",
    description: "Préparer les suivis vendeur, les ajustements marketing et les messages après visites.",
    context: "propriete en marche",
    primary: true,
    outputs: ["Courriel vendeur", "Relance apres visite", "Ajustement publication", "Resume des reactions acheteurs"],
    href: "/tableau-de-bord/actions/market-property-followup",
    assistantSlug: "courriel-vendeur",
    serviceSlugs: ["courriel-vendeur", "publication-facebook"],
    serviceLabels: ["Suivi vendeur", "Ajustements marketing"],
  },
  {
    id: "qualify-buyer",
    label: "Qualifier un acheteur",
    description: "Préparer les questions, les critères et la prochaine étape.",
    context: "prospect acheteur",
    primary: true,
    outputs: ["Questions de qualification", "Texto de suivi", "Courriel recapitulatif", "Prochaine etape"],
    href: "/tableau-de-bord/actions/qualify-buyer",
    assistantSlug: "suivi-client",
    serviceSlugs: ["suivi-client"],
    serviceLabels: ["Qualification acheteur et suivi"],
  },
  {
    id: "buyer-search-plan",
    label: "Organiser la recherche acheteur",
    description: "Transformer les critères en plan de recherche et suivis de visites.",
    context: "contrat acheteur signe",
    primary: true,
    outputs: ["Plan de recherche", "Message nouvelles inscriptions", "Suivi apres visite", "Questions de priorisation"],
    href: "/tableau-de-bord/actions/buyer-search-plan",
    assistantSlug: "suivi-client",
    serviceSlugs: ["suivi-client"],
    serviceLabels: ["Plan de recherche et suivis"],
  },
  {
    id: "buyer-next-step",
    label: "Préparer la prochaine étape acheteur",
    description: "Clarifier le besoin et proposer une action simple.",
    context: "acheteur qualifie",
    primary: true,
    outputs: ["Message de qualification", "Questions ouvertes", "Suivi budget", "Invitation a discuter"],
    href: "/tableau-de-bord/actions/buyer-next-step",
    assistantSlug: "suivi-client",
    serviceSlugs: ["suivi-client"],
    serviceLabels: ["Message de qualification"],
  },
  {
    id: "general-prospecting",
    label: "Préparer une action de prospection",
    description: "Créer un message libre quand aucun client n’est encore sélectionné.",
    context: "prospection generale",
    primary: true,
    outputs: sellerProspectOutputs,
    href: "/tableau-de-bord/actions/general-prospecting",
    assistantSlug: "message-prospection",
    serviceSlugs: ["message-prospection"],
    serviceLabels: ["Prospection libre"],
  },
  {
    id: "client-followup",
    label: "Préparer un suivi client",
    description: "Créer une relance humaine et claire selon la situation du client.",
    context: "suivi client",
    primary: true,
    outputs: ["Texto de suivi", "Courriel de suivi", "Question de relance", "Prochaine action"],
    href: "/tableau-de-bord/actions/client-followup",
    assistantSlug: "suivi-client",
    serviceSlugs: ["suivi-client"],
    serviceLabels: ["Suivi client"],
  },
];

export function getContextualAiActions(context: AiActionContext) {
  return contextualActions.filter((action) => action.context === context);
}

export function getPrimaryContextualAiAction(context: AiActionContext) {
  return getContextualAiActions(context).find((action) => action.primary) ?? getContextualAiActions(context)[0];
}

export function getAllContextualAiActions() {
  return contextualActions;
}

export function getContextualAiActionById(id: string) {
  return contextualActions.find((action) => action.id === id);
}

export function getFeaturedContextualAiActions() {
  return [
    getPrimaryContextualAiAction("prospect vendeur"),
    getPrimaryContextualAiAction("rendez-vous vendeur obtenu"),
    getPrimaryContextualAiAction("mandat vendeur signe"),
    getPrimaryContextualAiAction("propriete vendue"),
  ].filter(Boolean) as ContextualAiAction[];
}

export function contextFromPipelineStatus(status: string, type: "seller" | "buyer"): AiActionContext {
  const normalizedStatus = normalizeStatus(status);

  if (type === "buyer") {
    if (status === officialBuyerWorkflow[3]) return "contrat acheteur signe";
    if (status === officialBuyerWorkflow[1] || status === officialBuyerWorkflow[2]) return "acheteur qualifie";
    if (status === officialBuyerWorkflow[9]) return "suivi client";
    if (normalizedStatus === "contrat acheteur signe") return "contrat acheteur signe";
    if (normalizedStatus === "qualification acheteur" || normalizedStatus === "preautorisation demandee") return "acheteur qualifie";
    if (normalizedStatus === "suivi apres achat") return "suivi client";
    return "prospect acheteur";
  }

  if (status === officialSellerWorkflow[7] || status === officialSellerWorkflow[8] || status === officialSellerWorkflow[9]) {
    return "mandat vendeur signe";
  }
  if (status === officialSellerWorkflow[14] || status === officialSellerWorkflow[15]) return "propriete vendue";
  if (status === officialSellerWorkflow[10] || status === officialSellerWorkflow[11] || status === officialSellerWorkflow[12] || status === officialSellerWorkflow[13]) return "propriete en marche";
  if (status === officialSellerWorkflow[3]) return "rendez-vous vendeur obtenu";
  if (status === officialSellerWorkflow[4] || status === officialSellerWorkflow[5] || status === officialSellerWorkflow[6]) return "evaluation en preparation";
  if (status === officialSellerWorkflow[0] || status === officialSellerWorkflow[1] || status === officialSellerWorkflow[2]) return "prospect vendeur";

  if (normalizedStatus === "mandat vendeur signe" || normalizedStatus === "documents vendeur a recevoir" || normalizedStatus === "preparation mise en marche") {
    return "mandat vendeur signe";
  }
  if (normalizedStatus === "vendu" || normalizedStatus === "suivi apres vente") return "propriete vendue";
  if (normalizedStatus === "en vente" || normalizedStatus === "promesse d'achat" || normalizedStatus === "conditions" || normalizedStatus === "notaire") return "propriete en marche";
  if (normalizedStatus === "rendez vous vendeur obtenu") return "rendez-vous vendeur obtenu";
  if (normalizedStatus === "preparation de l'analyse de marche" || normalizedStatus === "analyse de marche prete" || normalizedStatus === "rendez vous vendeur effectue") {
    return "evaluation en preparation";
  }
  if (normalizedStatus === "prospection" || normalizedStatus === "prospect vendeur" || normalizedStatus === "appel / qualification") return "prospect vendeur";

  return "suivi client";
}

function normalizeStatus(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
