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
};

export const aiActionContexts: Array<{ id: AiActionContext; label: string; description: string }> = [
  {
    id: "prospect vendeur",
    label: "Prospect vendeur",
    description: "Ouvrir une conversation naturelle et mener vers une estimation ou un rendez-vous.",
  },
  {
    id: "prospect acheteur",
    label: "Prospect acheteur",
    description: "Qualifier le besoin, clarifier le budget et proposer la prochaine etape.",
  },
  {
    id: "rendez-vous vendeur obtenu",
    label: "Rendez-vous vendeur obtenu",
    description: "Preparer l'analyse de marche avant la rencontre vendeur.",
  },
  {
    id: "evaluation en preparation",
    label: "Evaluation en preparation",
    description: "Structurer les comparables, les arguments et les questions de decouverte.",
  },
  {
    id: "mandat vendeur signe",
    label: "Mandat vendeur signe",
    description: "Generer toute la mise en marche sans ressaisir les informations du dossier.",
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
    label: "Generer la mise en marche",
    description: "Creer en une seule action les textes essentiels pour lancer le mandat vendeur signe.",
    context: "mandat vendeur signe",
    primary: true,
    outputs: marketingLaunchOutputs,
    href: "/tableau-de-bord/assistants/description-centris",
    assistantSlug: "description-centris",
  },
  {
    id: "generate-sold-campaign",
    label: "Generer campagne vendu",
    description: "Transformer la transaction conclue en contenus de preuve sociale et de relation client.",
    context: "propriete vendue",
    primary: true,
    outputs: soldCampaignOutputs,
    href: "/tableau-de-bord/assistants/publication-facebook",
    assistantSlug: "publication-facebook",
  },
  {
    id: "prepare-first-seller-call",
    label: "Preparer premier appel",
    description: "Creer un appel naturel, un texto, un courriel et les relances sans reveler la source du prospect.",
    context: "prospect vendeur",
    primary: true,
    outputs: sellerProspectOutputs,
    href: "/tableau-de-bord/assistants/message-prospection",
    assistantSlug: "message-prospection",
  },
  {
    id: "prepare-market-analysis",
    label: "Preparer analyse de marche",
    description: "Assembler l'analyse comparative, les arguments vendeur et les questions avant la rencontre.",
    context: "rendez-vous vendeur obtenu",
    primary: true,
    outputs: sellerAppointmentOutputs,
    href: "/tableau-de-bord/mandats",
  },
  {
    id: "prepare-evaluation-materials",
    label: "Structurer l'evaluation vendeur",
    description: "Consolider les comparables, angles de presentation et objections probables.",
    context: "evaluation en preparation",
    primary: true,
    outputs: sellerAppointmentOutputs,
    href: "/tableau-de-bord/mandats",
  },
  {
    id: "market-property-followup",
    label: "Preparer suivi de mise en marche",
    description: "Creer les suivis vendeur, ajustements marketing et messages apres visites.",
    context: "propriete en marche",
    primary: true,
    outputs: ["Courriel vendeur", "Relance apres visite", "Ajustement publication", "Resume des reactions acheteurs"],
    href: "/tableau-de-bord/assistants/courriel-vendeur",
    assistantSlug: "courriel-vendeur",
  },
  {
    id: "qualify-buyer",
    label: "Qualifier l'acheteur",
    description: "Preparer les questions de qualification, les criteres et le message de prochaine etape.",
    context: "prospect acheteur",
    primary: true,
    outputs: ["Questions de qualification", "Texto de suivi", "Courriel recapitulatif", "Prochaine etape"],
    href: "/tableau-de-bord/assistants/suivi-client",
    assistantSlug: "suivi-client",
  },
  {
    id: "buyer-search-plan",
    label: "Organiser la recherche acheteur",
    description: "Transformer les criteres en plan de recherche et suivis de visites.",
    context: "contrat acheteur signe",
    primary: true,
    outputs: ["Plan de recherche", "Message nouvelles inscriptions", "Suivi apres visite", "Questions de priorisation"],
    href: "/tableau-de-bord/assistants/suivi-client",
    assistantSlug: "suivi-client",
  },
  {
    id: "buyer-next-step",
    label: "Preparer prochaine etape acheteur",
    description: "Clarifier le besoin acheteur et proposer une action simple.",
    context: "acheteur qualifie",
    primary: true,
    outputs: ["Message de qualification", "Questions ouvertes", "Suivi budget", "Invitation a discuter"],
    href: "/tableau-de-bord/assistants/suivi-client",
    assistantSlug: "suivi-client",
  },
  {
    id: "general-prospecting",
    label: "Creer une action de prospection",
    description: "Generer un message libre quand aucun client n'est encore selectionne.",
    context: "prospection generale",
    primary: true,
    outputs: sellerProspectOutputs,
    href: "/tableau-de-bord/assistants/message-prospection",
    assistantSlug: "message-prospection",
  },
  {
    id: "client-followup",
    label: "Preparer un suivi client",
    description: "Creer une relance humaine et claire selon la situation du client.",
    context: "suivi client",
    primary: true,
    outputs: ["Texto de suivi", "Courriel de suivi", "Question de relance", "Prochaine action"],
    href: "/tableau-de-bord/assistants/suivi-client",
    assistantSlug: "suivi-client",
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
