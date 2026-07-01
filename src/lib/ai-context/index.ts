import type { AiContextSource, AiContextSummary, AiPropertyContext, AssistantContextProfile } from "./types";

export type { AiContextSource, AiContextSummary, AiPropertyContext, AssistantContextProfile } from "./types";

export const contextAwareAssistantSlugs = [
  "description-centris",
  "publication-facebook",
  "message-prospection",
  "plan-marketing",
  "script-video",
] as const;

export const assistantContextProfiles: Record<string, AssistantContextProfile> = {
  "description-centris": {
    slug: "description-centris",
    requiredFields: ["propertyType", "city", "features"],
    fieldMap: {
      type: "propertyType",
      ville: "city",
      caracteristiques: "featuresAndNotes",
      public: "notes",
    },
  },
  "publication-facebook": {
    slug: "publication-facebook",
    requiredFields: ["address", "city", "propertyType", "features"],
    fieldMap: {
      sujet: "propertyType",
      details: "featuresAndNotes",
      ton: "notes",
    },
  },
  "message-prospection": {
    slug: "message-prospection",
    requiredFields: ["address", "city", "propertyType"],
    fieldMap: {
      type_prospect: "prospectionSummary",
      canal: "channel",
    },
  },
  "plan-marketing": {
    slug: "plan-marketing",
    requiredFields: ["address", "city", "propertyType"],
    fieldMap: {
      propriete: "featuresAndNotes",
      contexte: "notes",
      objectif: "notes",
    },
  },
  "script-video": {
    slug: "script-video",
    requiredFields: ["address", "city", "propertyType", "features"],
    fieldMap: {
      propriete: "featuresAndNotes",
      points_forts: "highlights",
    },
  },
};

export function isContextAwareAssistant(slug: string) {
  return Boolean(assistantContextProfiles[slug]);
}

export function summarizeAiContext(context: AiPropertyContext, slug: string): AiContextSummary {
  const profile = assistantContextProfiles[slug];
  const foundFields = readableContextFields.filter((item) => Boolean(String(context[item.key] || "").trim())).map((item) => item.label);
  const missingFields = (profile?.requiredFields ?? [])
    .filter((field) => !String(context[field as keyof AiPropertyContext] || "").trim())
    .map((field) => requiredFieldLabels[field] || field);

  return {
    context,
    foundFields,
    missingFields,
  };
}

export function valuesFromAiContext(slug: string, context: AiPropertyContext) {
  const profile = assistantContextProfiles[slug];
  if (!profile) return {};

  return Object.fromEntries(
    Object.entries(profile.fieldMap).map(([fieldName, contextKey]) => [fieldName, valueForField(context, contextKey)]),
  );
}

export function buildContextPrompt(context: AiPropertyContext) {
  return [
    `Source du contexte : ${context.sourceLabel}`,
    context.contactName ? `Contact : ${context.contactName}` : "",
    context.address ? `Adresse : ${context.address}` : "",
    context.city ? `Ville : ${context.city}` : "",
    context.propertyType ? `Type : ${context.propertyType}` : "",
    context.price ? `Prix : ${context.price}` : "",
    context.bedrooms ? `Chambres : ${context.bedrooms}` : "",
    context.bathrooms ? `Salles de bain : ${context.bathrooms}` : "",
    context.livingArea ? `Superficie habitable : ${context.livingArea}` : "",
    context.landArea ? `Terrain : ${context.landArea}` : "",
    context.yearBuilt ? `Année : ${context.yearBuilt}` : "",
    context.garage ? `Garage : ${context.garage}` : "",
    context.pool ? `Piscine : ${context.pool}` : "",
    context.highlights ? `Points forts : ${context.highlights}` : "",
    context.features ? `Caractéristiques : ${context.features}` : "",
    context.notes ? `Notes : ${context.notes}` : "",
    "Ne jamais inventer une caractéristique absente du contexte ou du formulaire.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function contextFromSearchParams(params: Record<string, string | string[] | undefined> | undefined): AiPropertyContext | null {
  const source = readParam(params, "context") || readParam(params, "sourceContext");
  if (!source) return null;

  return normalizeAiContext({
    source: normalizeSource(source),
    sourceLabel: sourceLabel(normalizeSource(source)),
    address: readParam(params, "address"),
    city: readParam(params, "city"),
    propertyType: readParam(params, "propertyType") || readParam(params, "type"),
    price: readParam(params, "price"),
    bedrooms: readParam(params, "bedrooms"),
    bathrooms: readParam(params, "bathrooms"),
    landArea: readParam(params, "landArea") || readParam(params, "terrain"),
    livingArea: readParam(params, "livingArea") || readParam(params, "superficie"),
    yearBuilt: readParam(params, "yearBuilt") || readParam(params, "year"),
    garage: readParam(params, "garage"),
    pool: readParam(params, "pool"),
    highlights: readParam(params, "highlights"),
    features: readParam(params, "features"),
    notes: readParam(params, "notes") || readParam(params, "reason"),
    contactName: readParam(params, "name"),
    phone: readParam(params, "phone"),
    email: readParam(params, "email"),
    priority: readParam(params, "priority"),
    channel: readParam(params, "channel") || "Appel téléphonique",
    raw: {
      score: readParam(params, "score"),
      status: readParam(params, "status"),
      source: readParam(params, "source"),
    },
  });
}

export function contextFromExtractedDocuments(fields: Record<string, string>, fileNames: string[]): AiPropertyContext {
  return normalizeAiContext({
    source: "documents",
    sourceLabel: "Documents uploadés",
    address: fields.address,
    city: fields.city,
    propertyType: fields.propertyType,
    landArea: fields.landArea,
    livingArea: fields.livingArea,
    yearBuilt: fields.yearBuilt,
    garage: fields.garage,
    pool: fields.pool,
    features: [fields.lotNumber ? `Lot ${fields.lotNumber}` : "", fields.cadastre ? `Cadastre ${fields.cadastre}` : "", fields.zoning ? `Zonage ${fields.zoning}` : ""]
      .filter(Boolean)
      .join(", "),
    notes: [fields.importantInfo, fields.missingInfo ? `Informations manquantes : ${fields.missingInfo}` : "", fileNames.length ? `Documents : ${fileNames.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n"),
  });
}

export function mergeAiContexts(base: AiPropertyContext | null, patch: AiPropertyContext): AiPropertyContext {
  return normalizeAiContext({
    ...(base ?? {}),
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => (typeof value === "string" ? value.trim() : value))),
    source: patch.source,
    sourceLabel: patch.sourceLabel,
    raw: { ...(base?.raw ?? {}), ...(patch.raw ?? {}) },
  });
}

function normalizeAiContext(context: AiPropertyContext): AiPropertyContext {
  return {
    ...context,
    source: context.source || "manual",
    sourceLabel: context.sourceLabel || sourceLabel(context.source || "manual"),
  };
}

function valueForField(context: AiPropertyContext, key: keyof AiPropertyContext | "featuresAndNotes" | "prospectionSummary") {
  if (key === "featuresAndNotes") {
    return [
      context.address ? `Adresse : ${context.address}` : "",
      context.city ? `Ville : ${context.city}` : "",
      context.propertyType ? `Type : ${context.propertyType}` : "",
      context.bedrooms ? `Chambres : ${context.bedrooms}` : "",
      context.bathrooms ? `Salles de bain : ${context.bathrooms}` : "",
      context.livingArea ? `Superficie habitable : ${context.livingArea}` : "",
      context.landArea ? `Terrain : ${context.landArea}` : "",
      context.yearBuilt ? `Année : ${context.yearBuilt}` : "",
      context.garage ? `Garage : ${context.garage}` : "",
      context.pool ? `Piscine : ${context.pool}` : "",
      context.highlights ? `Points forts : ${context.highlights}` : "",
      context.features ? `Caractéristiques : ${context.features}` : "",
      context.notes ? `Notes : ${context.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (key === "prospectionSummary") {
    return [
      context.contactName ? `Contact : ${context.contactName}` : "",
      context.address ? `Adresse : ${context.address}` : "",
      context.city ? `Ville : ${context.city}` : "",
      context.propertyType ? `Type de propriété : ${context.propertyType}` : "",
      context.priority ? `Priorité interne : ${context.priority}` : "",
      context.notes ? `Notes internes : ${context.notes}` : "",
      context.phone ? `Téléphone disponible` : "",
      context.email ? `Courriel disponible` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return String(context[key] || "");
}

function readParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeSource(value: string): AiContextSource {
  if (["radar", "prospect", "client", "mandat", "property", "documents"].includes(value)) return value as AiContextSource;
  return "manual";
}

function sourceLabel(source: AiContextSource) {
  const labels: Record<AiContextSource, string> = {
    radar: "Radar",
    prospect: "Prospect",
    client: "Client",
    mandat: "Mandat",
    property: "Propriété",
    documents: "Documents uploadés",
    manual: "Manuel",
  };
  return labels[source];
}

const readableContextFields: Array<{ key: keyof AiPropertyContext; label: string }> = [
  { key: "address", label: "adresse" },
  { key: "city", label: "ville" },
  { key: "propertyType", label: "type de propriété" },
  { key: "price", label: "prix" },
  { key: "bedrooms", label: "chambres" },
  { key: "bathrooms", label: "salles de bain" },
  { key: "landArea", label: "terrain" },
  { key: "livingArea", label: "superficie" },
  { key: "yearBuilt", label: "année" },
  { key: "garage", label: "garage" },
  { key: "pool", label: "piscine" },
  { key: "highlights", label: "points forts" },
  { key: "features", label: "caractéristiques" },
  { key: "notes", label: "notes" },
];

const requiredFieldLabels: Record<string, string> = {
  address: "adresse",
  city: "ville",
  propertyType: "type de propriété",
  features: "caractéristiques connues",
};
