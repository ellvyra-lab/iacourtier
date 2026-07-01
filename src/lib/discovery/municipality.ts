import type { ProviderConfig, ProviderDomain } from "@/lib/providers";

export type QuebecMunicipalityId = string;

export type Municipality = {
  id: QuebecMunicipalityId;
  name: string;
  normalizedName: string;
  province: "QC";
  region?: string;
  mrc?: string;
};

export type CityDataSource = {
  id: string;
  label: string;
  domain: ProviderDomain;
  providerType:
    | "montreal-evaluation"
    | "repentigny-permits"
    | "donnees-quebec"
    | "generic-municipal"
    | "judicial-sales"
    | "expired-listings"
    | "centris-manual";
  organization?: string;
  sourceUrl?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
};

export type MunicipalityCatalogEntry = {
  municipality: Municipality;
  sources: CityDataSource[];
};

export function normalizeMunicipalityName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function sourceToProviderConfig(municipality: Municipality, source: CityDataSource): ProviderConfig {
  return {
    id: source.id,
    name: source.label,
    domain: source.domain,
    organization: source.organization,
    city: municipality.name,
    province: municipality.province,
    sourceUrl: source.sourceUrl,
    active: source.active,
    metadata: {
      municipalityId: municipality.id,
      municipalityName: municipality.name,
      ...source.metadata,
    },
  };
}
