export { BaseOfficialProvider } from "./base-provider";
export { PlaceholderOfficialProvider } from "./placeholder-provider";
export { ProviderRegistry, providerRegistry, registerProvider, syncRegisteredProviders } from "./providerRegistry";
export { createPropertyKey, mergeOfficialProperties, normalizeText } from "./shared";
export type {
  OfficialDataProvider,
  OfficialProperty,
  OfficialPropertyScore,
  PropertyPriority,
  ProviderConfig,
  ProviderContext,
  ProviderDomain,
  ProviderSyncResult,
  ProviderValidationResult,
} from "./types";

export { CentrisManualProvider } from "./centris-manual/centris-manual-provider";
export { ExpiredListingsProvider } from "./expired/expired-listings-provider";
export { DonneesQuebecProvider } from "./government/donnees-quebec-provider";
export { JudicialSalesProvider } from "./judicial/judicial-sales-provider";
export { GenericMunicipalProvider } from "./municipal/generic-municipal-provider";
export { RepentignyPermitProvider } from "./permits/repentigny-permit-provider";
export { MontrealEvaluationProvider } from "./evaluation/montreal-evaluation-provider";
