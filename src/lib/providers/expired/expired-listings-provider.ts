import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class ExpiredListingsProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "expired-listings",
      name: "Proprietes expirees",
      domain: "expired",
      province: "QC",
      ...config,
    });
  }
}
