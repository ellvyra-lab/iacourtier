import type { SoniaBattlePlan, SoniaProspect } from "@/lib/sonia-beta";
import { buildSoniaBattlePlan } from "@/lib/sonia-beta";

export type DailyCoachPlan = {
  greeting: string;
  coachLine: string;
  objective: {
    callsToMake: number;
    radarProspects: number;
    followupsDue: number;
    sellerAppointments: number;
    marketAnalyses: number;
    missingDocuments: number;
  };
  battlePlan: SoniaBattlePlan;
  firstAction: {
    label: string;
    href: string;
    description: string;
  };
  recommendations: string[];
  encouragement: string;
  focus: string;
  hasRealData: boolean;
};

export function buildDailyCoach(prospects: SoniaProspect[], userName = "Sonia"): DailyCoachPlan {
  const realProspects = prospects.filter((prospect) => !prospect.id.startsWith("sonia-demo-"));
  const workingProspects = realProspects.length ? realProspects : [];
  const battlePlan = buildSoniaBattlePlan(workingProspects);
  const firstAction = getFirstAction(battlePlan);

  return {
    greeting: `Salut ${userName} 👋`,
    coachLine: "Aujourd’hui, on va aller chercher du concret.",
    objective: {
      callsToMake: battlePlan.callsToMake.length,
      radarProspects: battlePlan.radarProspectsToCall.length,
      followupsDue: battlePlan.followupsDue.length,
      sellerAppointments: battlePlan.sellerAppointmentsToPrepare.length,
      marketAnalyses: battlePlan.marketAnalysesToPrepare.length,
      missingDocuments: battlePlan.mandatesWithMissingDocuments.length,
    },
    battlePlan,
    firstAction,
    recommendations: buildRecommendations(battlePlan),
    encouragement:
      "Ne commence pas par gosser dans tes textes. Aujourd’hui, ton argent est dans les appels. On contacte, on note, on relance.",
    focus: getFocus(battlePlan),
    hasRealData: realProspects.length > 0,
  };
}

function getFirstAction(plan: SoniaBattlePlan) {
  const firstRadar = plan.radarProspectsToCall[0];
  if (firstRadar) {
    return {
      label: `Appeler ${firstRadar.name}`,
      href: `/tableau-de-bord/prospects/${firstRadar.id}?demoCall=1`,
      description: `${firstRadar.address}, ${firstRadar.city}. On commence par le plus chaud.`,
    };
  }

  const firstFollowup = plan.followupsDue[0];
  if (firstFollowup) {
    return {
      label: `Relancer ${firstFollowup.name}`,
      href: `/tableau-de-bord/prospects/${firstFollowup.id}`,
      description: "Ce suivi est dû aujourd’hui. Ne le laisse pas refroidir.",
    };
  }

  const firstAppointment = plan.sellerAppointmentsToPrepare[0] || plan.marketAnalysesToPrepare[0];
  if (firstAppointment) {
    return {
      label: `Préparer le rendez-vous de ${firstAppointment.name}`,
      href: `/tableau-de-bord/actions/prepare-market-analysis?name=${encodeURIComponent(firstAppointment.name)}&address=${encodeURIComponent(firstAppointment.address)}&city=${encodeURIComponent(firstAppointment.city)}&context=prospect`,
      description: "L’analyse de marché doit être prête avant la rencontre vendeur.",
    };
  }

  return {
    label: "Commencer ma prospection",
    href: "/tableau-de-bord/radar-prospection",
    description: "Débloque tes premiers prospects Radar et fais tes appels.",
  };
}

function buildRecommendations(plan: SoniaBattlePlan) {
  const items: string[] = [];

  if (plan.radarProspectsToCall.length) {
    items.push(`Tu as ${plan.radarProspectsToCall.length} prospects Radar à appeler. Commence par eux pendant que ton énergie est haute.`);
  }
  if (plan.followupsDue.length) {
    items.push(`Tu as ${plan.followupsDue.length} relances dues. Un suivi fait aujourd’hui vaut mieux qu’un parfait message demain.`);
  }
  if (plan.sellerAppointmentsToPrepare.length) {
    items.push("Tu as un rendez-vous vendeur à préparer. L’analyse de marché vient avant le mandat, pas après.");
  }
  if (plan.mandatesWithMissingDocuments.length) {
    items.push("Après mandat signé, ton focus est simple : documents vendeur et mise en marché.");
  }
  if (!items.length) {
    items.push("Ta première mission est simple : trouve tes premiers prospects Radar, crée les fiches, puis fais les appels.");
  }

  return items.slice(0, 4);
}

function getFocus(plan: SoniaBattlePlan) {
  if (plan.radarProspectsToCall.length || plan.callsToMake.length) return "Prospection avant perfection.";
  if (plan.followupsDue.length) return "Ton prochain mandat commence probablement par un suivi.";
  if (plan.sellerAppointmentsToPrepare.length) return "Arrive préparée. Le rendez-vous se gagne avant de sonner à la porte.";
  return "Un appel vaut mieux que dix idées.";
}
