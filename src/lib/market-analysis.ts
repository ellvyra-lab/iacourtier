import type { Mandat } from "@/lib/mandats";

export const analysisObjectives = [
  "Préparer une rencontre vendeur",
  "Justifier un prix demandé",
  "Répondre à une objection",
  "Préparer une baisse de prix",
  "Créer un résumé client",
] as const;

export const analysisStyles = ["Professionnel", "Simple", "Persuasif", "Très détaillé"] as const;

export type MarketSubjectProperty = {
  id: string;
  address: string;
  city: string;
  propertyType: string;
  askingPrice: string;
  bedrooms: string;
  bathrooms: string;
  livingArea: string;
  landArea: string;
  yearBuilt: string;
  highlights: string;
};

export type MarketComparable = {
  address: string;
  city: string;
  price: string;
  saleDate: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  livingArea: string;
  landArea: string;
  yearBuilt: string;
  garage: string;
  pool: string;
  brokerNotes: string;
  strengths: string;
  weaknesses: string;
};

export type MarketAnalysisInput = {
  mandatId: string;
  subjectProperty: MarketSubjectProperty;
  comparables: MarketComparable[];
  objective: string;
  style: string;
};

export type MarketAnalysisRecord = {
  id: string;
  user_id?: string | null;
  mandat_id: string | null;
  source_type?: string | null;
  file_name?: string | null;
  extracted_text?: string | null;
  subject_property?: MarketSubjectProperty | null;
  comparables?: MarketComparable[] | null;
  objective?: string | null;
  style?: string | null;
  generated_text: string;
  created_at: string;
};

export const emptyComparable: MarketComparable = {
  address: "",
  city: "",
  price: "",
  saleDate: "",
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  livingArea: "",
  landArea: "",
  yearBuilt: "",
  garage: "",
  pool: "",
  brokerNotes: "",
  strengths: "",
  weaknesses: "",
};

export function mandatToSubjectProperty(mandat: Mandat): MarketSubjectProperty {
  return {
    id: mandat.id,
    address: mandat.address || "",
    city: mandat.city || "",
    propertyType: mandat.property_type || "Propriété",
    askingPrice: mandat.asking_price || "",
    bedrooms: mandat.bedrooms || "",
    bathrooms: mandat.bathrooms || "",
    livingArea: mandat.living_area || "",
    landArea: mandat.land_area || "",
    yearBuilt: mandat.year_built || "",
    highlights: mandat.highlights || "",
  };
}

export function buildMarketAnalysisPrompt(input: MarketAnalysisInput) {
  const subject = input.subjectProperty;
  const comparables = input.comparables
    .map((comparable, index) =>
      [
        `Comparable ${index + 1}`,
        `Adresse: ${comparable.address}`,
        `Ville: ${comparable.city}`,
        `Prix vendu ou demandé: ${comparable.price}`,
        `Date de vente: ${comparable.saleDate || "Non précisée"}`,
        `Type: ${comparable.propertyType}`,
        `Chambres: ${comparable.bedrooms || "Non précisé"}`,
        `Salles de bain: ${comparable.bathrooms || "Non précisé"}`,
        `Superficie habitable: ${comparable.livingArea || "Non précisée"}`,
        `Superficie terrain: ${comparable.landArea || "Non précisée"}`,
        `Année de construction: ${comparable.yearBuilt || "Non précisée"}`,
        `Garage: ${comparable.garage || "Non précisé"}`,
        `Piscine: ${comparable.pool || "Non précisée"}`,
        `Notes du courtier: ${comparable.brokerNotes || "Aucune note"}`,
        `Forces: ${comparable.strengths || "Non précisées"}`,
        `Faiblesses: ${comparable.weaknesses || "Non précisées"}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "Propriété à analyser",
    `Adresse: ${subject.address}`,
    `Ville: ${subject.city}`,
    `Type: ${subject.propertyType}`,
    `Prix demandé: ${subject.askingPrice || "Non précisé"}`,
    `Chambres: ${subject.bedrooms || "Non précisé"}`,
    `Salles de bain: ${subject.bathrooms || "Non précisé"}`,
    `Superficie habitable: ${subject.livingArea || "Non précisée"}`,
    `Terrain: ${subject.landArea || "Non précisé"}`,
    `Année de construction: ${subject.yearBuilt || "Non précisée"}`,
    `Points forts: ${subject.highlights || "Non précisés"}`,
    "",
    `Objectif de l'analyse: ${input.objective}`,
    `Style souhaité: ${input.style}`,
    "",
    "Comparables fournis par le courtier",
    comparables,
  ].join("\n");
}

export const marketAnalysisSystemPrompt = `Tu es un courtier immobilier d'expérience au Québec spécialisé en analyse comparative de marché.

Tu aides à structurer une analyse à partir des données fournies par le courtier.

Règles importantes :
- Ne jamais inventer de données.
- Ne jamais créer de comparables absents.
- Ne jamais garantir une valeur marchande.
- Toujours indiquer que l'analyse doit être validée par le courtier.
- Utiliser un français québécois professionnel.
- Expliquer clairement les différences entre la propriété et les comparables.
- Présenter les forces, les faiblesses et les éléments à surveiller.
- Proposer une stratégie de présentation au vendeur.
- Préparer les objections possibles.

Structure le résultat avec ces sections :
1. Résumé de la propriété
2. Résumé des comparables
3. Comparables les plus pertinents
4. Éléments favorables à la valeur
5. Éléments pouvant limiter la valeur
6. Fourchette de positionnement suggérée si les données sont suffisantes
7. Arguments pour le vendeur
8. Objections possibles et réponses
9. Recommandation de stratégie
10. Note de prudence : validation professionnelle requise`;
