import { ProviderRegistry, mergeOfficialProperties, type OfficialProperty, type ProviderContext, type ProviderSyncResult } from "@/lib/providers";

import { findMunicipalityCatalogEntry } from "./government-catalog";
import type { CityDataSource, Municipality } from "./municipality";
import { createProviderForSource } from "./providers/provider-factory";

export type DiscoveryEngineOptions = ProviderContext & {
  includeInactiveSources?: boolean;
};

export type CityDiscoveryResult = {
  city: string;
  municipality: Municipality | null;
  sources: CityDataSource[];
  results: ProviderSyncResult[];
  opportunities: OfficialProperty[];
  errors: string[];
  warnings: string[];
};

export class DiscoveryEngine {
  async getCityOpportunities(city: string, options: DiscoveryEngineOptions = {}): Promise<CityDiscoveryResult> {
    const entry = findMunicipalityCatalogEntry(city);

    if (!entry) {
      return {
        city,
        municipality: null,
        sources: [],
        results: [],
        opportunities: [],
        errors: [`Aucune source publique configuree pour ${city}.`],
        warnings: [],
      };
    }

    const sources = entry.sources.filter((source) => options.includeInactiveSources || source.active);
    const registry = new ProviderRegistry();

    for (const source of sources) {
      registry.registerProvider(createProviderForSource(entry.municipality, source));
    }

    const synced = await registry.sync({
      ...options,
      metadata: {
        ...(options.metadata || {}),
        city: entry.municipality.name,
        municipalityId: entry.municipality.id,
      },
    });

    return {
      city: entry.municipality.name,
      municipality: entry.municipality,
      sources,
      results: synced.results,
      opportunities: mergeOfficialProperties(synced.properties),
      errors: synced.errors,
      warnings: synced.warnings,
    };
  }
}

export const discoveryEngine = new DiscoveryEngine();

export function getCityOpportunities(city: string, options?: DiscoveryEngineOptions) {
  return discoveryEngine.getCityOpportunities(city, options);
}
