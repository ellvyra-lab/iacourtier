import { getAutomaticWorkflowActions, type OfficialClientType } from "@/lib/business-rules";

import type { PipelineAction, PipelineStatus, PipelineType } from "./types";

export function createActionsForStatus(
  clientId: string,
  status: PipelineStatus,
  createdAt: string,
  pipelineType: PipelineType = "seller",
  previousStatus?: PipelineStatus,
): PipelineAction[] {
  const clientType: OfficialClientType = pipelineType === "seller" ? "vendeur" : "acheteur";

  return getAutomaticWorkflowActions({
    clientType,
    currentStatus: previousStatus,
    nextStatus: status,
  }).map((action, index) => ({
    id: `${clientId}-${action.id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    employeeId: action.employeeId,
    title: action.title,
    description: action.description,
    status: index === 0 ? "En cours" : "À faire",
    createdAt,
  }));
}
