import { PlaceholderOfficialProvider } from "../placeholder-provider";
import type { ProviderConfig } from "../types";

export class DonneesQuebecProvider extends PlaceholderOfficialProvider {
  constructor(config: Partial<ProviderConfig> = {}) {
    super({
      id: "donnees-quebec",
      name: "Donnees Quebec",
      domain: "quebec",
      organization: "Gouvernement du Quebec",
      province: "QC",
      ...config,
    });
  }
}
