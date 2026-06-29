export const propertyTypes = ["Maison", "Condo", "Chalet", "Terrain", "Plex", "Commercial"] as const;
export const writingStyles = ["Familial", "Haut de gamme", "Moderne", "Chaleureux", "Investisseur", "Neutre"] as const;
export const descriptionLengths = ["Courte", "Moyenne", "Longue"] as const;

export type PropertyDescriptionForm = {
  propertyType: string;
  city: string;
  address?: string;
  price?: string;
  constructionYear?: string;
  bedrooms?: string;
  bathrooms?: string;
  livingArea?: string;
  lotArea?: string;
  garage: boolean;
  parking?: string;
  pool: boolean;
  basement: boolean;
  fireplace: boolean;
  airConditioning: boolean;
  highlights: string;
  style: string;
  length: string;
};

export function buildUserPrompt(input: PropertyDescriptionForm) {
  const features = [
    input.garage ? "Garage" : null,
    input.parking ? `${input.parking} stationnement(s)` : null,
    input.pool ? "Piscine" : null,
    input.basement ? "Sous-sol" : null,
    input.fireplace ? "Foyer" : null,
    input.airConditioning ? "Air climatise" : null,
  ].filter(Boolean);

  return [
    `Type de propriete: ${input.propertyType}`,
    `Ville: ${input.city}`,
    input.address ? `Adresse: ${input.address}` : null,
    input.price ? `Prix demande: ${input.price} $ CA` : null,
    input.constructionYear ? `Annee de construction: ${input.constructionYear}` : null,
    input.bedrooms ? `Chambres: ${input.bedrooms}` : null,
    input.bathrooms ? `Salles de bain: ${input.bathrooms}` : null,
    input.livingArea ? `Superficie habitable: ${input.livingArea}` : null,
    input.lotArea ? `Superficie du terrain: ${input.lotArea}` : null,
    features.length ? `Caracteristiques: ${features.join(", ")}` : null,
    input.highlights ? `Points forts fournis par le courtier: ${input.highlights}` : null,
    `Style souhaite: ${input.style}`,
    `Longueur souhaitee: ${input.length}`,
  ]
    .filter(Boolean)
    .join("\n");
}
