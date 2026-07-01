import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class JudicialSalesProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "judicial-sales",
      name: "Ventes judiciaires",
      domain: "judicial",
      province: "QC",
      ...config,
    });
  }
}
