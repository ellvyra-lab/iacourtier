import type { PipelineStatus, PipelineType } from "@/lib/pipeline-intelligence";

export type SoniaProspectSource = "Radar" | "Manuel" | "Pipeline";

export type CallResult =
  | "pas_repondu"
  | "mauvais_numero"
  | "interesse"
  | "rendez_vous_obtenu"
  | "a_rappeler"
  | "pas_interesse"
  | "deja_avec_courtier";

export type SoniaHistoryEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "note" | "call" | "status" | "task" | "ai";
};

export type SoniaProspect = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  clientType: PipelineType;
  source: SoniaProspectSource;
  status: PipelineStatus;
  notes: string;
  nextAction: string;
  nextActionDate: string;
  createdAt: string;
  updatedAt: string;
  history: SoniaHistoryEvent[];
};

export type SoniaBattlePlan = {
  radarProspectsToCall: SoniaProspect[];
  callsToMake: SoniaProspect[];
  followupsDue: SoniaProspect[];
  sellerAppointmentsToPrepare: SoniaProspect[];
  marketAnalysesToPrepare: SoniaProspect[];
  mandatesWithMissingDocuments: SoniaProspect[];
  marketingActionsToGenerate: SoniaProspect[];
};
