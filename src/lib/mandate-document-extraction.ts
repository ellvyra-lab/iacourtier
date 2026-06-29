export type ExtractedMandateFields = {
  address: string;
  city: string;
  postalCode: string;
  owners: string;
  lotNumber: string;
  cadastre: string;
  landArea: string;
  livingArea: string;
  yearBuilt: string;
  municipalTaxes: string;
  schoolTaxes: string;
  municipalAssessment: string;
  zoning: string;
  servitudes: string;
  pool: string;
  garage: string;
  importantInfo: string;
  missingInfo: string;
};

export const emptyExtractedMandateFields: ExtractedMandateFields = {
  address: "",
  city: "",
  postalCode: "",
  owners: "",
  lotNumber: "",
  cadastre: "",
  landArea: "",
  livingArea: "",
  yearBuilt: "",
  municipalTaxes: "",
  schoolTaxes: "",
  municipalAssessment: "",
  zoning: "",
  servitudes: "",
  pool: "",
  garage: "",
  importantInfo: "",
  missingInfo: "",
};

export type MandateDocumentExtractionResponse = {
  fields: ExtractedMandateFields;
  fileNames: string[];
  extractedTextPreview: string;
};

export const mandateDocumentExtractionSystemPrompt = `Tu es un assistant d'extraction documentaire pour courtiers immobiliers au Québec.

Tu reçois le texte extrait de documents PDF liés à un mandat immobilier :
- certificat de localisation
- acte de vente
- compte de taxes municipales
- compte de taxes scolaires
- déclaration du vendeur

Règles strictes :
- Ne jamais inventer une donnée.
- Si une information n'est pas trouvée, retourner une chaîne vide.
- Ne jamais interpréter une valeur incertaine comme certaine.
- Les informations extraites seront validées et modifiées par le courtier avant création du mandat.
- Retourner uniquement un JSON valide, sans Markdown.

Structure JSON obligatoire :
{
  "address": "",
  "city": "",
  "postalCode": "",
  "owners": "",
  "lotNumber": "",
  "cadastre": "",
  "landArea": "",
  "livingArea": "",
  "yearBuilt": "",
  "municipalTaxes": "",
  "schoolTaxes": "",
  "municipalAssessment": "",
  "zoning": "",
  "servitudes": "",
  "pool": "",
  "garage": "",
  "importantInfo": "",
  "missingInfo": ""
}`;

export function normalizeExtractedMandateFields(value: unknown): ExtractedMandateFields {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    address: String(record.address || ""),
    city: String(record.city || ""),
    postalCode: String(record.postalCode || ""),
    owners: String(record.owners || ""),
    lotNumber: String(record.lotNumber || ""),
    cadastre: String(record.cadastre || ""),
    landArea: String(record.landArea || ""),
    livingArea: String(record.livingArea || ""),
    yearBuilt: String(record.yearBuilt || ""),
    municipalTaxes: String(record.municipalTaxes || ""),
    schoolTaxes: String(record.schoolTaxes || ""),
    municipalAssessment: String(record.municipalAssessment || ""),
    zoning: String(record.zoning || ""),
    servitudes: String(record.servitudes || ""),
    pool: String(record.pool || ""),
    garage: String(record.garage || ""),
    importantInfo: String(record.importantInfo || ""),
    missingInfo: String(record.missingInfo || ""),
  };
}

export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("OpenAI n'a pas retourné un JSON exploitable.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}
