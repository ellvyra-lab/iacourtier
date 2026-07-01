import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class RepentignyPermitProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "repentigny-permits",
      name: "Repentigny - Permis municipaux",
      domain: "permits",
      organization: "Ville de Repentigny",
      city: "Repentigny",
      province: "QC",
      ...config,
    });
  }
}
