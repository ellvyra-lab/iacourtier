import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class GenericMunicipalProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "generic-municipal",
      name: "Source municipale generique",
      domain: "municipal",
      province: "QC",
      ...config,
    });
  }
}
