export type PipelineType = "seller" | "buyer";

export type SellerPipelineStatus =
  | "Prospect vendeur"
  | "Rendez-vous obtenu"
  | "Évaluation en préparation"
  | "Évaluation terminée"
  | "Mandat signé"
  | "Préparation mise en marché"
  | "En vente"
  | "Promesse d'achat"
  | "Conditions"
  | "Notaire"
  | "Vendu"
  | "Suivi après-vente";

export type BuyerPipelineStatus =
  | "Prospect acheteur"
  | "Qualification"
  | "Contrat acheteur"
  | "Recherche active"
  | "Visites"
  | "Promesse d'achat"
  | "Conditions"
  | "Notaire"
  | "Suivi";

export type PipelineStatus = SellerPipelineStatus | BuyerPipelineStatus;

export type AiEmployeeId = "alex" | "emma" | "noah" | "mia" | "olivia";

export type AiEmployee = {
  id: AiEmployeeId;
  name: string;
  role: string;
  specialty: string;
};

export type PipelineAction = {
  id: string;
  employeeId: AiEmployeeId;
  title: string;
  description: string;
  status: "À faire" | "En cours" | "Terminé";
  createdAt: string;
};

export type PipelineTimelineEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
  employeeId?: AiEmployeeId;
  actionIds?: string[];
};

export type PipelineClient = {
  id: string;
  type: PipelineType;
  name: string;
  address?: string;
  city: string;
  status: PipelineStatus;
  priority: "Faible" | "Moyenne" | "Élevée";
  nextStep: string;
  updatedAt: string;
  actions: PipelineAction[];
  timeline: PipelineTimelineEvent[];
};

export type PipelineDashboardSummary = {
  prospects: number;
  evaluations: number;
  mandates: number;
  notary: number;
  followUps: number;
};

export type PipelineDashboardData = {
  today: PipelineDashboardSummary;
  employees: AiEmployee[];
  clients: PipelineClient[];
};
