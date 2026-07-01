import type { SalesStyle, SalesStyleLabel } from "./types";

export const defaultSalesStyle: SalesStyleLabel = "Québécois naturel";

export const salesStyles = [
  {
    id: "quebecois-naturel",
    label: "Québécois naturel",
    name: "Québécois naturel",
    description: "Ton humain, simple, chaleureux et crédible pour ouvrir une vraie conversation.",
    voice: ["naturel", "respectueux", "local", "sans pression"],
  },
  {
    id: "direct",
    label: "Direct",
    name: "Direct / Prospection",
    description: "Approche courte, claire et disciplinée pour valider rapidement s'il y a un projet.",
    voice: ["direct", "professionnel", "concis", "structuré"],
  },
  {
    id: "relationnel",
    label: "Relationnel",
    name: "Relationnel",
    description: "Approche douce qui bâtit la confiance avant de proposer une évaluation.",
    voice: ["empathique", "patient", "conversationnel", "rassurant"],
  },
  {
    id: "luxe",
    label: "Luxe",
    name: "Luxe",
    description: "Positionnement haut de gamme, discret et consultatif.",
    voice: ["raffiné", "confidentiel", "posé", "premium"],
  },
  {
    id: "top-performer",
    label: "Top Performer",
    name: "Top Performer",
    description: "Prospection confiante, énergique et orientée rendez-vous, sans paraître forcée.",
    voice: ["assuré", "curieux", "rythmé", "orienté action"],
  },
] as const satisfies readonly SalesStyle[];

export const salesStyleLabels = salesStyles.map((style) => style.label);

export function normalizeSalesStyle(style?: string | null): SalesStyleLabel {
  return salesStyles.find((item) => item.label === style || item.id === style)?.label || defaultSalesStyle;
}

export function getSalesStyle(style?: string | null): SalesStyle {
  const label = normalizeSalesStyle(style);
  return salesStyles.find((item) => item.label === label) || salesStyles[0];
}
