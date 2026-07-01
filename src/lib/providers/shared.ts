import type { OfficialProperty, OfficialPropertyScore, PropertyPriority, PropertySourceContribution, ProviderConfig, ProviderValidationResult } from "./types";

export function normalizeText(value: string | undefined | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createPropertyKey(input: { address?: string; city?: string; matricule?: string; lotNumber?: string; cadastre?: string }) {
  const identity = [input.matricule, input.lotNumber, input.cadastre].map(normalizeText).filter(Boolean).join("|");
  const location = [input.address, input.city].map(normalizeText).filter(Boolean).join("|");
  return [identity, location].filter(Boolean).join("::") || stableHash(JSON.stringify(input));
}

export function createSourceContribution(config: ProviderConfig, rawData?: Record<string, unknown>): PropertySourceContribution {
  return {
    providerId: config.id,
    providerName: config.name,
    domain: config.domain,
    sourceUrl: config.sourceUrl,
    fetchedAt: new Date().toISOString(),
    rawData,
  };
}

export function createBaseScore(score: number, reasons: string[] = [], breakdown: OfficialPropertyScore["breakdown"] = []): OfficialPropertyScore {
  const value = clampScore(score);
  return {
    value,
    priority: priorityFromScore(value),
    reasons,
    breakdown,
  };
}

export function priorityFromScore(score: number): PropertyPriority {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function validateOfficialProperties(properties: OfficialProperty[]): ProviderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  properties.forEach((property, index) => {
    if (!property.propertyKey) errors.push(`Property ${index + 1}: propertyKey is required.`);
    if (!property.address && !property.matricule && !property.lotNumber) warnings.push(`Property ${index + 1}: weak identity, missing address/matricule/lot.`);
    if (!property.city) warnings.push(`Property ${index + 1}: city is missing.`);
    if (!property.sources.length) warnings.push(`Property ${index + 1}: no source contribution.`);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function mergeOfficialProperties(properties: OfficialProperty[]) {
  const merged = new Map<string, OfficialProperty>();

  for (const property of properties) {
    const existing = merged.get(property.propertyKey);
    if (!existing) {
      merged.set(property.propertyKey, property);
      continue;
    }

    merged.set(property.propertyKey, {
      ...existing,
      ...withoutEmptyValues(property),
      score: property.score.value >= existing.score.value ? property.score : existing.score,
      sources: dedupeSources([...existing.sources, ...property.sources]),
      rawData: {
        ...(existing.rawData || {}),
        ...(property.rawData || {}),
      },
      firstSeenAt: existing.firstSeenAt < property.firstSeenAt ? existing.firstSeenAt : property.firstSeenAt,
      lastSeenAt: existing.lastSeenAt > property.lastSeenAt ? existing.lastSeenAt : property.lastSeenAt,
    });
  }

  return Array.from(merged.values());
}

export function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function withoutEmptyValues(property: OfficialProperty) {
  return Object.fromEntries(Object.entries(property).filter(([, value]) => value !== undefined && value !== null && value !== "")) as Partial<OfficialProperty>;
}

function dedupeSources(sources: PropertySourceContribution[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.providerId}:${source.sourceUrl || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
