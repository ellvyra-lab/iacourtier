import { calculateOpportunityScore, normalizeCategory, priorityFromScore } from "./score";
import type { ProspectRecord } from "./types";

type CsvRow = Record<string, string>;

const csvHeaderAliases: Record<string, string[]> = {
  address: ["adresse", "address"],
  city: ["ville", "city"],
  contactName: ["nom", "name", "propriétaire", "proprietaire"],
  phone: ["téléphone", "telephone", "tel", "phone"],
  email: ["courriel", "email", "e-mail"],
  category: ["catégorie", "categorie", "category"],
  notes: ["notes", "note", "commentaires", "comments"],
};

export function parseProspectsCsv(csvText: string, fileName = "import.csv"): ProspectRecord[] {
  const rows = parseCsv(csvText);
  const now = new Date().toISOString();

  const prospects = rows.map<ProspectRecord | null>((row, index) => {
      const address = readCsvValue(row, "address");
      const city = readCsvValue(row, "city");
      const contactName = readCsvValue(row, "contactName");
      const phone = readCsvValue(row, "phone");
      const email = readCsvValue(row, "email");
      const rawCategory = readCsvValue(row, "category");
      const notes = readCsvValue(row, "notes");
      const category = normalizeCategory(rawCategory || notes);
      const propertyType = inferPropertyType(rawCategory, notes);
      const opportunityScore = calculateOpportunityScore({ category, propertyType, notes });

      if (!address && !city && !contactName) return null;

      return {
        id: `csv-${slugify(fileName)}-${index + 1}-${slugify(address || contactName || city)}`,
        address: address || "Adresse non précisée",
        city: city || "Ville non précisée",
        propertyType,
        category,
        reason: buildCsvReason({ category, notes, contactName }),
        opportunityScore,
        priority: priorityFromScore(opportunityScore),
        source: "csv",
        url: null,
        lastUpdated: now,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
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

function parseCsvRecords(value: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

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

    if (char === "," && !inQuotes) {
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}
