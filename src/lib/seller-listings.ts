export type ListingFactStatus = "confirmed" | "to_confirm" | "missing";

export type ListingFact = {
  key: string;
  label: string;
  value: string;
  status: ListingFactStatus;
  sourceLabel: string;
  confidence?: number | null;
  note?: string;
};

export type SellerContactInput = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
};

export type ListingPropertyInput = {
  address: string;
  city: string;
  postalCode: string;
  propertyType: string;
  lotNumber: string;
};

export type ListingGeneratedContent = {
  listing: {
    publicDescription: string;
    shortDescription: string;
    addendum: string;
    highlights: string[];
    characteristics: string[];
    sellerSummary: string;
    validationPoints: string[];
    dossierChecklist: string[];
    marketingChecklist: string[];
  };
  marketing: {
    facebook: string;
    instagram: string;
    facebookStory: string[];
    instagramStory: string[];
    carousel: Array<{ title: string; text: string }>;
    comingSoon: string;
    newListing: string;
    openHouse: string;
    reelScript: string;
    presentationVideoScript: string;
    shortVideoScript: string;
    buyerEmail: string;
    brokerEmail: string;
    sms: string;
  };
};

export const EMPTY_GENERATED_CONTENT: ListingGeneratedContent = {
  listing: {
    publicDescription: "",
    shortDescription: "",
    addendum: "",
    highlights: [],
    characteristics: [],
    sellerSummary: "",
    validationPoints: [],
    dossierChecklist: [],
    marketingChecklist: [],
  },
  marketing: {
    facebook: "",
    instagram: "",
    facebookStory: [],
    instagramStory: [],
    carousel: [],
    comingSoon: "",
    newListing: "",
    openHouse: "",
    reelScript: "",
    presentationVideoScript: "",
    shortVideoScript: "",
    buyerEmail: "",
    brokerEmail: "",
    sms: "",
  },
};

export const LISTING_FACT_DEFINITIONS = [
  { key: "owners", label: "Propriétaire(s)", required: true, question: "Qui doit apparaître comme propriétaire et vendeur au dossier?" },
  { key: "address", label: "Adresse", required: true, question: "Quelle est l’adresse complète de la propriété?" },
  { key: "city", label: "Ville", required: true, question: "Dans quelle ville se trouve la propriété?" },
  { key: "postalCode", label: "Code postal", required: false, question: "Quel est le code postal?" },
  { key: "propertyType", label: "Type de propriété", required: true, question: "Quel est le type de propriété?" },
  { key: "lotNumber", label: "Numéro de lot", required: false, question: "Quel est le numéro de lot?" },
  { key: "dimensions", label: "Dimensions", required: false, question: "Quelles dimensions doivent être confirmées?" },
  { key: "landArea", label: "Superficie du terrain", required: false, question: "Quelle est la superficie du terrain?" },
  { key: "livingArea", label: "Superficie habitable", required: false, question: "Quelle est la superficie habitable?" },
  { key: "yearBuilt", label: "Année de construction", required: false, question: "Quelle est l’année de construction?" },
  { key: "bedrooms", label: "Chambres", required: false, question: "Combien de chambres peuvent être annoncées?" },
  { key: "bathrooms", label: "Salles de bain", required: false, question: "Combien de salles de bain peuvent être annoncées?" },
  { key: "municipalTaxes", label: "Taxes municipales", required: false, question: "Quel est le montant et l’année des taxes municipales?" },
  { key: "schoolTaxes", label: "Taxes scolaires", required: false, question: "Quel est le montant et l’année des taxes scolaires?" },
  { key: "municipalAssessment", label: "Évaluation municipale", required: false, question: "Quelle évaluation municipale doit être utilisée?" },
  { key: "servitudes", label: "Servitudes", required: false, question: "Y a-t-il des servitudes à valider?" },
  { key: "mortgage", label: "Hypothèque pertinente", required: false, question: "Une information hypothécaire doit-elle être confirmée?" },
  { key: "renovations", label: "Rénovations documentées", required: false, question: "Quelles rénovations sont appuyées par une facture ou une déclaration validée?" },
  { key: "features", label: "Caractéristiques documentées", required: false, question: "Quelles caractéristiques de la propriété peuvent être confirmées?" },
  { key: "certificateInfo", label: "Certificat de localisation", required: false, question: "Quelles informations du certificat doivent être validées?" },
  { key: "sellerDeclaration", label: "Déclaration du vendeur", required: false, question: "Quels éléments de la déclaration du vendeur restent à confirmer?" },
  { key: "acquisitionDate", label: "Date d’acquisition", required: false, question: "Quelle est la date d’acquisition indiquée dans l’acte?" },
  { key: "acquisitionPrice", label: "Prix d’acquisition", required: false, question: "Quel est le prix d’acquisition indiqué dans l’acte?" },
  { key: "notary", label: "Notaire", required: false, question: "Quel notaire a reçu l’acte?" },
  { key: "buildings", label: "Bâtiments", required: false, question: "Quels bâtiments sont montrés au certificat de localisation?" },
  { key: "garage", label: "Garage", required: false, question: "La présence et le type de garage doivent-ils être confirmés?" },
  { key: "pool", label: "Piscine", required: false, question: "La présence et le type de piscine doivent-ils être confirmés?" },
  { key: "encroachments", label: "Empiètements", required: false, question: "Le certificat relève-t-il un empiètement?" },
  { key: "askingPrice", label: "Prix demandé", required: true, question: "Quel prix demandé a été convenu?" },
  { key: "marketDate", label: "Date de mise en marché", required: false, question: "Quelle est la date prévue de mise en marché?" },
  { key: "occupancyDate", label: "Date d’occupation", required: true, question: "Quelle date ou modalité d’occupation doit être publiée?" },
  { key: "availability", label: "Disponibilité", required: false, question: "Quel délai ou quelle modalité de disponibilité est prévu?" },
  { key: "conditions", label: "Conditions", required: false, question: "Quelles conditions contractuelles utiles doivent être validées?" },
  { key: "inclusions", label: "Inclusions", required: false, question: "Quelles inclusions sont prévues au contrat?" },
  { key: "exclusions", label: "Exclusions", required: false, question: "Quelles exclusions sont prévues au contrat?" },
  { key: "modifiedInfo", label: "Informations modifiées", required: false, question: "Quelles informations ont été modifiées au contrat?" },
  { key: "importantInfo", label: "Remarques importantes", required: false, question: "Quelles mentions importantes du dossier doivent être validées?" },
] as const;

export const SELLER_AUTOMATION_TEMPLATES = [
  "Bienvenue vendeur",
  "Documents manquants",
  "Préparation de la mise en marché",
  "Rappels avant mise en ligne",
  "Suivi des visites",
  "Compte rendu vendeur",
  "Changement de prix",
  "Offre reçue",
  "Conditions",
  "Transaction complétée",
  "Demande d’avis",
  "Suivi post-transaction",
  "Anniversaire de transaction",
  "Fidélisation long terme",
] as const;

export const SELLER_TASK_TEMPLATES = [
  { category: "dossier", title: "Valider l’identité et les coordonnées de tous les vendeurs" },
  { category: "dossier", title: "Obtenir et valider les documents manquants" },
  { category: "inscription", title: "Confirmer le prix, l’occupation et les éléments juridiques" },
  { category: "inscription", title: "Relire la description et l’addenda avant publication" },
  { category: "photos", title: "Choisir la photo principale et l’ordre de diffusion" },
  { category: "marketing", title: "Valider les contenus de lancement" },
] as const;

export const DOCUMENT_TYPES = [
  "Acte de vente",
  "Certificat de localisation",
  "Modification",
  "Contrat",
  "Déclaration du vendeur",
  "Taxes",
  "Taxes municipales",
  "Taxes scolaires",
  "Acte ou prêt hypothécaire",
  "Fiche descriptive",
  "Plans",
  "Rapport d’inspection",
  "Factures de rénovations",
  "Photos",
  "Autre",
] as const;

export const PHOTO_CATEGORIES = [
  { value: "facade", label: "Façade" },
  { value: "kitchen", label: "Cuisine" },
  { value: "living_room", label: "Salon" },
  { value: "bedroom", label: "Chambre" },
  { value: "bathroom", label: "Salle de bain" },
  { value: "outdoor", label: "Extérieur" },
  { value: "other", label: "Autre" },
] as const;

export function normalizeForDuplicate(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function calculateListingReadiness({
  facts,
  hasSeller,
  hasCover,
  completedTasks,
  totalTasks,
}: {
  facts: ListingFact[];
  hasSeller: boolean;
  hasCover: boolean;
  completedTasks: number;
  totalTasks: number;
}) {
  const required = LISTING_FACT_DEFINITIONS.filter((definition) => definition.required);
  const confirmedRequired = required.filter((definition) =>
    facts.some((fact) => fact.key === definition.key && fact.status === "confirmed" && fact.value.trim()),
  ).length;
  const factsScore = required.length ? confirmedRequired / required.length : 0;
  const taskScore = totalTasks ? completedTasks / totalTasks : 0;
  const score = Math.round((factsScore * 0.65 + (hasSeller ? 0.15 : 0) + (hasCover ? 0.1 : 0) + taskScore * 0.1) * 100);
  return Math.max(0, Math.min(100, score));
}

export function questionsForMissingFacts(facts: ListingFact[]) {
  return LISTING_FACT_DEFINITIONS
    .filter((definition) => !facts.some((fact) => fact.key === definition.key && fact.status === "confirmed" && fact.value.trim()))
    .map((definition) => ({ key: definition.key, label: definition.label, question: definition.question, required: definition.required }));
}

export function normalizeGeneratedContent(value: unknown): ListingGeneratedContent {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const listing = source.listing && typeof source.listing === "object" ? source.listing as Record<string, unknown> : {};
  const marketing = source.marketing && typeof source.marketing === "object" ? source.marketing as Record<string, unknown> : {};
  const text = (record: Record<string, unknown>, key: string) => typeof record[key] === "string" ? record[key] as string : "";
  const strings = (record: Record<string, unknown>, key: string) => Array.isArray(record[key]) ? (record[key] as unknown[]).map(String).filter(Boolean) : [];
  const carousel = Array.isArray(marketing.carousel)
    ? marketing.carousel.map((item) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { title: String(record.title || ""), text: String(record.text || "") };
      }).filter((item) => item.title || item.text)
    : [];
  return {
    listing: {
      publicDescription: text(listing, "publicDescription"),
      shortDescription: text(listing, "shortDescription"),
      addendum: text(listing, "addendum"),
      highlights: strings(listing, "highlights"),
      characteristics: strings(listing, "characteristics"),
      sellerSummary: text(listing, "sellerSummary"),
      validationPoints: strings(listing, "validationPoints"),
      dossierChecklist: strings(listing, "dossierChecklist"),
      marketingChecklist: strings(listing, "marketingChecklist"),
    },
    marketing: {
      facebook: text(marketing, "facebook"),
      instagram: text(marketing, "instagram"),
      facebookStory: strings(marketing, "facebookStory"),
      instagramStory: strings(marketing, "instagramStory"),
      carousel,
      comingSoon: text(marketing, "comingSoon"),
      newListing: text(marketing, "newListing"),
      openHouse: text(marketing, "openHouse"),
      reelScript: text(marketing, "reelScript"),
      presentationVideoScript: text(marketing, "presentationVideoScript"),
      shortVideoScript: text(marketing, "shortVideoScript"),
      buyerEmail: text(marketing, "buyerEmail"),
      brokerEmail: text(marketing, "brokerEmail"),
      sms: text(marketing, "sms"),
    },
  };
}
