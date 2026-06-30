import type { ProspectingProvider } from "./types";

export const municipalProvider: ProspectingProvider = {
  id: "municipal",
  label: "Données municipales",
  enabled: false,
  getProspects: () => [],
};
