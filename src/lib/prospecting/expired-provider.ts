import type { ProspectingProvider } from "./types";

export const expiredProvider: ProspectingProvider = {
  id: "expired",
  label: "Propriétés expirées",
  enabled: false,
  getProspects: () => [],
};
