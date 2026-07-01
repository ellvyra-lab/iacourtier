export type ProviderDomain =
  | "government"
  | "municipal"
  | "quebec"
  | "judicial"
  | "permits"
  | "evaluation"
  | "expired"
  | "centris-manual";

export type ProviderStatus = "idle" | "syncing" | "success" | "error";

export type PropertyPriority = "low" | "medium" | "high";

export type ProviderConfig = {
  id: string;
  name: string;
  domain: ProviderDomain;
  organization?: string;
  city?: string;
  province?: string;
  sourceUrl?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderContext = {
  limit?: number;
  now?: Date;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type ProviderValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type PropertySourceContribution = {
  providerId: string;
  providerName: string;
  domain: ProviderDomain;
  sourceUrl?: string;
  fetchedAt: string;
  rawData?: Record<string, unknown>;
};

export type OfficialPropertyScore = {
  value: number;
  priority: PropertyPriority;
  reasons: string[];
  breakdown: Array<{
    code: string;
    label: string;
    points: number;
  }>;
};

export type OfficialProperty = {
  propertyKey: string;
  address: string;
  normalizedAddress: string;
  city: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  matricule?: string;
  lotNumber?: string;
  cadastre?: string;
  ownerName?: string;
  propertyType?: string;
  housingCount?: number;
  yearBuilt?: number;
  landArea?: number;
  livingArea?: number;
  landValue?: number;
  buildingValue?: number;
  totalValue?: number;
  acquisitionDate?: string;
  lastSaleDate?: string;
  permits?: Array<Record<string, unknown>>;
  judicialEvents?: Array<Record<string, unknown>>;
  expiredListing?: Record<string, unknown>;
  score: OfficialPropertyScore;
  sources: PropertySourceContribution[];
  firstSeenAt: string;
  lastSeenAt: string;
  rawData?: Record<string, unknown>;
};

export type ProviderSyncResult = {
  providerId: string;
  providerName: string;
  status: ProviderStatus;
  fetched: number;
  normalized: number;
  valid: number;
  properties: OfficialProperty[];
  errors: string[];
  warnings: string[];
  startedAt: string;
  finishedAt: string;
};

export interface OfficialDataProvider<TRaw = unknown> {
  readonly id: string;
  readonly name: string;
  readonly domain: ProviderDomain;
  readonly config: ProviderConfig;

  sync(context?: ProviderContext): Promise<ProviderSyncResult>;
  fetch(context?: ProviderContext): Promise<TRaw>;
  normalize(raw: TRaw, context?: ProviderContext): Promise<OfficialProperty[]> | OfficialProperty[];
  validate(properties: OfficialProperty[], context?: ProviderContext): Promise<ProviderValidationResult> | ProviderValidationResult;
  score(property: OfficialProperty, context?: ProviderContext): Promise<OfficialPropertyScore> | OfficialPropertyScore;
}
