import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class CentrisManualProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "centris-manual",
      name: "Centris - Import manuel",
      domain: "centris-manual",
      province: "QC",
      ...config,
    });
  }
}
