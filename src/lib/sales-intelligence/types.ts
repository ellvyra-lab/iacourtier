export type SalesStyleLabel = "Québécois naturel" | "Top Performer" | "Direct" | "Relationnel" | "Luxe";

export type SalesStyleId = "quebecois-naturel" | "top-performer" | "direct" | "relationnel" | "luxe";

export type SalesStyle = {
  id: SalesStyleId;
  label: SalesStyleLabel;
  name: string;
  description: string;
  voice: string[];
};

export type SalesProspectContext = {
  contactName?: string;
  ownerName?: string;
  brokerName?: string;
  brokerTitle?: string;
  address?: string;
  city?: string;
  propertyType?: string;
};

export type SalesScriptContext = {
  greeting: string;
  brokerName: string;
  brokerTitle: string;
  address: string;
  city: string;
  sector: string;
  propertyLabel: string;
};

export type ObjectionId =
  | "not_selling"
  | "waiting"
  | "already_has_broker"
  | "sell_by_owner"
  | "just_value"
  | "market_uncertain"
  | "do_not_disturb"
  | "send_email"
  | "not_rushed"
  | "duproprio_first";

export type ObjectionPlaybook = {
  id: ObjectionId;
  objection: string;
  shortResponse: string;
  conversationalResponse: string;
  directResponse: string;
  followUpQuestion: string;
  conversionGoal: string;
};

export type SalesScriptSet = {
  firstCall: string;
  firstText: string;
  firstEmail: string;
  socialMessage: string;
  followUp7: string;
  followUp30: string;
  objections: ObjectionPlaybook[];
};

export type CallCoachInput = {
  note: string;
  style?: SalesStyleLabel;
  prospect?: SalesProspectContext;
};

export type CallCoachSuggestion = {
  whatCouldBeBetter: string;
  nextQuestion: string;
  nextFollowUp: string;
  bestReentryAngle: string;
};
