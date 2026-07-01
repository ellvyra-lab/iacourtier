import { parseRoleEvaluationXml } from "@/lib/prospecting/providers/role-evaluation-provider";

import { BaseOfficialProvider } from "../base-provider";
import { createBaseScore, createPropertyKey, createSourceContribution, normalizeText } from "../shared";
import type { OfficialProperty, OfficialPropertyScore, ProviderConfig, ProviderContext } from "../types";

type EvaluationFetchResult = {
  xml: string;
};

export class MontrealEvaluationProvider extends BaseOfficialProvider<EvaluationFetchResult> {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "montreal-evaluation-role",
      name: "Montreal - Role d'evaluation",
      domain: "evaluation",
      organization: "Ville de Montreal",
      city: "Montreal",
      province: "QC",
      ...config,
    });
  }

  async fetch(context: ProviderContext = {}) {
    const xml = typeof context.metadata?.xml === "string" ? context.metadata.xml : "";
    if (!xml && !this.config.sourceUrl) {
      return { xml: "" };
    }

    if (xml) return { xml };

    const response = await fetch(this.config.sourceUrl as string, { signal: context.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Evaluation source returned ${response.status}.`);
    return { xml: await response.text() };
  }

  normalize(raw: EvaluationFetchResult, context: ProviderContext = {}) {
    if (!raw.xml.trim()) return [];

    const prospects = parseRoleEvaluationXml(raw.xml, {
      city: this.config.city,
      sourceName: this.name,
      sourceUrl: this.config.sourceUrl,
      limit: context.limit,
    });

    const now = new Date().toISOString();
    return prospects.map<OfficialProperty>((prospect) => {
      const rawData = prospect.rawData || {};
      const address = prospect.address;
      const city = prospect.city || this.config.city || "";
      const matricule = stringValue(rawData.matricule);
      const lotNumber = stringValue(rawData.lot_number);
      const cadastre = stringValue(rawData.cadastre);

      return {
        propertyKey: createPropertyKey({ address, city, matricule, lotNumber, cadastre }),
        address,
        normalizedAddress: normalizeText(`${address} ${city}`),
        city,
        province: this.config.province || "QC",
        matricule,
        lotNumber,
        cadastre,
        ownerName: prospect.ownerName,
        propertyType: prospect.propertyType,
        housingCount: numberValue(rawData.housing_count),
        yearBuilt: numberValue(rawData.year_built),
        landArea: numberValue(rawData.land_area),
        landValue: numberValue(rawData.land_value),
        buildingValue: numberValue(rawData.building_value),
        totalValue: numberValue(rawData.total_value),
        acquisitionDate: stringValue(rawData.acquisition_date),
        score: createBaseScore(prospect.opportunityScore, [prospect.reason]),
        sources: [createSourceContribution(this.config, rawData)],
        firstSeenAt: now,
        lastSeenAt: now,
        rawData,
      };
    });
  }

  score(property: OfficialProperty): OfficialPropertyScore {
    const breakdown: OfficialPropertyScore["breakdown"] = [];
    const add = (condition: boolean, code: string, label: string, points: number) => {
      if (condition) breakdown.push({ code, label, points });
    };

    add(Boolean(property.totalValue && property.totalValue >= 750_000), "high_value", "Valeur fonciere elevee", 20);
    add(property.propertyType === "Unifamiliale", "single_family", "Maison unifamiliale", 15);
    add(Boolean(property.housingCount && property.housingCount >= 2), "multi_unit", "Plex ou multilogement", 15);
    add(Boolean(property.yearBuilt && property.yearBuilt < 1990), "older_property", "Construit avant 1990", 10);
    add(Boolean(property.landArea && property.landArea >= 700), "large_land", "Terrain important", 10);

    const score = breakdown.reduce((total, item) => total + item.points, 10);
    return createBaseScore(score, breakdown.map((item) => item.label), breakdown);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? undefined : String(value);
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value || undefined;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
