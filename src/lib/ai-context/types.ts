export type AiContextSource = "radar" | "prospect" | "client" | "mandat" | "property" | "documents" | "manual";

export type AiPropertyContext = {
  source: AiContextSource;
  sourceLabel: string;
  address?: string;
  city?: string;
  propertyType?: string;
  price?: string;
  bedrooms?: string;
  bathrooms?: string;
  landArea?: string;
  livingArea?: string;
  yearBuilt?: string;
  garage?: string;
  pool?: string;
  highlights?: string;
  features?: string;
  notes?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  priority?: string;
  channel?: string;
  raw?: Record<string, string>;
};

export type AiContextSummary = {
  context: AiPropertyContext;
  foundFields: string[];
  missingFields: string[];
};

export type AssistantContextProfile = {
  slug: string;
  requiredFields: string[];
  fieldMap: Record<string, keyof AiPropertyContext | "featuresAndNotes" | "prospectionSummary">;
};
