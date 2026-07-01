import {
  createSalesScripts,
  salesStyleLabels,
  type SalesScriptSet,
  type SalesStyleLabel,
} from "@/lib/sales-intelligence";

import type { ProspectRecord } from "./types";

export const prospectingCommunicationStyles = salesStyleLabels;

export type ProspectingCommunicationStyle = SalesStyleLabel;

type ProspectingActions = {
  facebook: string;
  email: string;
  call: string;
  sms: string;
  followUp7: string;
  followUp30: string;
  objections: string[];
  responses: string[];
  objectionPlaybooks: SalesScriptSet["objections"];
};

export function createProspectingActions(
  prospect: ProspectRecord,
  style: ProspectingCommunicationStyle = "Québécois naturel",
): ProspectingActions {
  const scripts = createSalesScripts(
    {
      contactName: prospect.contactName,
      ownerName: prospect.ownerName,
      address: prospect.address,
      city: prospect.city,
      propertyType: prospect.propertyType,
    },
    style,
  );

  return {
    facebook: scripts.socialMessage,
    email: scripts.firstEmail,
    call: scripts.firstCall,
    sms: scripts.firstText,
    followUp7: scripts.followUp7,
    followUp30: scripts.followUp30,
    objections: scripts.objections.map((item) => item.objection),
    responses: scripts.objections.map((item) => `${item.shortResponse} ${item.followUpQuestion}`),
    objectionPlaybooks: scripts.objections,
  };
}
