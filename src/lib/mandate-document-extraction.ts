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
  askingPrice: string;
  marketDate: string;
  availability: string;
  importantInfo: string;
  missingInfo: string;
};

export const emptyExtractedMandateFields: ExtractedMandateFields = {
  address: "", city: "", postalCode: "", owners: "", sellers: [], buyers: [], transactionType: "", lotNumber: "", cadastre: "",
  propertyType: "", dimensions: "", landArea: "", livingArea: "", yearBuilt: "", bedrooms: "",
  bathrooms: "", parking: "", zoning: "", servitudes: "", pool: "", garage: "", fireplace: "",
  municipalTaxes: "", schoolTaxes: "", municipalAssessment: "", mortgageLender: "", mortgageDate: "",
  mortgageAmount: "", mortgageMaturity: "", askingPrice: "", marketDate: "", availability: "",
  importantInfo: "", missingInfo: "",
};

export type MandateDocumentExtractionResponse = {
  fields: ExtractedMandateFields;
  fileNames: string[];
  extractedTextPreview: string;
};

export const mandateDocumentExtractionSystemPrompt = `Tu es un moteur d'extraction documentaire structuré pour courtiers immobiliers au Québec.

Analyse les documents fournis (actes, certificats, déclarations, taxes, évaluations, inspections, plans et photos).
Règles strictes :
- Ne jamais inventer une donnée.
- Si une information n'est pas trouvée, retourner une chaîne vide ou un tableau vide.
- Distinguer les acheteurs, vendeurs, investisseurs et propriétaires; ne pas transformer un témoin, notaire ou créancier en client.\n- Si la même personne achète et vend, la placer dans les deux tableaux avec les mêmes coordonnées et les rôles buyer et seller.
- Conserver les montants, unités et dates tels qu'ils apparaissent.
- Retourner uniquement un JSON valide, sans Markdown.

Structure JSON obligatoire :
{
  "address": "", "city": "", "postalCode": "", "owners": "",
  "sellers": [{"firstName":"","lastName":"","mailingAddress":"","phone":"","email":"","roles":["seller","owner"]}],
  "buyers": [{"firstName":"","lastName":"","mailingAddress":"","phone":"","email":"","roles":["buyer"]}],
  "transactionType": "achat|vente|achat_vente|investissement|",
  "lotNumber": "", "cadastre": "", "propertyType": "", "dimensions": "",
  "landArea": "", "livingArea": "", "yearBuilt": "", "bedrooms": "", "bathrooms": "",
  "parking": "", "zoning": "", "servitudes": "", "pool": "", "garage": "", "fireplace": "",
  "municipalTaxes": "", "schoolTaxes": "", "municipalAssessment": "",
  "mortgageLender": "", "mortgageDate": "", "mortgageAmount": "", "mortgageMaturity": "",
  "askingPrice": "", "marketDate": "", "availability": "",
  "importantInfo": "", "missingInfo": ""
}`;

export function normalizeExtractedMandateFields(value: unknown): ExtractedMandateFields {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const normalizePeople = (value: unknown, defaultRole: "buyer" | "seller") => Array.isArray(value) ? value.map((person) => {
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
    askingPrice: text("askingPrice"), marketDate: text("marketDate"), availability: text("availability"),
    importantInfo: text("importantInfo"), missingInfo: text("missingInfo"),
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
