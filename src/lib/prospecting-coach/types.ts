export type CoachScenarioId = "cold_seller" | "past_client" | "radar_owner" | "fsbo" | "expired" | "hesitant_seller";

export type CoachScenario = {
  id: CoachScenarioId;
  label: string;
  ownerOpening: string;
  context: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
};

export type CoachDashboardMetrics = {
  callGoalToday: number;
  prospectsToContact: number;
  followUpsDue: number;
  appointmentGoal: number;
  disciplineScore: number;
  conversionScore: number;
};

export type CoachFeedback = {
  score: number;
  good: string;
  weak: string;
  topSellerAnswer: string;
  nextBestQuestion: string;
  checks: {
    natural: boolean;
    strongQuestion: boolean;
    curiosity: boolean;
    appointment: boolean;
    tooAggressive: boolean;
    tooSoft: boolean;
  };
};
