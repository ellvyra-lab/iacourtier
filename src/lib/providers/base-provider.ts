import { createBaseScore, mergeOfficialProperties, validateOfficialProperties } from "./shared";
import type { OfficialDataProvider, OfficialProperty, OfficialPropertyScore, ProviderConfig, ProviderContext, ProviderDomain, ProviderSyncResult, ProviderValidationResult } from "./types";

export abstract class BaseOfficialProvider<TRaw = unknown> implements OfficialDataProvider<TRaw> {
  readonly id: string;
  readonly name: string;
  readonly domain: ProviderDomain;
  readonly config: ProviderConfig;

  protected constructor(config: ProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.domain = config.domain;
    this.config = { active: true, province: "QC", ...config };
  }

  async sync(context: ProviderContext = {}): Promise<ProviderSyncResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const raw = await this.fetch(context);
      const normalized = await this.normalize(raw, context);
      const rescored = await Promise.all(
        normalized.map(async (property) => ({
          ...property,
          score: await this.score(property, context),
        })),
      );
      const validation = await this.validate(rescored, context);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);

      return {
        providerId: this.id,
        providerName: this.name,
        status: validation.valid ? "success" : "error",
        fetched: Array.isArray(raw) ? raw.length : normalized.length,
        normalized: normalized.length,
        valid: validation.valid ? rescored.length : 0,
        properties: validation.valid ? mergeOfficialProperties(rescored) : [],
        errors,
        warnings,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Provider sync failed.");
      return {
        providerId: this.id,
        providerName: this.name,
        status: "error",
        fetched: 0,
        normalized: 0,
        valid: 0,
        properties: [],
        errors,
        warnings,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
  }

  abstract fetch(context?: ProviderContext): Promise<TRaw>;
  abstract normalize(raw: TRaw, context?: ProviderContext): Promise<OfficialProperty[]> | OfficialProperty[];

  validate(properties: OfficialProperty[], _context?: ProviderContext): ProviderValidationResult {
    return validateOfficialProperties(properties);
  }

  score(property: OfficialProperty, _context?: ProviderContext): OfficialPropertyScore {
    return createBaseScore(property.score.value, property.score.reasons, property.score.breakdown);
  }
}
