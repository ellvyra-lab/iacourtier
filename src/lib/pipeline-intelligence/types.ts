import type { OfficialBuyerStatus, OfficialSellerStatus, OfficialWorkflowStatus } from "@/lib/business-rules";

export type PipelineType = "seller" | "buyer";

export type SellerPipelineStatus = OfficialSellerStatus;
export type BuyerPipelineStatus = OfficialBuyerStatus;
export type PipelineStatus = OfficialWorkflowStatus;

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
