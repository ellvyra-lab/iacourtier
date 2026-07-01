import { aiEmployees } from "./employees";
import { pipelineClients } from "./sample-data";
import type { PipelineDashboardData } from "./types";

export function buildPipelineDashboardData(): PipelineDashboardData {
  return {
    today: {
      prospects: 7,
      evaluations: 3,
      mandates: 2,
      notary: 1,
      followUps: 4,
    },
    employees: aiEmployees,
    clients: pipelineClients,
  };
}
