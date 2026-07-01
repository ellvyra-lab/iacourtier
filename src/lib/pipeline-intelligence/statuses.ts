import { getWorkflowIndex, officialBuyerWorkflow, officialSellerWorkflow } from "@/lib/business-rules";

import type { BuyerPipelineStatus, PipelineStatus, SellerPipelineStatus } from "./types";

export const sellerPipelineStatuses: SellerPipelineStatus[] = [...officialSellerWorkflow];
export const buyerPipelineStatuses: BuyerPipelineStatus[] = [...officialBuyerWorkflow];

export function getPipelineStageIndex(status: PipelineStatus) {
  const sellerIndex = getWorkflowIndex("vendeur", status);
  if (sellerIndex >= 0) return sellerIndex;
  return getWorkflowIndex("acheteur", status);
}
