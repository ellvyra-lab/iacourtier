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
  aboveGroundBedrooms: string;
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
  aboveGroundBedrooms: "",
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
        `Chambres hors sol: ${comparable.aboveGroundBedrooms || "Non détecté"}`,
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

Tu aides à structurer une vraie analyse comparative de marché à partir des données fournies par le courtier. Tu ne fais pas un simple résumé. Tu compares chaque comparable avec la propriété sujet, tu évalues sa pertinence réelle et tu expliques les ajustements qualitatifs.

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
- Si une donnée manque, écrire "non détecté".
- Analyser les chambres hors sol séparément des chambres totales, car elles influencent fortement la valeur.

Compare chaque comparable selon :
- secteur / proximité;
- type de propriété;
- date de vente;
- prix vendu;
- chambres totales;
- chambres hors sol;
- salles de bain;
- garage;
- piscine;
- superficie habitable;
- superficie terrain;
- année de construction;
- rénovations;
- condition générale;
- particularités importantes.

Attribue à chaque comparable une cote de similarité :
- Très pertinent;
- Pertinent;
- À utiliser avec prudence;
- Peu comparable.

Explique les ajustements qualitatifs : garage vs aucun garage, terrain plus grand ou plus petit, chambre hors sol supplémentaire, rénovation, date de vente, secteur, superficie et condition générale.

Structure le résultat avec ces sections :
1. Résumé de la propriété sujet
2. Tableau des comparables détectés
3. Grille de similarité
4. Comparables les plus fiables
5. Comparables à utiliser avec prudence
6. Ajustements qualitatifs
7. Fourchette de valeur suggérée si les données sont suffisantes
8. Prix de mise en marché recommandé si les données sont suffisantes
9. Arguments à présenter au vendeur
10. Objections probables du vendeur et réponses
11. Note de prudence : validation professionnelle requise

Utilise des tableaux Markdown pour le tableau des comparables et la grille de similarité. Si les données sont insuffisantes pour une fourchette ou un prix recommandé, écris clairement que les données sont insuffisantes plutôt que de deviner.`;
