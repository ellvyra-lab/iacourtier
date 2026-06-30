import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProspectRecord, ProspectingPriority } from "./types";

export const MAX_GOVERNMENT_SOURCE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_GOVERNMENT_SOURCE_LIMIT = 200;

export type GovernmentSourceType = "CSV" | "XML" | "API";

export type GovernmentSourceRecord = {
  id: string;
  name: string;
  province: string | null;
  city: string | null;
  organization: string | null;
  url: string;
  source_type: GovernmentSourceType;
  update_frequency: string | null;
  active: boolean;
  last_synced_at: string | null;
  status: string | null;
  last_error: string | null;
  record_count: number | null;
  created_at?: string;
  updated_at?: string;
};

export type GovernmentRow = Record<string, string>;

type TransformOptions = {
  sourceUrl: string;
  targetCity?: string;
  sourceId?: string;
  sourceName?: string;
  lastUpdated?: string;
};

type SyncResult = {
  sourceId: string;
  sourceName: string;
  recordCount: number;
  upsertedCount: number;
  status: "success" | "error";
  error: string | null;
};

const fieldAliases = {
  address: ["adresse", "address", "localisation", "emplacement", "site"],
  civicNumber: ["no_civique", "numero_civique", "civic_number", "street_number", "numero"],
  streetName: ["rue", "nom_rue", "street_name", "street", "voie"],
  city: ["ville", "municipalite", "municipalité", "municipality", "nom_municipalite", "nom_municipalité"],
  lot: ["lot", "numero_lot", "num_lot", "no_lot"],
  cadastre: ["cadastre", "numero_cadastre", "no_cadastre"],
  matricule: ["matricule", "role", "numero_matricule", "matricule_immeuble"],
  owner: ["proprietaire", "propriétaire", "owner", "nom_proprietaire", "nom_propriétaire"],
  usage: ["usage", "type", "categorie", "catégorie", "code_utilisation", "utilisation", "classe"],
  value: ["valeur", "evaluation", "évaluation", "valeur_immeuble", "valeur_batiment", "valeur_bâtiment", "valeur_terrain"],
};

export async function fetchGovernmentSourceText(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Utilisez une URL publique HTTP ou HTTPS.");
  }

  const response = await fetch(url, {
    headers: { Accept: "text/csv, application/xml, text/xml, application/json, text/plain, */*" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`La source publique a retourné le statut ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_GOVERNMENT_SOURCE_BYTES) {
    throw new Error("Le fichier est trop volumineux pour cette version bêta.");
  }

  const text = await response.text();
  if (new Blob([text]).size > MAX_GOVERNMENT_SOURCE_BYTES) {
    throw new Error("Le fichier est trop volumineux pour cette version bêta.");
  }

  return {
    text,
    contentType: response.headers.get("content-type") || "",
  };
}

export function parseGovernmentRows(text: string, contentType: string, sourceUrl: string): GovernmentRow[] {
  const format = detectGovernmentFormat(text, contentType, sourceUrl);
  if (format === "xml") return parseXmlRows(text);
  if (format === "json") return parseJsonRows(text);
  return parseCsvRows(text);
}

export function detectGovernmentFormat(text: string, contentType: string, sourceUrl: string) {
  const lowerUrl = sourceUrl.toLowerCase();
  const lowerType = contentType.toLowerCase();
  const trimmed = text.trimStart();
  if (lowerType.includes("json") || lowerUrl.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (lowerType.includes("xml") || lowerUrl.endsWith(".xml") || trimmed.startsWith("<")) return "xml";
  return "csv";
}

export function transformGovernmentRow(row: GovernmentRow, index: number, options: TransformOptions): ProspectRecord | null {
  const address = readField(row, fieldAliases.address) || joinAddress(readField(row, fieldAliases.civicNumber), readField(row, fieldAliases.streetName));
  const city = readField(row, fieldAliases.city);
  const ownerName = readField(row, fieldAliases.owner);
  const lot = readField(row, fieldAliases.lot);
  const cadastre = readField(row, fieldAliases.cadastre);
  const matricule = readField(row, fieldAliases.matricule);
  const usage = readField(row, fieldAliases.usage);
  const value = readField(row, fieldAliases.value);
  const targetCity = options.targetCity || "";

  if (!address && !city && !ownerName && !lot && !cadastre && !matricule) return null;

  const propertyType = inferPropertyType(usage, row);
  const score = scoreGovernmentOpportunity({ ownerName, propertyType, usage, value, lot: lot || cadastre, city, targetCity, address });
  const dedupeKey = buildRadarDedupeKey({ address, city: city || targetCity, lot, cadastre, matricule });

  return {
    id: dedupeKey || `government-${index + 1}-${slugify(address || lot || cadastre || matricule || ownerName || city || "opportunity")}`,
    address: address || lot || cadastre || matricule || "Adresse non détectée",
    city: city || targetCity || "Ville non détectée",
    ownerName: ownerName || undefined,
    contactName: ownerName || undefined,
    propertyType,
    category: inferCategory(propertyType, usage),
    reason: buildReason({ ownerName, propertyType, usage, value, lot: lot || cadastre || matricule, city, targetCity, address, sourceName: options.sourceName }),
    opportunityScore: score,
    priority: priorityFromScore(score),
    source: "government",
    url: options.sourceUrl,
    sourceUrl: options.sourceUrl,
    rawData: { ...row, lot, cadastre, matricule, dedupeKey, sourceId: options.sourceId },
    lastUpdated: options.lastUpdated || new Date().toISOString(),
  };
}

export function buildRadarDedupeKey({
  address,
  city,
  lot,
  cadastre,
  matricule,
}: {
  address?: string;
  city?: string;
  lot?: string;
  cadastre?: string;
  matricule?: string;
}) {
  const identity = [normalize(matricule || ""), normalize(lot || ""), normalize(cadastre || "")].filter(Boolean).join("|");
  const location = [normalize(address || ""), normalize(city || "")].filter(Boolean).join("|");
  return [identity, location].filter(Boolean).join("::") || "";
}

export async function syncGovernmentSource(supabase: SupabaseClient, source: GovernmentSourceRecord, limit = DEFAULT_GOVERNMENT_SOURCE_LIMIT): Promise<SyncResult> {
  try {
    await supabase.from("government_sources").update({ status: "syncing", last_error: null, updated_at: new Date().toISOString() }).eq("id", source.id);

    const { text, contentType } = await fetchGovernmentSourceText(source.url);
    const rows = parseGovernmentRows(text, contentType, source.url);
    const now = new Date().toISOString();
    const opportunities = rows
      .map((row, index) =>
        transformGovernmentRow(row, index, {
          sourceUrl: source.url,
          targetCity: source.city || "",
          sourceId: source.id,
          sourceName: source.name,
          lastUpdated: now,
        }),
      )
      .filter((item): item is ProspectRecord => Boolean(item))
      .slice(0, limit);

    const payload = opportunities.map((item) => ({
      source_id: source.id,
      dedupe_key: item.id,
      address: item.address,
      city: item.city,
      owner_name: item.ownerName || null,
      property_type: item.propertyType,
      category: item.category,
      reason: item.reason,
      opportunity_score: item.opportunityScore,
      priority: item.priority,
      source: item.source,
      source_url: item.sourceUrl || item.url,
      raw_data: item.rawData || {},
      lot: stringFromRaw(item.rawData, "lot"),
      cadastre: stringFromRaw(item.rawData, "cadastre"),
      matricule: stringFromRaw(item.rawData, "matricule"),
      last_seen_at: now,
      updated_at: now,
    }));

    if (payload.length) {
      const { error } = await supabase.from("radar_opportunities").upsert(payload, { onConflict: "dedupe_key" });
      if (error) throw error;
    }

    await supabase
      .from("government_sources")
      .update({
        last_synced_at: now,
        status: "success",
        last_error: null,
        record_count: opportunities.length,
        updated_at: now,
      })
      .eq("id", source.id);

    return {
      sourceId: source.id,
      sourceName: source.name,
      recordCount: opportunities.length,
      upsertedCount: payload.length,
      status: "success",
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "La synchronisation a échoué.";
    await supabase
      .from("government_sources")
      .update({
        status: "error",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id);

    return {
      sourceId: source.id,
      sourceName: source.name,
      recordCount: 0,
      upsertedCount: 0,
      status: "error",
      error: message,
    };
  }
}

export function prospectFromRadarRow(row: Record<string, unknown>): ProspectRecord {
  return {
    id: String(row.dedupe_key || row.id || ""),
    address: String(row.address || "Adresse non détectée"),
    city: String(row.city || "Ville non détectée"),
    ownerName: optionalString(row.owner_name),
    contactName: optionalString(row.owner_name),
    propertyType: String(row.property_type || "Propriété"),
    category: String(row.category || "Gouvernement") as ProspectRecord["category"],
    reason: String(row.reason || "Source gouvernementale synchronisée."),
    opportunityScore: Number(row.opportunity_score || 0),
    priority: String(row.priority || "Faible") as ProspectingPriority,
    source: "government",
    url: optionalString(row.source_url) || null,
    sourceUrl: optionalString(row.source_url) || null,
    rawData: isRecord(row.raw_data) ? row.raw_data : {},
    lastUpdated: String(row.last_seen_at || row.updated_at || new Date().toISOString()),
  };
}

function scoreGovernmentOpportunity({
  ownerName,
  propertyType,
  usage,
  value,
  lot,
  city,
  targetCity,
  address,
}: {
  ownerName: string;
  propertyType: string;
  usage: string;
  value: string;
  lot: string;
  city: string;
  targetCity: string;
  address: string;
}) {
  const searchable = `${propertyType} ${usage}`.toLowerCase();
  let score = 25;
  if (ownerName) score += 20;
  if (searchable.includes("terrain")) score += 15;
  if (/(multiplex|plex|duplex|triplex|logement|logements|revenu)/i.test(searchable)) score += 15;
  if (value) score += 10;
  if (targetCity && normalize(city) === normalize(targetCity)) score += 10;
  if (lot) score += 10;
  if ([address, city, propertyType, ownerName, value, lot].filter(Boolean).length >= 4) score += 10;
  return Math.max(0, Math.min(100, score));
}

function priorityFromScore(score: number): ProspectingPriority {
  if (score >= 80) return "Élevée";
  if (score >= 60) return "Moyenne";
  return "Faible";
}

function buildReason({
  ownerName,
  propertyType,
  usage,
  value,
  lot,
  city,
  targetCity,
  address,
  sourceName,
}: {
  ownerName: string;
  propertyType: string;
  usage: string;
  value: string;
  lot: string;
  city: string;
  targetCity: string;
  address: string;
  sourceName?: string;
}) {
  const signals = [
    ownerName ? "propriétaire détecté" : "",
    propertyType !== "Propriété" ? `type détecté : ${propertyType}` : "",
    value ? "valeur ou évaluation détectée" : "",
    lot ? "lot/cadastre/matricule détecté" : "",
    targetCity && normalize(city) === normalize(targetCity) ? "ville ciblée correspondante" : "",
    address ? "adresse détectée" : "",
    usage ? `usage : ${usage}` : "",
  ].filter(Boolean);

  const sourceIntro = sourceName ? `Source publique ${sourceName} synchronisée.` : "Source gouvernementale publique synchronisée.";
  return signals.length ? `${sourceIntro} Signaux : ${signals.join(", ")}.` : `${sourceIntro} Données partielles à valider.`;
}

function inferCategory(propertyType: string, usage: string): ProspectRecord["category"] {
  const searchable = `${propertyType} ${usage}`.toLowerCase();
  if (searchable.includes("terrain")) return "Terrains";
  if (/(multiplex|plex|duplex|triplex|logement|revenu)/i.test(searchable)) return "Multiplex";
  return "Gouvernement";
}

function inferPropertyType(usage: string, row: GovernmentRow) {
  const searchable = `${usage} ${Object.values(row).join(" ")}`.toLowerCase();
  if (searchable.includes("terrain")) return "Terrain";
  if (searchable.includes("duplex")) return "Duplex";
  if (searchable.includes("triplex")) return "Triplex";
  if (searchable.includes("multiplex") || searchable.includes("plex")) return "Multiplex";
  if (searchable.includes("condo")) return "Condo";
  if (searchable.includes("commercial")) return "Commercial";
  if (searchable.includes("logement")) return "Plex";
  return usage || "Propriété";
}

function parseCsvRows(text: string): GovernmentRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = parseCsvRecords(normalized).filter((record) => record.some((cell) => cell.trim()));
  const [headers, ...body] = records;
  if (!headers?.length) return [];
  const normalizedHeaders = headers.map(normalizeKey);

  return body.map((record) =>
    normalizedHeaders.reduce<GovernmentRow>((row, header, index) => {
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
    if ((char === "," || char === ";") && !inQuotes) {
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

function parseXmlRows(text: string): GovernmentRow[] {
  const itemMatches = Array.from(text.matchAll(/<([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g));
  const candidates = itemMatches.map((match) => xmlObjectFromBlock(match[2])).filter((row) => Object.keys(row).length >= 2);

  return candidates.length ? candidates.slice(0, 1000) : [xmlObjectFromBlock(text)].filter((row) => Object.keys(row).length);
}

function parseJsonRows(text: string): GovernmentRow[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.records) ? parsed.records : isRecord(parsed) && Array.isArray(parsed.features) ? parsed.features : [];
  return rows.map(flattenJsonRow).filter((row) => Object.keys(row).length);
}

function flattenJsonRow(value: unknown): GovernmentRow {
  const row: GovernmentRow = {};
  const source = isRecord(value) && isRecord(value.properties) ? value.properties : value;
  if (!isRecord(source)) return row;

  for (const [key, entry] of Object.entries(source)) {
    if (entry === null || entry === undefined) continue;
    row[normalizeKey(key)] = typeof entry === "object" ? JSON.stringify(entry) : String(entry);
  }
  return row;
}

function xmlObjectFromBlock(block: string): GovernmentRow {
  const row: GovernmentRow = {};
  for (const match of block.matchAll(/<([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) {
    const key = normalizeKey(match[1].split(":").pop() || match[1]);
    const value = decodeXml(match[2]).trim();
    if (key && value) row[key] = value;
  }
  return row;
}

function readField(row: GovernmentRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value) return value;
  }
  return "";
}

function joinAddress(civicNumber: string, streetName: string) {
  return [civicNumber, streetName].filter(Boolean).join(" ").trim();
}

function normalizeKey(value: string) {
  return normalize(value).replace(/\s+/g, "_");
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function slugify(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function stringFromRaw(rawData: ProspectRecord["rawData"], key: string) {
  const value = rawData?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
