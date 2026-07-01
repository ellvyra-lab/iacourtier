import {
  CentrisManualProvider,
  DonneesQuebecProvider,
  ExpiredListingsProvider,
  GenericMunicipalProvider,
  JudicialSalesProvider,
  MontrealEvaluationProvider,
  RepentignyPermitProvider,
  type OfficialDataProvider,
} from "@/lib/providers";

import type { CityDataSource, Municipality } from "../municipality";
import { sourceToProviderConfig } from "../municipality";

export function createProviderForSource(municipality: Municipality, source: CityDataSource): OfficialDataProvider {
  const config = sourceToProviderConfig(municipality, source);

  switch (source.providerType) {
    case "montreal-evaluation":
      return new MontrealEvaluationProvider(config);
    case "repentigny-permits":
      return new RepentignyPermitProvider(config);
    case "donnees-quebec":
      return new DonneesQuebecProvider(config);
    case "generic-municipal":
      return new GenericMunicipalProvider(config);
    case "judicial-sales":
      return new JudicialSalesProvider(config);
    case "expired-listings":
      return new ExpiredListingsProvider(config);
    case "centris-manual":
      return new CentrisManualProvider(config);
    default:
      return new GenericMunicipalProvider(config);
  }
}
