import type { ProspectRecord, ProspectingPriority } from "../types";

export type RoleEvaluationBuilding = {
  leadHash: string;
  address: string;
  city: string;
  matricule: string;
  lotNumber: string;
  cadastre: string;
  ownerName: string;
  yearBuilt: string;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  propertyType: string;
  housingCount: number | null;
  landArea: number | null;
  acquisitionDate: string;
  hasPool: boolean | null;
  hasGarage: boolean | null;
  ownerYears: number | null;
  normalizedPropertyKey: string;
  rawData: Record<string, string>;
};

export type RoleEvaluationScoringConfig = {
  longOwnerYears: number;
  highValueThreshold: number;
  importantLandAreaThreshold: number;
  oldConstructionYear: number;
  recentSaleYears: number;
  weights: {
    longOwner: number;
    highValue: number;
    singleFamily: number;
    noPoolDetected: number;
    noGarageDetected: number;
    importantLand: number;
    oldConstruction: number;
    noRecentSaleDetected: number;
    belowSectorAverage: number;
    multiUnit: number;
    completeData: number;
  };
};

export type RoleEvaluationParseOptions = {
  city?: string;
  sourceName?: string;
  sourceUrl?: string | null;
  limit?: number;
  scoringConfig?: Partial<RoleEvaluationScoringConfig>;
  onProgress?: (progress: { parsed: number; percent?: number }) => void;
};

type ScoreResult = {
  score: number;
  reasons: string[];
  breakdown: Array<{ label: string; points: number }>;
};

export const defaultRoleEvaluationScoringConfig: RoleEvaluationScoringConfig = {
  longOwnerYears: 10,
  highValueThreshold: 750_000,
  importantLandAreaThreshold: 700,
  oldConstructionYear: 1990,
  recentSaleYears: 5,
  weights: {
    longOwner: 25,
    highValue: 20,
    singleFamily: 15,
    noPoolDetected: 5,
    noGarageDetected: 5,
    importantLand: 10,
    oldConstruction: 10,
    noRecentSaleDetected: 15,
    belowSectorAverage: 10,
    multiUnit: 15,
    completeData: 10,
  },
};

const MAX_BUFFER_LENGTH = 2_000_000;

export async function parseRoleEvaluationFile(file: File, options: RoleEvaluationParseOptions = {}) {
  const decoder = new TextDecoder("utf-8");
  const reader = file.stream().getReader();
  const buildings: RoleEvaluationBuilding[] = [];
  let buffer = "";
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    buffer += decoder.decode(value, { stream: true });

    for (const block of extractBlocksFromBuffer(buffer)) {
      const building = extractRoleEvaluationData(block, options.city || "");
      if (building.address || building.matricule || building.lotNumber) buildings.push(building);
    }

    const lastEnd = buffer.lastIndexOf("</RLUEx>");
    if (lastEnd >= 0) buffer = buffer.slice(lastEnd + "</RLUEx>".length);
    if (buffer.length > MAX_BUFFER_LENGTH) buffer = buffer.slice(-MAX_BUFFER_LENGTH);

    options.onProgress?.({
      parsed: buildings.length,
      percent: file.size ? Math.min(100, Math.round((received / file.size) * 100)) : undefined,
    });

    if (options.limit && buildings.length >= options.limit) {
      await reader.cancel();
      break;
    }
  }

  return buildingsToProspects(buildings.slice(0, options.limit || buildings.length), {
    ...options,
    sourceName: options.sourceName || file.name,
  });
}

export async function parseRoleEvaluationUrl(url: string, options: RoleEvaluationParseOptions = {}) {
  if (url.toLowerCase().endsWith(".zip")) {
    throw new Error("Les fichiers ZIP sont prevus dans l'architecture, mais l'import ZIP sera branche dans une prochaine version.");
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`La source XML a retourne le statut ${response.status}.`);
  const xml = await response.text();
  return parseRoleEvaluationXml(xml, { ...options, sourceUrl: url });
}

export function parseRoleEvaluationXml(xml: string, options: RoleEvaluationParseOptions = {}) {
  const buildings: RoleEvaluationBuilding[] = [];
  for (const match of xml.matchAll(/<RLUEx\b[^>]*>[\s\S]*?<\/RLUEx>/g)) {
    const building = extractRoleEvaluationData(match[0], options.city || "");
    if (building.address || building.matricule || building.lotNumber) buildings.push(building);
    if (options.limit && buildings.length >= options.limit) break;
  }
  return buildingsToProspects(buildings, options);
}

export function transformRoleEvaluationBlock(block: string, index: number, options: RoleEvaluationParseOptions = {}): ProspectRecord | null {
  const [prospect] = buildingsToProspects([extractRoleEvaluationData(block, options.city || "")], options);
  return prospect || null;
}

export function buildingsToProspects(buildings: RoleEvaluationBuilding[], options: RoleEvaluationParseOptions = {}) {
  const sectorAverages = buildSectorAverages(buildings);
  const config = mergeScoringConfig(options.scoringConfig);

  return buildings.map((building, index) => {
    const scoreResult = scoreRoleEvaluationLead(building, sectorAverages, config);
    const category = building.propertyType === "Terrain" ? "Terrains" : building.housingCount && building.housingCount >= 2 ? "Multiplex" : "Rôle d'évaluation";

    return {
      id: building.leadHash || `role-evaluation-${index + 1}`,
      leadHash: building.leadHash,
      address: building.address || building.matricule || building.lotNumber || "Adresse non détectée",
      city: building.city || "Ville non détectée",
      ownerName: building.ownerName || undefined,
      contactName: building.ownerName || undefined,
      propertyType: building.propertyType,
      category,
      reason: buildReason(building, scoreResult),
      opportunityScore: scoreResult.score,
      priority: priorityFromScore(scoreResult.score),
      source: "role_evaluation",
      url: options.sourceUrl || null,
      sourceUrl: options.sourceUrl || null,
      rawData: {
        ...building.rawData,
        lead_hash: building.leadHash,
        normalized_property_key: building.normalizedPropertyKey,
        matricule: building.matricule,
        lot_number: building.lotNumber,
        cadastre: building.cadastre,
        owner_name: building.ownerName,
        year_built: building.yearBuilt,
        land_value: building.landValue,
        building_value: building.buildingValue,
        total_value: building.totalValue,
        housing_count: building.housingCount,
        land_area: building.landArea,
        acquisition_date: building.acquisitionDate,
        owner_years: building.ownerYears,
        has_pool: building.hasPool,
        has_garage: building.hasGarage,
        sector: getSectorLabel(building),
        sector_average_value: sectorAverages[getSectorKey(building)] || null,
        score_reasons: scoreResult.reasons,
        score_breakdown: scoreResult.breakdown,
        enrichment_sources: [options.sourceName || "Rôle d'évaluation"],
        source_name: options.sourceName,
      },
      lastUpdated: new Date().toISOString(),
    } satisfies ProspectRecord;
  });
}

function extractRoleEvaluationData(block: string, fallbackCity: string): RoleEvaluationBuilding {
  const civicStart = readTag(block, "RL0101Ax");
  const civicEnd = readTag(block, "RL0101Cx");
  const streetType = readTag(block, "RL0101Ex");
  const streetName = readTag(block, "RL0101Gx");
  const lotNumber = readTag(block, "RL0103Ax");
  const matricule = [readTag(block, "RL0104A"), readTag(block, "RL0104B"), readTag(block, "RL0104C"), readTag(block, "RL0104D")].filter(Boolean).join("-");
  const usageCode = readTag(block, "RL0105A");
  const cadastre = readTag(block, "RL0106A");
  const acquisitionDate = readTag(block, "RL0201Gx");
  const landArea = parseNumber(readTag(block, "RL0302A"));
  const housingCount = parseNumber(readTag(block, "RL0306A"));
  const yearBuilt = readTag(block, "RL0307A");
  const landValue = parseNumber(readTag(block, "RL0402A"));
  const buildingValue = parseNumber(readTag(block, "RL0403A"));
  const totalValue = parseNumber(readTag(block, "RL0404A"));
  const address = buildAddress(civicStart, civicEnd, streetType, streetName);
  const city = fallbackCity || readFirstTag(block, ["RLM01A", "municipalite", "ville"]);
  const propertyType = inferPropertyType(usageCode, housingCount, buildingValue, block);
  const ownerName = readFirstTag(block, ["RL0201A", "RL0201Bx", "RL0201Cx", "RL0201Dx"]);
  const hasPool = detectFeature(block, ["piscine", "pool"]);
  const hasGarage = detectFeature(block, ["garage"]);
  const ownerYears = calculateOwnerYears(acquisitionDate);
  const normalizedPropertyKey = buildNormalizedPropertyKey({ address, city, matricule });
  const leadHash = buildLeadHash({ address, city, matricule, lotNumber, cadastre });

  return {
    leadHash,
    address,
    city,
    matricule,
    lotNumber,
    cadastre,
    ownerName,
    yearBuilt,
    landValue,
    buildingValue,
    totalValue,
    propertyType,
    housingCount,
    landArea,
    acquisitionDate,
    hasPool,
    hasGarage,
    ownerYears,
    normalizedPropertyKey,
    rawData: {
      civic_start: civicStart,
      civic_end: civicEnd,
      street_type: streetType,
      street_name: streetName,
      usage_code: usageCode,
    },
  };
}

function extractBlocksFromBuffer(buffer: string) {
  return Array.from(buffer.matchAll(/<RLUEx\b[^>]*>[\s\S]*?<\/RLUEx>/g)).map((match) => match[0]);
}

function scoreRoleEvaluationLead(building: RoleEvaluationBuilding, sectorAverages: Record<string, number>, config: RoleEvaluationScoringConfig): ScoreResult {
  const breakdown: ScoreResult["breakdown"] = [];
  const reasons: string[] = [];
  const add = (condition: boolean, points: number, label: string) => {
    if (!condition) return;
    breakdown.push({ label, points });
    reasons.push(label);
  };

  const sectorAverage = sectorAverages[getSectorKey(building)] || 0;

  add((building.ownerYears || 0) >= config.longOwnerYears, config.weights.longOwner, `Propriétaire depuis ${building.ownerYears} ans`);
  add((building.totalValue || 0) >= config.highValueThreshold, config.weights.highValue, `Valeur foncière élevée (${formatMoney(building.totalValue || 0)})`);
  add(building.propertyType === "Unifamiliale", config.weights.singleFamily, "Maison unifamiliale");
  add(building.hasPool !== true, config.weights.noPoolDetected, "Absence de piscine détectée");
  add(building.hasGarage !== true, config.weights.noGarageDetected, "Absence de garage détectée");
  add((building.landArea || 0) >= config.importantLandAreaThreshold, config.weights.importantLand, `Terrain important (${building.landArea} m²)`);
  add(Number(building.yearBuilt || 0) > 0 && Number(building.yearBuilt) < config.oldConstructionYear, config.weights.oldConstruction, `Construit avant ${config.oldConstructionYear}`);
  add(!building.acquisitionDate || (building.ownerYears || 0) >= config.recentSaleYears, config.weights.noRecentSaleDetected, "Aucune vente récente détectée");
  add(Boolean(sectorAverage && building.totalValue && building.totalValue < sectorAverage), config.weights.belowSectorAverage, "Valeur sous la moyenne du secteur");
  add(Boolean(building.housingCount && building.housingCount >= 2), config.weights.multiUnit, "Plex ou multilogement");
  add([building.address, building.city, building.matricule, building.lotNumber, building.totalValue, building.yearBuilt].filter(Boolean).length >= 5, config.weights.completeData, "Données complètes");

  const score = breakdown.reduce((total, item) => total + item.points, 0);
  return { score: Math.max(0, Math.min(100, score)), reasons, breakdown };
}

function priorityFromScore(score: number): ProspectingPriority {
  if (score >= 80) return "Élevée";
  if (score >= 60) return "Moyenne";
  return "Faible";
}

function buildReason(building: RoleEvaluationBuilding, scoreResult: ScoreResult) {
  return `Score IA basé sur ${scoreResult.reasons.join(", ") || "les données disponibles du rôle"}.`;
}

function inferPropertyType(usageCode: string, housingCount: number | null, buildingValue: number | null, block: string) {
  const searchable = `${usageCode} ${block}`.toLowerCase();
  if (housingCount && housingCount >= 2) return "Plex / multilogement";
  if (housingCount === 1) return "Unifamiliale";
  if (searchable.includes("condo") || searchable.includes("copropriete") || searchable.includes("copropriété")) return "Condo";
  if (buildingValue === 0 || searchable.includes("terrain")) return "Terrain";
  if (usageCode.startsWith("5") || searchable.includes("commercial")) return "Commercial";
  return "Immeuble";
}

function buildAddress(civicStart: string, civicEnd: string, streetType: string, streetName: string) {
  const civic = [civicStart, civicEnd && civicEnd !== civicStart ? civicEnd : ""].filter(Boolean).join("-");
  return [civic, streetType, streetName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildLeadHash({ address, city, matricule, lotNumber, cadastre }: { address: string; city: string; matricule: string; lotNumber: string; cadastre: string }) {
  return stableSlug([matricule, lotNumber, cadastre, address, city].filter(Boolean).join("|"));
}

function buildNormalizedPropertyKey({ address, city, matricule }: { address: string; city: string; matricule: string }) {
  return stableSlug([matricule, address, city].filter(Boolean).join("|"));
}

function buildSectorAverages(buildings: RoleEvaluationBuilding[]) {
  const groups = buildings.reduce<Record<string, { total: number; count: number }>>((accumulator, building) => {
    if (!building.totalValue) return accumulator;
    const key = getSectorKey(building);
    accumulator[key] ||= { total: 0, count: 0 };
    accumulator[key].total += building.totalValue;
    accumulator[key].count += 1;
    return accumulator;
  }, {});

  return Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, Math.round(value.total / Math.max(value.count, 1))]));
}

function getSectorKey(building: RoleEvaluationBuilding) {
  return stableSlug([building.city, building.rawData.street_name, building.propertyType].filter(Boolean).join("|"));
}

function getSectorLabel(building: RoleEvaluationBuilding) {
  return [building.city, building.rawData.street_name].filter(Boolean).join(" - ") || "Secteur non détecté";
}

function readFirstTag(block: string, tags: string[]) {
  for (const tag of tags) {
    const value = readTag(block, tag);
    if (value) return value;
  }
  return "";
}

function readTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] || "").trim();
}

function parseNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateOwnerYears(value: string) {
  if (!value) return null;
  const acquiredAt = new Date(value);
  if (Number.isNaN(acquiredAt.getTime())) return null;
  const years = (Date.now() - acquiredAt.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.floor(years));
}

function detectFeature(block: string, keywords: string[]) {
  const normalized = block.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function mergeScoringConfig(config?: Partial<RoleEvaluationScoringConfig>): RoleEvaluationScoringConfig {
  return {
    ...defaultRoleEvaluationScoringConfig,
    ...config,
    weights: {
      ...defaultRoleEvaluationScoringConfig.weights,
      ...config?.weights,
    },
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function stableSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
