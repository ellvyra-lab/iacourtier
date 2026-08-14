import { LISTING_FACT_DEFINITIONS, type ListingFact, type ListingFactStatus } from "@/lib/seller-listings";

export type ExtractedSeller = {
  firstName: string;
  lastName: string;
  mailingAddress: string;
  phone: string;
  email: string;
  roles?: Array<"buyer" | "seller" | "investor" | "owner">;
};

export type ExtractedBuyer = ExtractedSeller;

export type ExtractedMandateFields = {
  address: string;
  city: string;
  postalCode: string;
  owners: string;
  sellers: ExtractedSeller[];
  buyers: ExtractedBuyer[];
  transactionType: string;
  lotNumber: string;
  cadastre: string;
  propertyType: string;
  dimensions: string;
  landArea: string;
  livingArea: string;
  yearBuilt: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  zoning: string;
  servitudes: string;
  pool: string;
  garage: string;
  fireplace: string;
  municipalTaxes: string;
  schoolTaxes: string;
  municipalAssessment: string;
  mortgageLender: string;
  mortgageDate: string;
  mortgageAmount: string;
  mortgageMaturity: string;
  renovations: string;
  features: string;
  certificateInfo: string;
  sellerDeclaration: string;
  askingPrice: string;
  marketDate: string;
  occupancyDate: string;
  availability: string;
  importantInfo: string;
  missingInfo: string;
};

export const emptyExtractedMandateFields: ExtractedMandateFields = {
  address: "", city: "", postalCode: "", owners: "", sellers: [], buyers: [], transactionType: "", lotNumber: "", cadastre: "",
  propertyType: "", dimensions: "", landArea: "", livingArea: "", yearBuilt: "", bedrooms: "",
  bathrooms: "", parking: "", zoning: "", servitudes: "", pool: "", garage: "", fireplace: "",
  municipalTaxes: "", schoolTaxes: "", municipalAssessment: "", mortgageLender: "", mortgageDate: "",
  mortgageAmount: "", mortgageMaturity: "", renovations: "", features: "", certificateInfo: "", sellerDeclaration: "",
  askingPrice: "", marketDate: "", occupancyDate: "", availability: "", importantInfo: "", missingInfo: "",
};

export type ExtractedDocumentClassification = {
  name: string;
  type: string;
};

export type MandateDocumentExtractionResponse = {
  fields: ExtractedMandateFields;
  facts: ListingFact[];
  documentTypes: ExtractedDocumentClassification[];
  fileNames: string[];
  extractedTextPreview: string;
};

export const mandateDocumentExtractionSystemPrompt = `Tu es un moteur d'extraction documentaire structurée pour courtiers immobiliers au Québec.

Analyse uniquement ce qui est réellement visible dans les documents fournis (actes, certificats, déclarations, taxes, évaluations, inspections, plans, factures et photos).

Règles absolues :
- Ne jamais inventer, compléter par vraisemblance ou déduire une donnée absente.
- Une donnée claire et non contradictoire peut être "confirmed".
- Une donnée ambiguë, peu lisible ou contradictoire doit être "to_confirm" et expliquer le doute dans "note".
- Si une information n'est pas trouvée, retourner une chaîne vide; ne pas fabriquer de valeur "inconnue".
- Chaque fait non vide doit nommer exactement le document source dans "sourceLabel".
- Conserver les montants, unités et dates tels qu'ils apparaissent.
- Distinguer vendeurs/propriétaires, acheteurs, témoins, notaires et créanciers. Un témoin, notaire ou créancier n'est jamais un client.
- Retourner uniquement un objet JSON valide, sans Markdown.

Structure obligatoire :
{
  "fields": {
    "address":"", "city":"", "postalCode":"", "owners":"",
    "sellers":[{"firstName":"","lastName":"","mailingAddress":"","phone":"","email":"","roles":["seller","owner"]}],
    "buyers":[], "transactionType":"vente", "lotNumber":"", "cadastre":"", "propertyType":"",
    "dimensions":"", "landArea":"", "livingArea":"", "yearBuilt":"", "bedrooms":"", "bathrooms":"",
    "parking":"", "zoning":"", "servitudes":"", "pool":"", "garage":"", "fireplace":"",
    "municipalTaxes":"", "schoolTaxes":"", "municipalAssessment":"",
    "mortgageLender":"", "mortgageDate":"", "mortgageAmount":"", "mortgageMaturity":"",
    "renovations":"", "features":"", "certificateInfo":"", "sellerDeclaration":"",
    "askingPrice":"", "marketDate":"", "occupancyDate":"", "availability":"", "importantInfo":"", "missingInfo":""
  },
  "facts": [
    {"key":"landArea","label":"Superficie du terrain","value":"8 450 pi²","status":"confirmed","sourceLabel":"certificat-localisation.pdf","confidence":0.98,"note":""}
  ],
  "documentTypes": [
    {"name":"certificat-localisation.pdf","type":"Certificat de localisation"}
  ]
}

Clés de faits permises : owners, address, city, postalCode, propertyType, lotNumber, dimensions, landArea, livingArea, yearBuilt, bedrooms, bathrooms, municipalTaxes, schoolTaxes, municipalAssessment, servitudes, mortgage, renovations, features, certificateInfo, sellerDeclaration, askingPrice, marketDate, occupancyDate.`;

export function normalizeMandateDocumentExtraction(value: unknown): Pick<MandateDocumentExtractionResponse, "fields" | "facts" | "documentTypes"> {
  const root = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fields = normalizeExtractedMandateFields(root.fields || root);
  const rawFacts = Array.isArray(root.facts) ? root.facts : [];
  const knownDefinitions: Map<string, (typeof LISTING_FACT_DEFINITIONS)[number]> = new Map(
    LISTING_FACT_DEFINITIONS.map((definition) => [definition.key, definition]),
  );
  const facts: ListingFact[] = rawFacts.map((item) => {
    const fact = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const key = String(fact.key || "").trim();
    const definition = knownDefinitions.get(key);
    const value = String(fact.value || "").trim();
    const sourceLabel = String(fact.sourceLabel || fact.source || "").trim();
    const requestedStatus = String(fact.status || "to_confirm") as ListingFactStatus;
    const status: ListingFactStatus = !value
      ? "missing"
      : requestedStatus === "confirmed" && sourceLabel
        ? "confirmed"
        : "to_confirm";
    const confidenceValue = Number(fact.confidence);
    return {
      key,
      label: String(fact.label || definition?.label || key),
      value,
      status,
      sourceLabel: sourceLabel || "Source documentaire à confirmer",
      confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null,
      note: String(fact.note || ""),
    };
  }).filter((fact) => fact.key && knownDefinitions.has(fact.key) && (fact.value || fact.status === "missing"));

  const factsByKey = new Set(facts.filter((fact) => fact.value).map((fact) => fact.key));
  const fieldRecord = fields as unknown as Record<string, unknown>;
  for (const definition of LISTING_FACT_DEFINITIONS) {
    if (factsByKey.has(definition.key)) continue;
    let value = String(fieldRecord[definition.key] || "").trim();
    if (definition.key === "mortgage") {
      value = [fields.mortgageLender, fields.mortgageDate, fields.mortgageAmount, fields.mortgageMaturity].filter(Boolean).join(" · ");
    }
    if (value) {
      facts.push({
        key: definition.key,
        label: definition.label,
        value,
        status: "to_confirm",
        sourceLabel: "Source documentaire à confirmer",
        confidence: null,
        note: "Valeur extraite sans source structurée; validation du courtier requise.",
      });
    }
  }

  const documentTypes = Array.isArray(root.documentTypes)
    ? root.documentTypes.map((item) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { name: String(record.name || ""), type: String(record.type || "Autre") };
      }).filter((item) => item.name)
    : [];

  return { fields, facts, documentTypes };
}

export function normalizeExtractedMandateFields(value: unknown): ExtractedMandateFields {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const normalizePeople = (input: unknown, defaultRole: "buyer" | "seller") => Array.isArray(input) ? input.map((person) => {
    const item = typeof person === "object" && person !== null ? person as Record<string, unknown> : {};
    const roles = Array.isArray(item.roles)
      ? item.roles.map(String).filter((role): role is "buyer" | "seller" | "investor" | "owner" => ["buyer", "seller", "investor", "owner"].includes(role))
      : [defaultRole];
    return {
      firstName: String(item.firstName || ""),
      lastName: String(item.lastName || ""),
      mailingAddress: String(item.mailingAddress || ""),
      phone: String(item.phone || ""),
      email: String(item.email || ""),
      roles,
    };
  }).filter((person) => person.firstName || person.lastName) : [];
  const sellers = normalizePeople(record.sellers, "seller");
  const buyers = normalizePeople(record.buyers, "buyer");
  const text = (key: keyof ExtractedMandateFields) => String(record[key] || "");
  return {
    address: text("address"), city: text("city"), postalCode: text("postalCode"), owners: text("owners"), sellers, buyers,
    transactionType: text("transactionType"), lotNumber: text("lotNumber"), cadastre: text("cadastre"), propertyType: text("propertyType"),
    dimensions: text("dimensions"), landArea: text("landArea"), livingArea: text("livingArea"),
    yearBuilt: text("yearBuilt"), bedrooms: text("bedrooms"), bathrooms: text("bathrooms"),
    parking: text("parking"), zoning: text("zoning"), servitudes: text("servitudes"), pool: text("pool"),
    garage: text("garage"), fireplace: text("fireplace"), municipalTaxes: text("municipalTaxes"),
    schoolTaxes: text("schoolTaxes"), municipalAssessment: text("municipalAssessment"),
    mortgageLender: text("mortgageLender"), mortgageDate: text("mortgageDate"),
    mortgageAmount: text("mortgageAmount"), mortgageMaturity: text("mortgageMaturity"),
    renovations: text("renovations"), features: text("features"), certificateInfo: text("certificateInfo"),
    sellerDeclaration: text("sellerDeclaration"), askingPrice: text("askingPrice"), marketDate: text("marketDate"),
    occupancyDate: text("occupancyDate"), availability: text("availability"), importantInfo: text("importantInfo"), missingInfo: text("missingInfo"),
  };
}

export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("OpenAI n'a pas retourné un JSON exploitable.");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}
