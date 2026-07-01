export type ProspectingPriority = "Faible" | "Moyenne" | "Élevée";

export type ProspectingCategory =
  | "Successions"
  | "Divorces"
  | "Propriétés expirées"
  | "Reprises de finance"
  | "Vendeurs potentiels"
  | "Propriétés à forte équité"
  | "Propriétaires de plus de X années"
  | "Terrains"
  | "Multiplex"
  | "Opportunités investisseurs"
  | "Import CSV"
  | "Rôle d'évaluation"
  | "Gouvernement";

export type ProspectingSource = "manual" | "csv" | "expired" | "judicial" | "municipal" | "government" | "role_evaluation";

export type ProspectRecord = {
  id: string;
  address: string;
  city: string;
  propertyType: string;
  category: ProspectingCategory;
  reason: string;
  opportunityScore: number;
  priority: ProspectingPriority;
  source: ProspectingSource;
  url: string | null;
  sourceUrl?: string | null;
  lastUpdated: string;
  ownerName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  leadHash?: string;
  rawData?: Record<string, unknown>;
};

export type ProspectingProvider = {
  id: ProspectingSource;
  label: string;
  enabled: boolean;
  getProspects: () => Promise<ProspectRecord[]> | ProspectRecord[];
};

export const prospectingCategories: ProspectingCategory[] = [
  "Successions",
  "Divorces",
  "Propriétés expirées",
  "Reprises de finance",
  "Vendeurs potentiels",
  "Propriétés à forte équité",
  "Propriétaires de plus de X années",
  "Terrains",
  "Multiplex",
  "Opportunités investisseurs",
  "Import CSV",
  "Rôle d'évaluation",
  "Gouvernement",
];
