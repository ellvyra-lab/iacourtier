import { calculateOpportunityScore, normalizeCategory, priorityFromScore } from "./score";
import type { Prospect, ProspectRecord } from "./types";

type CsvRow = Record<string, string>;

const csvHeaderAliases: Record<string, string[]> = {
  address: ["adresse", "address"],
  city: ["ville", "city"],
  province: ["province", "etat", "state"],
  postalCode: ["codepostal", "code postal", "postalcode", "postal code", "zip", "zipcode"],
  ownerName: ["nomproprietaire", "nom proprietaire", "proprietaire", "propriétaire", "ownername", "owner name"],
  source: ["source", "origine"],
  contactName: ["nom", "name", "propriétaire", "proprietaire"],
  phone: ["téléphone", "telephone", "tel", "phone"],
  email: ["courriel", "email", "e-mail"],
  facebookUrl: ["facebookurl", "facebook url", "facebook", "facebook_profile", "facebook profile"],
  contactStatus: ["statutcontact", "statut contact", "contactstatus", "contact status", "statut"],
  category: ["catégorie", "categorie", "category"],
  notes: ["notes", "note", "commentaires", "comments"],
};

export function parseProspectsCsv(csvText: string, fileName = "import.csv"): ProspectRecord[] {
  const rows = parseCsv(csvText);
  const now = new Date().toISOString();
  validateRequiredColumns(rows);

  const prospects = rows.map<ProspectRecord | null>((row, index) => {
      const address = readCsvValue(row, "address");
      const city = readCsvValue(row, "city");
      const province = readCsvValue(row, "province");
      const postalCode = readCsvValue(row, "postalCode");
      const ownerName = readCsvValue(row, "ownerName");
      const source = readCsvValue(row, "source") || "CSV";
      const contactName = readCsvValue(row, "contactName");
      const phone = readCsvValue(row, "phone");
      const email = readCsvValue(row, "email");
      const facebookUrl = readCsvValue(row, "facebookUrl");
      const contactStatus = normalizeContactStatus(readCsvValue(row, "contactStatus"));
      const rawCategory = readCsvValue(row, "category");
      const notes = readCsvValue(row, "notes");
      const category = normalizeCategory(rawCategory || notes);
      const propertyType = inferPropertyType(rawCategory, notes);
      const opportunityScore = calculateOpportunityScore({ category, propertyType, notes });

      if (!address && !city && !ownerName && !contactName) return null;

      const prospect: Prospect = {
        id: `csv-${slugify(fileName)}-${index + 1}-${slugify(address || ownerName || contactName || city)}`,
        nomProprietaire: ownerName || contactName || undefined,
        adresse: address || "Adresse non précisée",
        ville: city || "Ville non précisée",
        province: province || "QC",
        codePostal: postalCode || "Non précisé",
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
        },
      } satisfies ProspectRecord;
    });

  return prospects.filter((row): row is ProspectRecord => row !== null);
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

function validateRequiredColumns(rows: CsvRow[]) {
  if (!rows.length) {
    throw new Error("Le CSV est vide.");
  }

  const requiredFields: Array<keyof typeof csvHeaderAliases> = ["address", "city", "province", "postalCode", "ownerName", "source"];
  const firstRow = rows[0];
  const missing = requiredFields.filter((field) => !csvHeaderAliases[field].some((alias) => firstRow[normalizeHeader(alias)] !== undefined));

  if (missing.length) {
    throw new Error("Colonnes minimales requises: adresse, ville, province, codePostal, nomProprietaire, source.");
  }
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

function inferPropertyType(category: string, notes: string) {
  const searchable = `${category} ${notes}`.toLowerCase();
  if (searchable.includes("terrain")) return "Terrain";
  if (searchable.includes("duplex")) return "Duplex";
  if (searchable.includes("triplex")) return "Triplex";
  if (searchable.includes("multiplex") || searchable.includes("plex")) return "Multiplex";
  if (searchable.includes("condo")) return "Condo";
  if (searchable.includes("commercial")) return "Commercial";
  return "Propriété";
}

function buildCsvReason({ category, notes, contactName }: { category: string; notes: string; contactName: string }) {
  const base = notes ? notes : "Prospect importé par CSV. Le score est calculé selon la catégorie et les signaux présents dans les notes.";
  return contactName ? `${base} Contact identifié : ${contactName}. Catégorie : ${category}.` : `${base} Catégorie : ${category}.`;
}

function normalizeContactStatus(value: string): Prospect["statutContact"] {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "nouveau";
  if (normalized.includes("relanc")) return "a_relancer";
  if (normalized.includes("qualif")) return "qualifie";
  if (normalized.includes("cours") || normalized.includes("en cours")) return "en_cours";
  if (normalized.includes("contact") || normalized.includes("joint")) return "contacte";
  if (normalized.includes("a contacter") || normalized.includes("à contacter")) return "a_contacter";
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
