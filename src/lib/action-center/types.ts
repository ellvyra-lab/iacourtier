export type ActionPriority = "Faible" | "Moyenne" | "Élevée";

export type ActionSource = "assistant" | "radar" | "csv" | "mandat" | "suivi" | "marketing" | "document";

export type ActionCategory = "Aujourd'hui" | "Radar" | "Mandats" | "Suivis" | "Marketing";

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  dueAt: string;
  estimatedMinutes: number;
  href: string;
  source: ActionSource;
  category: ActionCategory;
  entityId: string;
  dedupeKey: string;
};

export type AssistantActionEvent =
  | {
      type: "market_analysis_completed";
      entityId: string;
      label: string;
      href: string;
    }
  | {
      type: "description_generated";
      entityId: string;
      label: string;
      href: string;
    }
  | {
      type: "radar_prospect_created";
      entityId: string;
      label: string;
      href: string;
    }
  | {
      type: "csv_imported";
      entityId: string;
      label: string;
      href: string;
    };

export type FollowUpProspect = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  priority: ActionPriority;
  href: string;
};

export type ActionCenterSummary = {
  radar: {
    newProspects: number;
    averageScore: number;
    highPriority: number;
  };
  mandates: {
    active: number;
    incomplete: number;
    missingDocuments: number;
    descriptionsToGenerate: number;
    analysesToFinish: number;
  };
  marketing: {
    posts: number;
    videos: number;
    testimonials: number;
  };
};

export type ActionCenterData = {
  todayActions: ActionItem[];
  followUpActions: ActionItem[];
  summary: ActionCenterSummary;
};
