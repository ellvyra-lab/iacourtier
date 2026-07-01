import { mergeOfficialProperties } from "./shared";
import type { OfficialDataProvider, OfficialProperty, ProviderContext, ProviderDomain, ProviderSyncResult } from "./types";

export class ProviderRegistry {
  private providers = new Map<string, OfficialDataProvider>();

  registerProvider(provider: OfficialDataProvider) {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }

    this.providers.set(provider.id, provider);
    return this;
  }

  unregisterProvider(providerId: string) {
    this.providers.delete(providerId);
    return this;
  }

  getProvider(providerId: string) {
    return this.providers.get(providerId);
  }

  getProviders(filter?: { domain?: ProviderDomain; activeOnly?: boolean }) {
    return Array.from(this.providers.values()).filter((provider) => {
      if (filter?.domain && provider.domain !== filter.domain) return false;
      if (filter?.activeOnly && provider.config.active === false) return false;
      return true;
    });
  }

  async sync(context: ProviderContext & { providerIds?: string[]; domain?: ProviderDomain } = {}) {
    const providers = this.getProviders({ domain: context.domain, activeOnly: true }).filter((provider) => !context.providerIds?.length || context.providerIds.includes(provider.id));
    const results: ProviderSyncResult[] = [];

    for (const provider of providers) {
      results.push(await provider.sync(context));
    }

    return {
      results,
      properties: this.merge(results.flatMap((result) => result.properties)),
      errors: results.flatMap((result) => result.errors.map((error) => `${result.providerName}: ${error}`)),
      warnings: results.flatMap((result) => result.warnings.map((warning) => `${result.providerName}: ${warning}`)),
    };
  }

  merge(properties: OfficialProperty[]) {
    return mergeOfficialProperties(properties);
  }
}

export const providerRegistry = new ProviderRegistry();

export function registerProvider(provider: OfficialDataProvider) {
  return providerRegistry.registerProvider(provider);
}

export function syncRegisteredProviders(context?: ProviderContext & { providerIds?: string[]; domain?: ProviderDomain }) {
  return providerRegistry.sync(context);
}
