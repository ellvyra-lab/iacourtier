export type BuyerSource = "manual" | "identity" | "preapproval" | "document" | "message";

export type BuyerContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
};

export type BuyerCriteriaInput = {
  budget: string;
  preapprovalStatus: string;
  sectors: string[];
  propertyType: string;
  bedrooms: string;
  importantNeeds: string;
  timeline: string;
  propertyToSell: boolean | null;
};

export const BUYER_TASK_TEMPLATES = [
  { category: "client", title: "Valider l’identité et les coordonnées de l’acheteur" },
  { category: "qualification", title: "Confirmer le budget, les secteurs et l’échéancier" },
  { category: "financement", title: "Obtenir ou valider la préapprobation" },
  { category: "recherche", title: "Configurer les critères de recherche" },
  { category: "service", title: "Remettre le guide acheteur personnalisé" },
] as const;

export const BUYER_AUTOMATION_TEMPLATES = [
  "Bienvenue acheteur",
  "Guide acheteur",
  "Préapprobation",
  "Critères de recherche",
  "Nouvelles propriétés",
  "Suivi des visites",
  "Offre",
  "Conditions",
  "Notaire",
  "Félicitations",
  "Demande d’avis",
  "Suivi post-transaction",
  "Renouvellement hypothécaire",
] as const;

export const BUYER_REQUIRED_FIELDS = [
  ["budget", "budget"],
  ["preapproval_status", "préapprobation"],
  ["sectors", "secteurs"],
  ["property_type", "type de propriété"],
  ["bedrooms", "chambres"],
  ["important_needs", "besoins importants"],
  ["timeline", "échéancier"],
  ["property_to_sell", "propriété actuelle à vendre ou non"],
] as const;

export function normalizeClientValue(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function buyerProgress(caseRow: Record<string, unknown>) {
  const completed = BUYER_REQUIRED_FIELDS.filter(([key]) => {
    const value = caseRow[key];
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "" && value !== "missing";
  }).length;
  return Math.round((completed / BUYER_REQUIRED_FIELDS.length) * 100);
}

export function buyerMissingFields(caseRow: Record<string, unknown>) {
  return BUYER_REQUIRED_FIELDS.filter(([key]) => {
    const value = caseRow[key];
    return Array.isArray(value) ? value.length === 0 : value === null || value === undefined || value === "" || value === "missing";
  }).map(([, label]) => label);
}
