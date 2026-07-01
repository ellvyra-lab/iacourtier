import { BaseOfficialProvider } from "./base-provider";
import type { OfficialProperty, ProviderConfig } from "./types";

export class PlaceholderOfficialProvider extends BaseOfficialProvider<unknown[]> {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async fetch() {
    return [];
  }

  normalize(): OfficialProperty[] {
    return [];
  }
}
