import type { ProspectingProvider } from "./types";

export const judicialProvider: ProspectingProvider = {
  id: "judicial",
  label: "Données judiciaires",
  enabled: false,
  getProspects: () => [],
};
