import type { CallAnalysis } from "./types";

export function createCallCoachFeedback(analysis: CallAnalysis) {
  return {
    good: analysis.strengths.join(" "),
    improve: analysis.weaknesses.join(" ") || "Continuez à garder une conversation simple et orientée prochaine étape.",
    topSellerQuestion: analysis.nextBestQuestion,
    nextFollowup: analysis.recommendedFollowup,
    nextCallGoal:
      analysis.globalScore >= 8
        ? "Reproduire cette structure et demander le rendez-vous plus tôt."
        : "Poser deux questions ouvertes, reconnaître l'objection, puis proposer une évaluation simple.",
  };
}
