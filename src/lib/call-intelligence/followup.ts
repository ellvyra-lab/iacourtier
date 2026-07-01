import type { CallAnalysis, PipelineCallRecommendation } from "./types";

export function createCallFollowupRecommendation(analysis: CallAnalysis, target?: { clientId?: string; prospectId?: string }): PipelineCallRecommendation {
  return {
    clientId: target?.clientId,
    prospectId: target?.prospectId,
    suggestedStatus: analysis.appointmentAskDetected ? "Rendez-vous vendeur obtenu" : "Prospect vendeur",
    timelineNote: `${analysis.clientNote} Score global ${analysis.globalScore}/10. ${analysis.strengths[0] || "Conversation à poursuivre."}`,
    followupTask: analysis.recommendedFollowup,
    nextAction: analysis.nextBestQuestion,
  };
}
