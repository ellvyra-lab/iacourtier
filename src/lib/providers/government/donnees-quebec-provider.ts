import { fetchGovernmentSourceText, parseGovernmentRows, transformGovernmentRow } from "@/lib/prospecting/government-source";
import type { ProspectRecord } from "@/lib/prospecting";

import { BaseOfficialProvider } from "../base-provider";
import { createBaseScore, createPropertyKey, createSourceContribution, normalizeText } from "../shared";
import type { OfficialProperty, OfficialPropertyScore, ProviderConfig, ProviderContext } from "../types";

type CkanResource = {
  id?: string;
  name?: string;
  url?: string;
  format?: string;
};

type CkanPackage = {
  title?: string;
  name?: string;
  resources?: CkanResource[];
};

type CkanSearchResponse = {
  success?: boolean;
  result?: {
    results?: CkanPackage[];
  };
};

type DownloadedResource = {
  name: string;
  packageName: string;
  url: string;
  text: string;
  contentType: string;
};

export class DonneesQuebecProvider extends BaseOfficialProvider<DownloadedResource[]> {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "donnees-quebec",
      name: "Donnees Quebec",
      domain: "quebec",
      organization: "Gouvernement du Quebec",
      province: "QC",
      ...config,
    });
  }

  async fetch(context: ProviderContext = {}) {
    const discovered = this.config.sourceUrl
      ? [{ name: this.name, packageName: this.name, url: this.config.sourceUrl }]
      : await this.discoverResources(context);

    const resources: DownloadedResource[] = [];
    for (const resource of discovered.slice(0, context.limit || 6)) {
      try {
        const downloaded = await fetchGovernmentSourceText(resource.url);
        resources.push({
          ...resource,
          text: downloaded.text,
          contentType: downloaded.contentType,
        });
      } catch {
        // Ignore incompatible or unavailable resources; the discovery engine
        // keeps going with every compatible public source it can read.
      }
    }

    return resources;
  }

  normalize(raw: DownloadedResource[], context: ProviderContext = {}) {
    const city = String(context.metadata?.city || this.config.city || "");
    const now = new Date().toISOString();
    const properties: OfficialProperty[] = [];

    raw.forEach((resource) => {
      const rows = parseGovernmentRows(resource.text, resource.contentType, resource.url);
      rows.slice(0, context.limit || 250).forEach((row, index) => {
        const prospect = transformGovernmentRow(row, index, {
          sourceUrl: resource.url,
          targetCity: city,
          sourceId: this.id,
          sourceName: resource.name || resource.packageName,
          lastUpdated: now,
        });

        if (prospect) {
          properties.push(this.prospectToProperty(prospect, resource, now));
        }
      });
    });

    return properties;
  }

  score(property: OfficialProperty): OfficialPropertyScore {
    const breakdown: OfficialPropertyScore["breakdown"] = [];
    const add = (condition: boolean, code: string, label: string, points: number) => {
      if (condition) breakdown.push({ code, label, points });
    };

    add(Boolean(property.ownerName), "owner_detected", "Proprietaire detecte", 20);
    add(Boolean(property.totalValue), "value_detected", "Valeur detectee", 10);
    add(Boolean(property.lotNumber || property.cadastre || property.matricule), "cadastre_detected", "Lot/cadastre/matricule detecte", 15);
    add(Boolean(property.address), "address_detected", "Adresse detectee", 10);
    add(Boolean(property.propertyType?.toLowerCase().includes("terrain")), "land", "Terrain detecte", 10);
    add(Boolean(property.propertyType?.toLowerCase().includes("plex") || property.propertyType?.toLowerCase().includes("logement")), "multi_unit", "Plex/multilogement detecte", 15);

    const score = breakdown.reduce((total, item) => total + item.points, 15);
    return createBaseScore(score, breakdown.map((item) => item.label), breakdown);
  }

  private async discoverResources(context: ProviderContext) {
    const city = String(context.metadata?.city || this.config.city || "");
    const endpoint = process.env.DONNEES_QUEBEC_CKAN_API || "https://www.donneesquebec.ca/recherche/api/3/action/package_search";
    const queries = [city, `${city} role evaluation`, `${city} permis`, `${city} immeuble`, `${city} cadastre`].filter(Boolean);
    const resources = new Map<string, { name: string; packageName: string; url: string }>();

    for (const query of queries) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("q", query);
        url.searchParams.set("rows", "10");
        const response = await fetch(url, { signal: context.signal, cache: "no-store" });
        if (!response.ok) continue;

        const payload = (await response.json()) as CkanSearchResponse;
        for (const item of payload.result?.results || []) {
          for (const resource of item.resources || []) {
            if (!resource.url || !isCompatibleFormat(resource)) continue;
            resources.set(resource.url, {
              name: resource.name || item.title || item.name || "Ressource publique",
              packageName: item.title || item.name || "Donnees Quebec",
              url: resource.url,
            });
          }
        }
      } catch {
        // Keep discovery resilient; one failed query should not block a city.
      }
    }

    return Array.from(resources.values());
  }

  private prospectToProperty(prospect: ProspectRecord, resource: DownloadedResource, now: string): OfficialProperty {
    const rawData = prospect.rawData || {};
    const city = prospect.city || this.config.city || "";
    const matricule = stringValue(rawData.matricule);
    const lotNumber = stringValue(rawData.lot);
    const cadastre = stringValue(rawData.cadastre);

    return {
      propertyKey: createPropertyKey({ address: prospect.address, city, matricule, lotNumber, cadastre }),
      address: prospect.address,
      normalizedAddress: normalizeText(`${prospect.address} ${city}`),
      city,
      province: this.config.province || "QC",
      matricule,
      lotNumber,
      cadastre,
      ownerName: prospect.ownerName,
      propertyType: prospect.propertyType,
      totalValue: numberValue(rawData.valeur) || numberValue(rawData.evaluation) || numberValue(rawData.valeur_immeuble),
      score: createBaseScore(prospect.opportunityScore, [prospect.reason]),
      sources: [createSourceContribution({ ...this.config, sourceUrl: resource.url }, { ...rawData, packageName: resource.packageName })],
      firstSeenAt: now,
      lastSeenAt: now,
      rawData: {
        ...rawData,
        source_package: resource.packageName,
        source_resource: resource.name,
      },
    };
  }
}

function isCompatibleFormat(resource: CkanResource) {
  const format = (resource.format || resource.url || "").toLowerCase();
  return ["csv", "xml", "json", "geojson"].some((item) => format.includes(item));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value || undefined;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
