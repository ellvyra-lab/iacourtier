export type DirectorMood = "découragé" | "stressé" | "motivé" | "fatigué" | "neutre";
export type DirectorSituation =
  | "demande"
  | "rendez_vous"
  | "suivis"
  | "analyse"
  | "appels"
  | "pipeline_vide"
  | "pipeline_actif"
  | "documents"
  | "marketing"
  | "objectif";

export type DirectorMessageContext = {
  informationRequests: number;
  sellerAppointmentsToPrepare: number;
  followupsDue: number;
  marketAnalysesToPrepare: number;
  radarProspectsToCall: number;
  callsToMake: number;
  mandatesWithMissingDocuments: number;
  marketingActionsToGenerate: number;
  totalProspects: number;
};

export type DirectorMessage = {
  id: string;
  text: string;
  mood: DirectorMood;
  situation: DirectorSituation;
  discipline: "psychologie" | "neurosciences" | "coaching immobilier" | "vente consultative" | "négociation" | "motivation scientifique";
};

type Lens = {
  mood: DirectorMood;
  discipline: DirectorMessage["discipline"];
  opening: string;
};

type Situation = {
  id: DirectorSituation;
  matches: (context: DirectorMessageContext) => boolean;
  score: (context: DirectorMessageContext) => number;
  diagnosis: (context: DirectorMessageContext) => string;
};

type Action = {
  instruction: (context: DirectorMessageContext) => string;
};

const LENSES: Lens[] = [
  { mood: "découragé", discipline: "psychologie", opening: "Le découragement rétrécit le champ d’attention; on va donc viser une preuve de progrès observable, pas une journée parfaite." },
  { mood: "stressé", discipline: "neurosciences", opening: "Sous pression, la mémoire de travail perd en précision; réduis la décision à une seule prochaine action mesurable." },
  { mood: "fatigué", discipline: "motivation scientifique", opening: "Quand l’énergie baisse, la constance dépend davantage de la friction que de la volonté; prépare l’action la plus courte qui produit un résultat commercial." },
  { mood: "motivé", discipline: "coaching immobilier", opening: "Ton énergie est utile si elle se transforme en conversations qualifiées; protège-la des tâches qui donnent l’impression d’avancer sans créer de rendez-vous." },
  { mood: "neutre", discipline: "vente consultative", opening: "La qualité d’une journée de courtage se mesure aux décisions clients clarifiées, pas au nombre d’onglets ouverts." },
  { mood: "stressé", discipline: "négociation", opening: "L’urgence pousse à argumenter trop tôt; reprends le contrôle en posant une question qui révèle la contrainte réelle avant de proposer." },
  { mood: "découragé", discipline: "motivation scientifique", opening: "Un résultat faible n’annule pas le processus; il indique précisément quelle étape du comportement doit être répétée ou corrigée." },
  { mood: "fatigué", discipline: "psychologie", opening: "La fatigue favorise l’évitement des tâches socialement exigeantes; commence par le contact le mieux préparé pour créer de l’élan." },
  { mood: "motivé", discipline: "neurosciences", opening: "L’élan se consolide quand le cerveau reçoit une rétroaction rapide; choisis une action dont le résultat sera visible avant la prochaine heure." },
  { mood: "neutre", discipline: "coaching immobilier", opening: "Ton agenda doit refléter la chaîne de revenus du courtage : conversation, qualification, rendez-vous, préparation, mandat et suivi." },
];

const SITUATIONS: Situation[] = [
  {
    id: "demande",
    matches: (c) => c.informationRequests > 0,
    score: (c) => 100 + c.informationRequests,
    diagnosis: (c) => `${c.informationRequests} demande${c.informationRequests > 1 ? "s" : ""} d’information attend${c.informationRequests > 1 ? "ent" : ""}; la vitesse de réponse influence directement la probabilité d’obtenir une vraie conversation.`,
  },
  {
    id: "rendez_vous",
    matches: (c) => c.sellerAppointmentsToPrepare > 0,
    score: (c) => 90 + c.sellerAppointmentsToPrepare,
    diagnosis: (c) => `${c.sellerAppointmentsToPrepare} rendez-vous vendeur${c.sellerAppointmentsToPrepare > 1 ? "s sont" : " est"} à préparer; arriver avec une hypothèse claire vaut mieux qu’accumuler des documents sans angle de recommandation.`,
  },
  {
    id: "suivis",
    matches: (c) => c.followupsDue > 0,
    score: (c) => 80 + c.followupsDue,
    diagnosis: (c) => `${c.followupsDue} suivi${c.followupsDue > 1 ? "s sont" : " est"} dû${c.followupsDue > 1 ? "s" : ""}; chaque délai supplémentaire augmente l’effort nécessaire pour réactiver la relation.`,
  },
  {
    id: "analyse",
    matches: (c) => c.marketAnalysesToPrepare > 0,
    score: (c) => 70 + c.marketAnalysesToPrepare,
    diagnosis: (c) => `${c.marketAnalysesToPrepare} analyse${c.marketAnalysesToPrepare > 1 ? "s" : ""} de marché reste${c.marketAnalysesToPrepare > 1 ? "nt" : ""} à finaliser; la valeur vient de la recommandation défendable, pas du volume de comparables.`,
  },
  {
    id: "appels",
    matches: (c) => c.callsToMake > 0 || c.radarProspectsToCall > 0,
    score: (c) => 60 + c.callsToMake + c.radarProspectsToCall,
    diagnosis: (c) => `Tu as ${c.callsToMake} appel${c.callsToMake > 1 ? "s" : ""} planifié${c.callsToMake > 1 ? "s" : ""} et ${c.radarProspectsToCall} prospect${c.radarProspectsToCall > 1 ? "s" : ""} Radar disponible${c.radarProspectsToCall > 1 ? "s" : ""}; le prochain apprentissage commercial se trouve dans une conversation, pas dans une nouvelle préparation.`,
  },
  {
    id: "pipeline_vide",
    matches: (c) => c.totalProspects === 0,
    score: () => 55,
    diagnosis: () => "Ton pipeline ne contient encore aucun prospect réel; le premier objectif n’est pas de convertir, mais de créer assez de conversations pour apprendre où se trouve la demande.",
  },
  {
    id: "pipeline_actif",
    matches: (c) => c.totalProspects > 0,
    score: (c) => 40 + Math.min(c.totalProspects, 20),
    diagnosis: (c) => `Ton pipeline contient ${c.totalProspects} prospect${c.totalProspects > 1 ? "s" : ""}; le risque principal est de traiter tous les dossiers pareil au lieu de concentrer l’attention sur la prochaine décision de chaque client.`,
  },
  {
    id: "documents",
    matches: (c) => c.mandatesWithMissingDocuments > 0,
    score: (c) => 35 + c.mandatesWithMissingDocuments,
    diagnosis: (c) => `${c.mandatesWithMissingDocuments} mandat${c.mandatesWithMissingDocuments > 1 ? "s ont" : " a"} des documents manquants; cette friction administrative peut retarder une étape client déjà engagée.`,
  },
  {
    id: "marketing",
    matches: (c) => c.marketingActionsToGenerate > 0,
    score: (c) => 30 + c.marketingActionsToGenerate,
    diagnosis: (c) => `${c.marketingActionsToGenerate} action${c.marketingActionsToGenerate > 1 ? "s" : ""} marketing reste${c.marketingActionsToGenerate > 1 ? "nt" : ""}; chaque contenu doit soutenir une propriété, une objection ou une prochaine conversation précise.`,
  },
  {
    id: "objectif",
    matches: () => true,
    score: () => 10,
    diagnosis: (c) => `Avec ${c.totalProspects} prospect${c.totalProspects > 1 ? "s" : ""} actif${c.totalProspects > 1 ? "s" : ""}, ton objectif utile est celui qui rapproche aujourd’hui un dossier d’une conversation, d’un rendez-vous ou d’un mandat.`,
  },
];

const ACTIONS: Action[] = [
  { instruction: (c) => c.informationRequests > 0 ? "Réponds à la demande la plus récente, puis termine par une question ouverte sur le projet et l’échéancier." : "Choisis le dossier dont la prochaine étape est la moins ambiguë et exécute-la avant d’ouvrir une autre tâche." },
  { instruction: (c) => c.callsToMake > 0 ? `Lance un bloc de ${Math.min(Math.max(c.callsToMake, 1), 5)} appel${Math.min(Math.max(c.callsToMake, 1), 5) > 1 ? "s" : ""}, puis note après chacun la motivation, l’échéancier et la prochaine permission obtenue.` : "Crée une première conversation : sélectionne un prospect, prépare une question de découverte et appelle sans chercher à réciter un argumentaire." },
  { instruction: (c) => c.followupsDue > 0 ? "Traite le suivi le plus ancien avec un message qui rappelle le contexte, apporte une information utile et propose une prochaine étape facile à accepter." : "Prépare une relance datée pour le contact le plus avancé afin que la relation ne dépende pas de ta mémoire." },
  { instruction: (c) => c.sellerAppointmentsToPrepare > 0 || c.marketAnalysesToPrepare > 0 ? "Prépare une recommandation en trois points : situation du marché, fourchette défendable et décision que le vendeur devra prendre." : "Avant chaque proposition, formule une question qui distingue le besoin déclaré de la contrainte qui guidera réellement la décision." },
  { instruction: (c) => c.totalProspects > 0 ? "Classe les prospects par prochaine décision attendue, puis consacre vingt minutes uniquement au groupe le plus proche d’un engagement concret." : "Ajoute assez de prospects pour tenir un premier bloc de cinq conversations; mesure les réponses obtenues plutôt que de juger la journée sur une seule réaction." },
];

const DEFAULT_CONTEXT: DirectorMessageContext = {
  informationRequests: 0,
  sellerAppointmentsToPrepare: 0,
  followupsDue: 0,
  marketAnalysesToPrepare: 0,
  radarProspectsToCall: 0,
  callsToMake: 0,
  mandatesWithMissingDocuments: 0,
  marketingActionsToGenerate: 0,
  totalProspects: 0,
};

export const DIRECTOR_MESSAGE_LIBRARY: DirectorMessage[] = LENSES.flatMap((lens, lensIndex) =>
  SITUATIONS.flatMap((situation, situationIndex) =>
    ACTIONS.map((action, actionIndex) => ({
      id: `director-${String(lensIndex + 1).padStart(2, "0")}-${String(situationIndex + 1).padStart(2, "0")}-${actionIndex + 1}`,
      mood: lens.mood,
      situation: situation.id,
      discipline: lens.discipline,
      text: [lens.opening, situation.diagnosis(DEFAULT_CONTEXT), action.instruction(DEFAULT_CONTEXT)].join(" "),
    })),
  ),
);

if (DIRECTOR_MESSAGE_LIBRARY.length !== 500) {
  throw new Error(`La bibliothèque du Directeur doit contenir exactement 500 messages; total actuel : ${DIRECTOR_MESSAGE_LIBRARY.length}.`);
}

export function selectDirectorMessage({
  userMessage,
  context,
}: {
  userMessage: string;
  context: DirectorMessageContext;
}): DirectorMessage {
  const mood = detectMood(userMessage);
  const situation = [...SITUATIONS]
    .filter((candidate) => candidate.matches(context))
    .sort((a, b) => b.score(context) - a.score(context))[0] ?? SITUATIONS[SITUATIONS.length - 1];

  const eligibleLenses = LENSES.map((lens, index) => ({ lens, index })).filter(({ lens }) => lens.mood === mood);
  const lensChoice = eligibleLenses[stableHash(userMessage + JSON.stringify(context)) % eligibleLenses.length];
  const actionIndex = stableHash(`${userMessage}|${context.callsToMake}|${context.totalProspects}`) % ACTIONS.length;
  const situationIndex = SITUATIONS.findIndex((entry) => entry.id === situation.id);
  const id = `director-${String(lensChoice.index + 1).padStart(2, "0")}-${String(situationIndex + 1).padStart(2, "0")}-${actionIndex + 1}`;

  return {
    id,
    mood,
    situation: situation.id,
    discipline: lensChoice.lens.discipline,
    text: [lensChoice.lens.opening, situation.diagnosis(context), ACTIONS[actionIndex].instruction(context)].join(" "),
  };
}

function detectMood(message: string): DirectorMood {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/(decourage|demotive|inutile|aucun resultat|ca ne marche|abandon)/.test(normalized)) return "découragé";
  if (/(stress|deborde|pression|urgent|anxieux|panique|trop de)/.test(normalized)) return "stressé";
  if (/(fatigue|epuise|plus d'energie|sans energie|brule)/.test(normalized)) return "fatigué";
  if (/(motive|pret|attaque|energie|allons-y|objectif ambitieux)/.test(normalized)) return "motivé";
  return "neutre";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
