import { calculateOpportunityScore, normalizeCategory, priorityFromScore } from "./score";
import type { Prospect, ProspectRecord } from "./types";

type CsvRow = Record<string, string>;

const csvHeaderAliases: Record<string, string[]> = {
  score: ["score"],
  address: ["adresse", "address"],
  city: ["ville", "city"],
  province: ["province", "etat", "state"],
  postalCode: ["codepostal", "code postal", "postalcode", "postal code", "zip", "zipcode"],
  ownerName: ["nomproprietaire", "nom proprietaire", "proprietaire", "propriÃ©taire", "ownername", "owner name", "owner", "nom"],
  source: ["source", "origine"],
  contactName: ["nom", "name", "propriÃ©taire", "proprietaire"],
  phone: ["tÃ©lÃ©phone", "telephone", "tel", "phone"],
  email: ["courriel", "email", "e-mail"],
  facebookUrl: ["facebookurl", "facebook url", "facebook", "facebook_profile", "facebook profile"],
  contactStatus: ["statutcontact", "statut contact", "contactstatus", "contact status", "statut"],
  category: ["catÃ©gorie", "categorie", "category"],
  acquisitionDate: ["date acquisition", "dateacquisition", "acquisition date"],
  ownerYears: ["annÃ©es dÃ©tention", "annees detention", "annÃ©es de dÃ©tention", "annees de detention", "owner years"],
  ownerCount: ["nb propriÃ©taires", "nb proprietaires", "nombre propriÃ©taires", "nombre proprietaires", "owner count"],
  yearBuilt: ["annÃ©e construction", "annee construction", "annÃ©e de construction", "annee de construction", "year built"],
  propertyType: ["type", "type propriÃ©tÃ©", "type propriete", "property type"],
  housingCount: ["logements", "nb logements", "nombre logements", "units"],
  buildingArea: ["superficie bÃ¢timent (mÂ²)", "superficie batiment (m2)", "superficie bÃ¢timent", "superficie batiment", "building area"],
  landArea: ["superficie terrain (mÂ²)", "superficie terrain (m2)", "superficie terrain", "land area"],
  totalValue: ["valeur Ã©valuation ($)", "valeur evaluation ($)", "valeur Ã©valuation", "valeur evaluation", "assessed value"],
  signals: ["signaux dÃ©tectÃ©s", "signaux detectes", "signaux", "signals"],
  notes: ["notes", "note", "commentaires", "comments"],
};

export type CsvImportResult = {
  prospects: ProspectRecord[];
  totalRows: number;
  ignoredRows: number;
  errors: string[];
};

export function parseProspectsCsv(csvText: string, fileName = "import.csv", listCity = ""): CsvImportResult {
  const rows = parseCsv(csvText);
  const now = new Date().toISOString();
  const hasCityColumn = validateRequiredColumns(rows, listCity);
  const errors: string[] = [];

  const prospects = rows.map<ProspectRecord | null>((row, index) => {
      const address = readCsvValue(row, "address");
      const city = hasCityColumn ? readCsvValue(row, "city") : listCity.trim();
      const province = readCsvValue(row, "province");
      const postalCode = readCsvValue(row, "postalCode");
      const ownerName = readCsvValue(row, "ownerName");
      const source = readCsvValue(row, "source") || "CSV import";
      const contactName = readCsvValue(row, "contactName");
      const phone = readCsvValue(row, "phone");
      const email = readCsvValue(row, "email");
      const facebookUrl = readCsvValue(row, "facebookUrl");
      const contactStatus = normalizeContactStatus(readCsvValue(row, "contactStatus"));
      const rawCategory = readCsvValue(row, "category");
      const signals = readCsvValue(row, "signals");
      const notes = [readCsvValue(row, "notes"), signals].filter(Boolean).join(" â€” ");
      const category = normalizeCategory(rawCategory || notes);
      const propertyType = readCsvValue(row, "propertyType") || inferPropertyType(rawCategory, notes);
      const importedScore = parseCsvNumber(readCsvValue(row, "score"));
      const opportunityScore = importedScore === null
        ? calculateOpportunityScore({ category, propertyType, notes })
        : Math.max(0, Math.min(100, Math.round(importedScore)));

      if (!address) {
        errors.push(`Ligne ${index + 2} : adresse manquante.`);
        return null;
      }

      const prospect: Prospect = {
        id: `csv-${slugify(fileName)}-${index + 1}-${slugify(address || ownerName || contactName || city)}`,
        nomProprietaire: ownerName || contactName || undefined,
        adresse: address || "Adresse non prÃ©cisÃ©e",
        ville: city || "Ville non prÃ©cisÃ©e",
        province: province || "QC",
        codePostal: postalCode || "Non prÃ©cisÃ©",
        source,
        score: opportunityScore,
        raisonDuScore: buildCsvReason({ category, notes, contactName: ownerName || contactName }),
        telephone: phone || undefined,
        courriel: email || undefined,
        facebookUrl: facebookUrl || undefined,
        statutContact: contactStatus,
      };

      return {
        id: prospect.id,
        address: prospect.adresse,
        city: prospect.ville,
        province: prospect.province,
        postalCode: prospect.codePostal,
        propertyType,
        category,
        reason: prospect.raisonDuScore,
        opportunityScore: prospect.score,
        priority: priorityFromScore(prospect.score),
        source: "csv",
        url: null,
        lastUpdated: now,
        ownerName: prospect.nomProprietaire,
        contactName: contactName || prospect.nomProprietaire,
        phone: prospect.telephone,
        email: prospect.courriel,
        facebookUrl: prospect.facebookUrl,
        contactStatus: prospect.statutContact,
        notes: notes || undefined,
        rawData: {
          csvSource: prospect.source,
          acquisition_date: readCsvValue(row, "acquisitionDate") || null,
          owner_years: parseCsvNumber(readCsvValue(row, "ownerYears")),
          owner_count: parseCsvNumber(readCsvValue(row, "ownerCount")),
          year_built: parseCsvNumber(readCsvValue(row, "yearBuilt")),
          housing_count: parseCsvNumber(readCsvValue(row, "housingCount")),
          building_area: parseCsvNumber(readCsvValue(row, "buildingArea")),
          land_area: parseCsvNumber(readCsvValue(row, "landArea")),
          total_value: parseCsvNumber(readCsvValue(row, "totalValue")),
          signals: signals || null,
        },
      } satisfies ProspectRecord;
    });

  const imported = prospects.filter((row): row is ProspectRecord => row !== null);
  return { prospects: imported, totalRows: rows.length, ignoredRows: rows.length - imported.length, errors };
}

function parseCsv(csvText: string): CsvRow[] {
  const normalized = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = parseCsvRecords(normalized).filter((record) => record.some((cell) => cell.trim()));
  const [headers, ...body] = records;
  if (!headers?.length) return [];

  const normalizedHeaders = headers.map(normalizeHeader);

  return body.map((record) =>
    normalizedHeaders.reduce<CsvRow>((row, header, index) => {
      row[header] = record[index]?.trim() || "";
      return row;
    }, {}),
  );
}

function validateRequiredColumns(rows: CsvRow[], listCity: string) {
  if (!rows.length) {
    throw new Error("Le CSV est vide.");
  }

  const firstRow = rows[0];
  const hasAddress = csvHeaderAliases.address.some((alias) => firstRow[normalizeHeader(alias)] !== undefined);
  const hasCity = csvHeaderAliases.city.some((alias) => firstRow[normalizeHeader(alias)] !== undefined);

  if (!hasAddress) throw new Error("Colonne minimale manquante : adresse (ou address).");
  if (!hasCity && !listCity.trim()) throw new Error("CSV_CITY_REQUIRED");
  return hasCity;
}

function parseCsvRecords(value: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  const delimiter = detectDelimiter(value);

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      continue;
    }

    field += char;
  }

  record.push(field);
  records.push(record);
  return records;
}

function detectDelimiter(value: string) {
  const firstLine = value.split("\n", 1)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount >= tabCount) return ";";
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  return ",";
}

function readCsvValue(row: CsvRow, field: keyof typeof csvHeaderAliases) {
  for (const alias of csvHeaderAliases[field]) {
    const value = row[normalizeHeader(alias)];
    if (value) return value;
  }
  return "";
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseCsvNumber(value: string) {
  if (!value.trim()) return null;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPropertyType(category: string, notes: string) {
  const searchable = `${category} ${notes}`.toLowerCase();
  if (searchable.includes("terrain")) return "Terrain";
  if (searchable.includes("duplex")) return "Duplex";
  if (searchable.includes("triplex")) return "Triplex";
  if (searchable.includes("multiplex") || searchable.includes("plex")) return "Multiplex";
  if (searchable.includes("condo")) return "Condo";
  if (searchable.includes("commercial")) return "Commercial";
  return "PropriÃ©tÃ©";
}

function buildCsvReason({ category, notes, contactName }: { category: string; notes: string; contactName: string }) {
  const base = notes ? notes : "Prospect importÃ© par CSV. Le score est calculÃ© selon la catÃ©gorie et les signaux prÃ©sents dans les notes.";
  return contactName ? `${base} Contact identifiÃ© : ${contactName}. CatÃ©gorie : ${category}.` : `${base} CatÃ©gorie : ${category}.`;
}

function normalizeContactStatus(value: string): Prospect["statutContact"] {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "nouveau";
  if (normalized.includes("relanc")) return "a_relancer";
  if (normalized.includes("qualif")) return "qualifie";
  if (normalized.includes("cours") || normalized.includes("en cours")) return "en_cours";
  if (normalized.includes("contact") || normalized.includes("joint")) return "contacte";
  if (normalized.includes("a contacter") || normalized.includes("Ã  contacter")) return "a_contacter";
  return "nouveau";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

