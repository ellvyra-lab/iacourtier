import { CentrisManualProvider } from "./centris-manual/centris-manual-provider";
import { MontrealEvaluationProvider } from "./evaluation/montreal-evaluation-provider";
import { ExpiredListingsProvider } from "./expired/expired-listings-provider";
import { DonneesQuebecProvider } from "./government/donnees-quebec-provider";
import { JudicialSalesProvider } from "./judicial/judicial-sales-provider";
import { GenericMunicipalProvider } from "./municipal/generic-municipal-provider";
import { RepentignyPermitProvider } from "./permits/repentigny-permit-provider";
import { ProviderRegistry, registerProvider } from "./providerRegistry";

export function createDefaultProviderRegistry() {
  return new ProviderRegistry()
    .registerProvider(new MontrealEvaluationProvider())
    .registerProvider(new RepentignyPermitProvider())
    .registerProvider(new DonneesQuebecProvider())
    .registerProvider(new GenericMunicipalProvider())
    .registerProvider(new JudicialSalesProvider())
    .registerProvider(new ExpiredListingsProvider())
    .registerProvider(new CentrisManualProvider());
}

export function registerDefaultProviders() {
  registerProvider(new MontrealEvaluationProvider());
  registerProvider(new RepentignyPermitProvider());
  registerProvider(new DonneesQuebecProvider());
  registerProvider(new GenericMunicipalProvider());
  registerProvider(new JudicialSalesProvider());
  registerProvider(new ExpiredListingsProvider());
  registerProvider(new CentrisManualProvider());
}
