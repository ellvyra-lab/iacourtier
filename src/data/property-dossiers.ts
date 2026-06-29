export type PropertyDossier = {
  id: string;
  address: string;
  city: string;
  type: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  lot: string;
  pool: boolean;
  garage: boolean;
  description: string;
  characteristics: string[];
  neighborhood: string;
  schools: string;
  transport: string;
  particularities: string[];
  updatedAt: string;
};

export const propertyDossierFields = [
  "Adresse",
  "Ville",
  "Type",
  "Prix",
  "Chambres",
  "Salle de bain",
  "Terrain",
  "Piscine",
  "Garage",
  "Description",
  "Caractéristiques",
  "Quartier",
  "Écoles",
  "Transport",
  "Particularités",
] as const;

export const propertyDossiers: PropertyDossier[] = [
  {
    id: "verdun-wellington",
    address: "1245 rue Wellington",
    city: "Montréal",
    type: "Condo",
    price: "689 000 $",
    bedrooms: "2",
    bathrooms: "1",
    lot: "N/A",
    pool: false,
    garage: true,
    description: "Condo lumineux situé près des commerces, des transports et du bord de l'eau.",
    characteristics: ["Aire ouverte", "Cuisine rénovée", "Balcon privé", "Garage intérieur"],
    neighborhood: "Verdun, secteur Wellington",
    schools: "Écoles primaires et secondaires à proximité",
    transport: "Métro, autobus, pistes cyclables et accès rapide au centre-ville",
    particularities: ["Copropriété bien administrée", "Excellente luminosité", "Secteur recherché"],
    updatedAt: "2026-06-28",
  },
  {
    id: "boucherville-familiale",
    address: "88 rue des Sorbiers",
    city: "Boucherville",
    type: "Maison",
    price: "849 000 $",
    bedrooms: "4",
    bathrooms: "2 + 1",
    lot: "6 800 pi²",
    pool: true,
    garage: true,
    description: "Maison familiale avec cour intime, piscine et espaces de vie bien divisés.",
    characteristics: ["Cour aménagée", "Piscine creusée", "Sous-sol familial", "Garage attaché"],
    neighborhood: "Secteur résidentiel paisible",
    schools: "Écoles, parcs et services familiaux accessibles rapidement",
    transport: "Accès aux grands axes routiers et transport collectif régional",
    particularities: ["Idéale pour une famille", "Rénovations récentes", "Terrain généreux"],
    updatedAt: "2026-06-27",
  },
  {
    id: "quebec-investissement",
    address: "532 3e Avenue",
    city: "Québec",
    type: "Plex",
    price: "735 000 $",
    bedrooms: "6",
    bathrooms: "3",
    lot: "4 200 pi²",
    pool: false,
    garage: false,
    description: "Plex bien situé avec potentiel d'optimisation et revenus à documenter.",
    characteristics: ["Trois logements", "Entrées indépendantes", "Stationnements extérieurs"],
    neighborhood: "Quartier central avec services à distance de marche",
    schools: "Institutions scolaires et services de proximité dans le secteur",
    transport: "Transport en commun et accès rapide aux artères principales",
    particularities: ["Profil investisseur", "Données financières à valider", "Potentiel locatif"],
    updatedAt: "2026-06-26",
  },
];

export function getPropertyDossierById(id: string) {
  return propertyDossiers.find((dossier) => dossier.id === id);
}

export function buildPropertyAssistantContext(dossier: PropertyDossier) {
  return {
    address: dossier.address,
    city: dossier.city,
    type: dossier.type,
    price: dossier.price,
    bedrooms: dossier.bedrooms,
    bathrooms: dossier.bathrooms,
    lot: dossier.lot,
    pool: dossier.pool,
    garage: dossier.garage,
    description: dossier.description,
    characteristics: dossier.characteristics,
    neighborhood: dossier.neighborhood,
    schools: dossier.schools,
    transport: dossier.transport,
    particularities: dossier.particularities,
  };
}
