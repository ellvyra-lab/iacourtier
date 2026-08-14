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
  acquisitionDate: string;
  acquisitionPrice: string;
  notary: string;
  buildings: string;
  encroachments: string;
  askingPrice: string;
  marketDate: string;
  occupancyDate: string;
  availability: string;
  conditions: string;
  inclusions: string;
  exclusions: string;
  modifiedInfo: string;
  importantInfo: string;
  missingInfo: string;
};

export const emptyExtractedMandateFields: ExtractedMandateFields = {
  address: "", city: "", postalCode: "", owners: "", sellers: [], buyers: [], transactionType: "", lotNumber: "", cadastre: "",
  propertyType: "", dimensions: "", landArea: "", livingArea: "", yearBuilt: "", bedrooms: "",
  bathrooms: "", parking: "", zoning: "", servitudes: "", pool: "", garage: "", fireplace: "",
  municipalTaxes: "", schoolTaxes: "", municipalAssessment: "", mortgageLender: "", mortgageDate: "",
  mortgageAmount: "", mortgageMaturity: "", renovations: "", features: "", certificateInfo: "", sellerDeclaration: "",
  acquisitionDate: "", acquisitionPrice: "", notary: "", buildings: "", encroachments: "",
  askingPrice: "", marketDate: "", occupancyDate: "", availability: "", conditions: "", inclusions: "", exclusions: "",
  modifiedInfo: "", importantInfo: "", missingInfo: "",
};

export const MANDATE_DOCUMENT_TYPES = [
  "Acte de vente",
  "Certificat de localisation",
  "Modification",
  "Contrat",
  "Déclaration du vendeur",
  "Taxes",
  "Autre",
] as const;

export type MandateDocumentType = (typeof MANDATE_DOCUMENT_TYPES)[number];
export type MandateAnalysisMode = "pdf_text_and_vision" | "pdf_visual_ocr" | "image_vision";

export type ExtractedDocumentClassification = {
  name: string;
  type: MandateDocumentType;
};

export type MandateDocumentAnalysis = {
  name: string;
  type: MandateDocumentType;
  analysisMode: MandateAnalysisMode;
  pageCount: number | null;
  extractedTextLength: number;
  fields: ExtractedMandateFields;
  facts: ListingFact[];
  contacts: ExtractedSeller[];
  missing: Array<{ key: string; label: string }>;
  warning?: string;
};

export type MandateDocumentContradiction = {
  key: string;
  label: string;
  values: Array<{ value: string; sourceLabel: string }>;
};

export type MandateExtractionSummary = {
  totalDocuments: number;
  totalInformation: number;
  contactsIdentified: ExtractedSeller[];
  contradictions: MandateDocumentContradiction[];
  missing: Array<{ key: string; label: string }>;
  sources: Array<{ name: string; type: MandateDocumentType; analysisMode: MandateAnalysisMode }>;
};

export type MandateDocumentExtractionResponse = {
  fields: ExtractedMandateFields;
  facts: ListingFact[];
  documentTypes: ExtractedDocumentClassification[];
  documents: MandateDocumentAnalysis[];
  summary: MandateExtractionSummary;
  fileNames: string[];
  extractedTextPreview: string;
};

export const mandateDocumentExtractionSystemPrompt = `Tu es un moteur d'extraction documentaire structurée pour courtiers immobiliers au Québec.

Analyse un seul document immobilier à la fois. Lis tout son contenu, y compris le texte imprimé, les champs remplis, les cases cochées, les signatures lisibles et les pages numérisées.

Règles absolues :
- Ne jamais inventer, compléter par vraisemblance ou déduire une donnée absente.
- Une donnée claire et non contradictoire peut être "confirmed".
- Une donnée ambiguë, peu lisible ou contradictoire doit être "to_confirm" et expliquer le doute dans "note".
- Si une information n'est pas trouvée, retourner une chaîne vide; ne pas fabriquer de valeur "inconnue".
- Chaque fait non vide doit nommer exactement le document source dans "sourceLabel".
- Conserver les montants, unités et dates tels qu'ils apparaissent.
- Distinguer vendeurs/propriétaires, acheteurs, témoins, notaires et créanciers. Un témoin, notaire ou créancier n'est jamais un client.
- Dans un acte d'acquisition, l'acquéreur est le propriétaire acquis par cet acte. Pour un dossier d'inscription, place ce propriétaire dans "sellers" avec le rôle "owner" afin qu'il soit identifié comme contact; ne transforme pas le vendeur historique en propriétaire actuel.
- Dans un contrat de courtage ou une modification, identifie comme contacts seulement les personnes nommées comme VENDEUR(S), jamais le courtier.
- Classe le document dans exactement un de ces types : Acte de vente, Certificat de localisation, Modification, Contrat, Déclaration du vendeur, Taxes, Autre.
- Une absence de couche texte n'est pas une absence d'information : lis visuellement toutes les pages.
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
    "acquisitionDate":"", "acquisitionPrice":"", "notary":"", "buildings":"", "encroachments":"",
    "askingPrice":"", "marketDate":"", "occupancyDate":"", "availability":"", "conditions":"",
    "inclusions":"", "exclusions":"", "modifiedInfo":"", "importantInfo":"", "missingInfo":""
  },
  "facts": [
    {"key":"landArea","label":"Superficie du terrain","value":"8 450 pi²","status":"confirmed","sourceLabel":"certificat-localisation.pdf","confidence":0.98,"note":""}
  ],
  "documentTypes": [
    {"name":"certificat-localisation.pdf","type":"Certificat de localisation"}
  ]
}

Clés de faits permises : owners, address, city, postalCode, propertyType, lotNumber, dimensions, landArea, livingArea, yearBuilt, bedrooms, bathrooms, municipalTaxes, schoolTaxes, municipalAssessment, servitudes, mortgage, renovations, features, certificateInfo, sellerDeclaration, acquisitionDate, acquisitionPrice, notary, buildings, garage, pool, encroachments, askingPrice, marketDate, occupancyDate, availability, conditions, inclusions, exclusions, modifiedInfo, importantInfo.

Pour un acte de vente, cherche notamment : propriétaire/acquéreur, adresse, lot, date et prix d'acquisition, notaire, servitudes et mentions pertinentes.
Pour un certificat de localisation, cherche notamment : adresse, lot, dimensions, superficie, bâtiments, garage, piscine, servitudes, empiètements et remarques.
Pour une modification ou un contrat, cherche notamment : vendeurs, adresse, prix demandé, date de mise en marché, disponibilité/occupation, conditions, inclusions, exclusions et informations modifiées.`;

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
        return { name: String(record.name || ""), type: normalizeMandateDocumentType(record.type) };
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
    sellerDeclaration: text("sellerDeclaration"), acquisitionDate: text("acquisitionDate"), acquisitionPrice: text("acquisitionPrice"),
    notary: text("notary"), buildings: text("buildings"), encroachments: text("encroachments"),
    askingPrice: text("askingPrice"), marketDate: text("marketDate"), occupancyDate: text("occupancyDate"),
    availability: text("availability"), conditions: text("conditions"), inclusions: text("inclusions"), exclusions: text("exclusions"),
    modifiedInfo: text("modifiedInfo"), importantInfo: text("importantInfo"), missingInfo: text("missingInfo"),
  };
}

const EXPECTED_FACT_KEYS: Record<MandateDocumentType, readonly string[]> = {
  "Acte de vente": ["owners", "address", "lotNumber", "acquisitionDate", "acquisitionPrice", "notary", "servitudes", "importantInfo"],
  "Certificat de localisation": ["address", "lotNumber", "dimensions", "landArea", "buildings", "garage", "pool", "servitudes", "encroachments", "importantInfo"],
  Modification: ["owners", "address", "askingPrice", "marketDate", "availability", "conditions", "inclusions", "exclusions", "modifiedInfo"],
  Contrat: ["owners", "address", "askingPrice", "marketDate", "availability", "conditions", "inclusions", "exclusions"],
  "Déclaration du vendeur": ["owners", "address", "sellerDeclaration", "renovations", "features", "importantInfo"],
  Taxes: ["owners", "address", "municipalTaxes", "schoolTaxes", "municipalAssessment"],
  Autre: [],
};

const DOCUMENT_TYPE_PRIORITY: Record<MandateDocumentType, number> = {
  Modification: 100,
  Contrat: 90,
  "Certificat de localisation": 80,
  "Acte de vente": 80,
  "Déclaration du vendeur": 70,
  Taxes: 60,
  Autre: 10,
};

export function normalizeMandateDocumentType(value: unknown, fileName = ""): MandateDocumentType {
  const normalized = normalizeComparable(String(value || fileName));
  if (normalized.includes("certificat") || normalized.includes("localisation")) return "Certificat de localisation";
  if (normalized.includes("modification") || /(^|\s)mo($|\s)/.test(normalized)) return "Modification";
  if (normalized.includes("contrat") || normalized.includes("courtage") || /(^|\s)ccv($|\s)/.test(normalized)) return "Contrat";
  if (normalized.includes("declaration") && normalized.includes("vendeur")) return "Déclaration du vendeur";
  if (normalized.includes("taxe")) return "Taxes";
  if (normalized.includes("acte") || normalized.includes("vente")) return "Acte de vente";
  return "Autre";
}

export function buildMandateDocumentAnalysis({
  name,
  value,
  analysisMode,
  pageCount,
  extractedTextLength,
}: {
  name: string;
  value: unknown;
  analysisMode: MandateAnalysisMode;
  pageCount: number | null;
  extractedTextLength: number;
}): MandateDocumentAnalysis {
  const extraction = normalizeMandateDocumentExtraction(value);
  const classified = extraction.documentTypes.find((document) => document.name === name) || extraction.documentTypes[0];
  const type = normalizeMandateDocumentType(classified?.type, name);
  let contacts = extraction.fields.sellers;

  if (type === "Acte de vente") {
    const owners = contactsFromOwnerField(extraction.fields.owners);
    contacts = extraction.fields.buyers.length
      ? extraction.fields.buyers.map((buyer) => ({ ...buyer, roles: ["owner"] }))
      : owners.length
        ? owners
        : contacts;
  }

  const facts = extraction.facts
    .filter((fact) => fact.value.trim())
    .map((fact) => {
      const derivedFromField = fact.note === "Valeur extraite sans source structurée; validation du courtier requise.";
      return {
        ...fact,
        sourceLabel: name,
        status: derivedFromField ? "confirmed" as const : fact.status,
        confidence: derivedFromField ? 0.9 : fact.confidence,
        note: derivedFromField ? "Valeur lue dans ce document." : fact.note,
      };
    });

  if (contacts.length && !facts.some((fact) => fact.key === "owners")) {
    facts.unshift({
      key: "owners",
      label: "Propriétaire(s)",
      value: contacts.map(contactName).filter(Boolean).join(" et "),
      status: "confirmed",
      sourceLabel: name,
      confidence: 0.95,
      note: type === "Acte de vente" ? "Propriétaire acquis par l’acte." : "Vendeur identifié dans le document.",
    });
  }

  const keys = new Set(facts.map((fact) => fact.key));
  const missing = EXPECTED_FACT_KEYS[type]
    .filter((key) => !keys.has(key))
    .map((key) => {
      const definition = LISTING_FACT_DEFINITIONS.find((item) => item.key === key);
      return { key, label: definition?.label || key };
    });

  return {
    name,
    type,
    analysisMode,
    pageCount,
    extractedTextLength,
    fields: extraction.fields,
    facts,
    contacts,
    missing,
  };
}

export function mergeMandateDocumentAnalyses(documents: MandateDocumentAnalysis[]): Pick<MandateDocumentExtractionResponse, "fields" | "facts" | "documentTypes" | "documents" | "summary"> {
  const definitions = new Map<string, (typeof LISTING_FACT_DEFINITIONS)[number]>(
    LISTING_FACT_DEFINITIONS.map((definition) => [definition.key, definition]),
  );
  const grouped = new Map<string, Array<{ fact: ListingFact; document: MandateDocumentAnalysis }>>();

  for (const document of documents) {
    for (const fact of document.facts) {
      if (!fact.value.trim() || !definitions.has(fact.key)) continue;
      const current = grouped.get(fact.key) || [];
      current.push({ fact, document });
      grouped.set(fact.key, current);
    }
  }

  const contradictions: MandateDocumentContradiction[] = [];
  const facts: ListingFact[] = [];

  for (const definition of LISTING_FACT_DEFINITIONS) {
    const candidates = grouped.get(definition.key) || [];
    if (!candidates.length) {
      facts.push({ key: definition.key, label: definition.label, value: "", status: "missing", sourceLabel: "Aucun document", confidence: null });
      continue;
    }

    candidates.sort((left, right) => {
      const priority = DOCUMENT_TYPE_PRIORITY[right.document.type] - DOCUMENT_TYPE_PRIORITY[left.document.type];
      if (priority) return priority;
      return (right.fact.confidence || 0) - (left.fact.confidence || 0);
    });
    const preferred = candidates[0];
    const distinct = distinctFactValues(candidates.map(({ fact }) => fact));
    const conflicting = distinct.length > 1;

    if (conflicting) {
      contradictions.push({ key: definition.key, label: definition.label, values: distinct });
    }

    facts.push({
      ...preferred.fact,
      label: definition.label,
      status: conflicting ? "to_confirm" : preferred.fact.status,
      note: conflicting
        ? `Valeurs contradictoires : ${distinct.map((item) => `${item.value} — ${item.sourceLabel}`).join("; ")}. La valeur du document le plus prioritaire est proposée.`
        : preferred.fact.note,
    });
  }

  const contactsIdentified = dedupeContacts(documents.flatMap((document) => document.contacts));
  const fields = mergeExtractedFields(documents, facts, contactsIdentified);

  return {
    fields,
    facts,
    documents,
    documentTypes: documents.map((document) => ({ name: document.name, type: document.type })),
    summary: {
      totalDocuments: documents.length,
      totalInformation: documents.reduce((total, document) => total + document.facts.length, 0),
      contactsIdentified,
      contradictions,
      missing: facts.filter((fact) => fact.status === "missing").map((fact) => ({ key: fact.key, label: fact.label })),
      sources: documents.map((document) => ({ name: document.name, type: document.type, analysisMode: document.analysisMode })),
    },
  };
}

function mergeExtractedFields(documents: MandateDocumentAnalysis[], facts: ListingFact[], contacts: ExtractedSeller[]) {
  const result: ExtractedMandateFields = { ...emptyExtractedMandateFields, sellers: contacts, buyers: [] };
  const ordered = [...documents].sort((left, right) => DOCUMENT_TYPE_PRIORITY[right.type] - DOCUMENT_TYPE_PRIORITY[left.type]);
  const resultRecord = result as unknown as Record<string, unknown>;

  for (const document of ordered) {
    const source = document.fields as unknown as Record<string, unknown>;
    for (const key of Object.keys(emptyExtractedMandateFields)) {
      if (key === "sellers" || key === "buyers" || resultRecord[key]) continue;
      const value = source[key];
      if (typeof value === "string" && value.trim()) resultRecord[key] = value;
    }
  }

  for (const fact of facts) {
    if (!fact.value || !(fact.key in resultRecord) || typeof resultRecord[fact.key] !== "string") continue;
    resultRecord[fact.key] = fact.value;
  }
  result.owners = facts.find((fact) => fact.key === "owners")?.value || contacts.map(contactName).filter(Boolean).join(" et ");
  result.buyers = dedupeContacts(documents.flatMap((document) => document.fields.buyers));
  return result;
}

function distinctFactValues(facts: ListingFact[]) {
  const values = new Map<string, { value: string; sourceLabel: string }>();
  for (const fact of facts) {
    const comparable = normalizeComparable(fact.value);
    if (!comparable || values.has(comparable)) continue;
    values.set(comparable, { value: fact.value, sourceLabel: fact.sourceLabel });
  }
  return [...values.values()];
}

function dedupeContacts(contacts: ExtractedSeller[]) {
  const values = new Map<string, ExtractedSeller>();
  for (const contact of contacts) {
    const key = normalizeComparable(contactName(contact)) || normalizeComparable(contact.email || contact.phone);
    if (!key) continue;
    const existing = values.get(key);
    values.set(key, existing ? {
      ...existing,
      mailingAddress: existing.mailingAddress || contact.mailingAddress,
      phone: existing.phone || contact.phone,
      email: existing.email || contact.email,
      roles: [...new Set([...(existing.roles || []), ...(contact.roles || [])])],
    } : contact);
  }
  return [...values.values()];
}

function contactName(contact: ExtractedSeller) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function contactsFromOwnerField(value: string): ExtractedSeller[] {
  return value.split(/\s+(?:et|and|&)\s+|\s*;\s*/i).map((fullName) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const lastName = parts.pop() || "";
    return {
      firstName: parts.join(" "),
      lastName,
      mailingAddress: "",
      phone: "",
      email: "",
      roles: ["owner" as const],
    };
  }).filter((contact) => contact.firstName || contact.lastName);
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
