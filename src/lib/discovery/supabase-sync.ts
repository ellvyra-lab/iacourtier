import type { SupabaseClient } from "@supabase/supabase-js";

import type { CityDiscoveryResult } from "./discovery-engine";
import type { OfficialProperty } from "@/lib/providers";

export async function persistDiscoveryResult(supabase: SupabaseClient, result: CityDiscoveryResult) {
  const now = new Date().toISOString();
  const opportunities = result.opportunities.map((property) => propertyToRadarOpportunity(property, now));

  if (opportunities.length) {
    const { error } = await supabase.from("radar_opportunities").upsert(opportunities, { onConflict: "dedupe_key" });
    if (error) throw error;
  }

  return {
    city: result.city,
    sourceCount: result.sources.length,
    opportunityCount: opportunities.length,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export async function persistDiscoveryResults(supabase: SupabaseClient, results: CityDiscoveryResult[]) {
  const persisted = [];

  for (const result of results) {
    persisted.push(await persistDiscoveryResult(supabase, result));
  }

  return persisted;
}

function propertyToRadarOpportunity(property: OfficialProperty, now: string) {
  const sourceUrl = property.sources[0]?.sourceUrl || null;
  const sourceNames = property.sources.map((source) => source.providerName);

  return {
    dedupe_key: property.propertyKey,
    address: property.address,
    city: property.city,
    owner_name: property.ownerName || null,
    property_type: property.propertyType || "Propriété",
    category: inferCategory(property),
    reason: buildReason(property),
    opportunity_score: property.score.value,
    priority: priorityLabel(property.score.priority),
    source: "government",
    source_url: sourceUrl,
    raw_data: {
      ...(property.rawData || {}),
      property_key: property.propertyKey,
      normalized_address: property.normalizedAddress,
      postal_code: property.postalCode || null,
      latitude: property.latitude || null,
      longitude: property.longitude || null,
      sources: sourceNames,
      score_reasons: property.score.reasons,
      score_breakdown: property.score.breakdown,
      first_seen_at: property.firstSeenAt,
      last_seen_at: property.lastSeenAt,
    },
    lot: property.lotNumber || null,
    cadastre: property.cadastre || null,
    matricule: property.matricule || null,
    first_seen_at: property.firstSeenAt || now,
    last_seen_at: now,
    updated_at: now,
  };
}

function inferCategory(property: OfficialProperty) {
  const type = (property.propertyType || "").toLowerCase();
  if (type.includes("terrain")) return "Terrains";
  if (type.includes("plex") || type.includes("logement")) return "Multiplex";
  if (property.sources.some((source) => source.domain === "permits")) return "Vendeurs potentiels";
  if (property.sources.some((source) => source.domain === "judicial")) return "Reprises de finance";
  return "Gouvernement";
}

function buildReason(property: OfficialProperty) {
  const sources = property.sources.map((source) => source.providerName).join(", ");
  const reasons = property.score.reasons.length ? property.score.reasons.join(", ") : "données publiques compatibles détectées";
  return `Découverte automatique pour ${property.city}. Sources : ${sources}. Signaux : ${reasons}.`;
}

function priorityLabel(priority: OfficialProperty["score"]["priority"]) {
  if (priority === "high") return "Élevée";
  if (priority === "medium") return "Moyenne";
  return "Faible";
}
