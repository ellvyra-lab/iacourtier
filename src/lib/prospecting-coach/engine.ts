import { getObjectionPlaybooks } from "@/lib/sales-intelligence";

import type { CoachDashboardMetrics, CoachFeedback, CoachScenario, CoachScenarioId } from "./types";

export const coachMetrics: CoachDashboardMetrics = {
  callGoalToday: 35,
  prospectsToContact: 18,
  followUpsDue: 9,
  appointmentGoal: 3,
  disciplineScore: 82,
  conversionScore: 64,
};

export const coachScenarios: CoachScenario[] = [
  {
    id: "cold_seller",
    label: "Vendeur froid",
    ownerOpening: "Bonjour... c'est à quel sujet?",
    context: "Le propriétaire ne vous connaît pas. Votre objectif est d'ouvrir une conversation sans pression.",
    difficulty: "Intermédiaire",
  },
  {
    id: "past_client",
    label: "Ancien client",
    ownerOpening: "Bonjour, ça fait longtemps! Qu'est-ce qui se passe?",
    context: "Vous reprenez contact avec un ancien client pour créer une conversation naturelle sur son projet futur.",
    difficulty: "Débutant",
  },
  {
    id: "radar_owner",
    label: "Propriétaire Radar",
    ownerOpening: "Bonjour. Pourquoi vous m'appelez exactement?",
    context: "Vous contactez un propriétaire prioritaire sans jamais révéler pourquoi il a été sélectionné.",
    difficulty: "Avancé",
  },
  {
    id: "fsbo",
    label: "FSBO / proprio vendeur",
    ownerOpening: "Je veux vendre par moi-même, je ne veux pas payer de commission.",
    context: "Le propriétaire veut garder le contrôle. Votre rôle est de créer de la valeur avant de parler de services.",
    difficulty: "Avancé",
  },
  {
    id: "expired",
    label: "Expiré",
    ownerOpening: "On a déjà essayé de vendre et ça n'a pas marché.",
    context: "Le propriétaire est déçu. Vous devez diagnostiquer avant de proposer une solution.",
    difficulty: "Avancé",
  },
  {
    id: "hesitant_seller",
    label: "Vendeur hésitant",
    ownerOpening: "On y pense, mais on n'est vraiment pas pressés.",
    context: "Le propriétaire est ouvert mais prudent. L'objectif est de transformer l'hésitation en rendez-vous de planification.",
    difficulty: "Intermédiaire",
  },
];

export const futureCoachCapabilities = [
  "Analyse d'appel audio",
  "Transcription automatique",
  "Score d'appel",
  "Analyse du temps de parole",
  "Recommandations personnalisées",
];

export function getCoachScenario(id?: string | null) {
  return coachScenarios.find((scenario) => scenario.id === id) || coachScenarios[0];
}

export function analyzeProspectingResponse(response: string, scenarioId: CoachScenarioId): CoachFeedback {
  const text = response.trim();
  const lower = text.toLowerCase();
  const scenario = getCoachScenario(scenarioId);
  const hasQuestion = text.includes("?") || /(est-ce que|qu'est-ce|comment|pourquoi|si vous|avez-vous|seriez-vous)/i.test(text);
  const hasOpenQuestion = /(comment|qu'est-ce|pourquoi|si vous|qu'est ce|de quelle façon|quand|avez-vous déjà)/i.test(text);
  const createsCuriosity = /(valeur|marché|options|portrait|ventes récentes|stratégie|positionnement|heure juste)/i.test(text);
  const asksAppointment = /(rendez-vous|rencontre|appel de 10|10 minutes|évaluation|estimation|discuter cette semaine|moment cette semaine)/i.test(text);
  const tooAggressive = /(vous devez|il faut vendre|dernière chance|grave erreur|tout de suite|immédiatement)/i.test(text);
  const tooSoft = text.length < 70 || /(je voulais juste|peut-être|désolé de vous déranger|si jamais)/i.test(text);
  const forbidden = /(mon radar|mon ia|score détecté|signal de succession|données publiques|algorithme)/i.test(text);
  const natural = text.length >= 70 && text.length <= 650 && !forbidden;

  let score = 4;
  if (natural) score += 1;
  if (hasQuestion) score += 1;
  if (hasOpenQuestion) score += 1;
  if (createsCuriosity) score += 1;
  if (asksAppointment) score += 1;
  if (!tooAggressive && !tooSoft) score += 1;
  if (forbidden) score -= 3;
  if (tooAggressive) score -= 1;
  if (tooSoft) score -= 1;

  return {
    score: Math.max(1, Math.min(10, score)),
    good: buildGoodFeedback({ natural, hasOpenQuestion, createsCuriosity, asksAppointment }),
    weak: buildWeakFeedback({ forbidden, tooAggressive, tooSoft, hasOpenQuestion, createsCuriosity, asksAppointment }),
    topSellerAnswer: topSellerAnswerFor(scenario.id),
    nextBestQuestion: nextQuestionFor(scenario.id),
    checks: {
      natural,
      strongQuestion: hasOpenQuestion,
      curiosity: createsCuriosity,
      appointment: asksAppointment,
      tooAggressive,
      tooSoft,
    },
  };
}

export function coachObjectionLibrary() {
  return getObjectionPlaybooks().map((item) => ({
    objection: item.objection,
    shortResponse: item.shortResponse,
    relationalResponse: item.conversationalResponse,
    directResponse: item.directResponse,
    followUpQuestion: item.followUpQuestion,
    finalObjective: item.conversionGoal,
  }));
}

function buildGoodFeedback(input: { natural: boolean; hasOpenQuestion: boolean; createsCuriosity: boolean; asksAppointment: boolean }) {
  const parts = [];
  if (input.natural) parts.push("Ton naturel et professionnel.");
  if (input.hasOpenQuestion) parts.push("Bonne question ouverte.");
  if (input.createsCuriosity) parts.push("Vous créez de la curiosité autour de la valeur ou des options.");
  if (input.asksAppointment) parts.push("Vous amenez la conversation vers une prochaine étape claire.");
  return parts.length ? parts.join(" ") : "Vous avez répondu, mais il faut rendre l'approche plus conversationnelle et plus orientée rendez-vous.";
}

function buildWeakFeedback(input: { forbidden: boolean; tooAggressive: boolean; tooSoft: boolean; hasOpenQuestion: boolean; createsCuriosity: boolean; asksAppointment: boolean }) {
  if (input.forbidden) return "Ne révélez jamais la logique interne, les données, le radar, l'IA ou un signal. Le propriétaire doit entendre un courtier humain.";
  if (input.tooAggressive) return "Le ton pousse trop fort. Gardez le contrôle, mais baissez la pression.";
  if (input.tooSoft) return "La réponse est trop molle ou trop courte. Il faut une intention plus claire et une vraie question.";
  if (!input.hasOpenQuestion) return "Il manque une question ouverte pour faire parler le propriétaire.";
  if (!input.createsCuriosity) return "Il manque un élément de curiosité : valeur, marché, options ou timing.";
  if (!input.asksAppointment) return "Il manque une invitation vers un appel, une estimation ou un rendez-vous.";
  return "Bonne base. Le prochain niveau est d'être plus précis dans la demande de rendez-vous.";
}

function topSellerAnswerFor(id: CoachScenarioId) {
  const answers: Record<CoachScenarioId, string> = {
    cold_seller:
      "Bonjour M. Tremblay, ici Sonia Bernier, courtière immobilière. Je suis très active dans votre secteur en ce moment et je voulais simplement vous poser une petite question : est-ce que vendre votre propriété cette année fait partie de vos réflexions, ou pas du tout?",
    past_client:
      "Bonjour Mme Gagnon, je pensais à vous parce que le marché a beaucoup changé depuis notre dernière transaction. Je ne sais pas si vous avez un projet, mais est-ce que ça vous serait utile d'avoir une mise à jour rapide de la valeur de votre propriété?",
    radar_owner:
      "Bonjour, ici Sonia Bernier, courtière immobilière. Je travaille dans votre secteur cette semaine et je prépare quelques portraits de marché pour des propriétaires du coin. Est-ce que connaître la valeur actuelle de votre propriété vous serait utile, même par simple curiosité?",
    fsbo:
      "Je comprends très bien. Plusieurs propriétaires veulent tester par eux-mêmes. Avant de lancer, est-ce que vous avez validé votre prix avec des ventes récentes et une stratégie claire pour les visites et les objections?",
    expired:
      "Je comprends, c'est frustrant quand une propriété ne vend pas. Avant de proposer quoi que ce soit, j'aimerais comprendre : selon vous, qu'est-ce qui a le plus nui à la vente la première fois?",
    hesitant_seller:
      "C'est parfait de ne pas être pressé. Justement, ça vous donne le temps de planifier. Si vous connaissiez votre valeur actuelle et le meilleur moment pour bouger, est-ce que ça vous aiderait à prendre une meilleure décision?",
  };
  return answers[id];
}

function nextQuestionFor(id: CoachScenarioId) {
  const questions: Record<CoachScenarioId, string> = {
    cold_seller: "Qu'est-ce qui vous ferait considérer une vente cette année?",
    past_client: "Depuis notre dernière transaction, est-ce que vos plans de vie ont changé?",
    radar_owner: "Est-ce que vous préférez connaître la valeur, les options ou le meilleur timing?",
    fsbo: "Si vous n'obtenez pas le résultat voulu, après combien de temps voudriez-vous revoir la stratégie?",
    expired: "Qu'est-ce que vous auriez voulu que votre ancien courtier fasse différemment?",
    hesitant_seller: "Si une très bonne opportunité se présentait, est-ce que vous voudriez au moins la regarder?",
  };
  return questions[id];
}
