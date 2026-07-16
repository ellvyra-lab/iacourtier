import { selectDirectorMessage } from "@/lib/director/message-library";
import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";

export const runtime = "nodejs";

export type DirectorChatTurn = { role: "user" | "assistant"; content: string };

export type DirectorChatContext = {
  userName?: string;
  informationRequests: number;
  informationRequestExample?: { name: string; address: string } | null;
  sellerAppointmentsToPrepare: number;
  followupsDue: number;
  marketAnalysesToPrepare: number;
  radarProspectsToCall: number;
  callsToMake: number;
  mandatesWithMissingDocuments: number;
  marketingActionsToGenerate: number;
  totalProspects: number;
};

export type DirectorChatRequest = {
  message: string;
  history?: DirectorChatTurn[];
  context: DirectorChatContext;
};

export type DirectorAction = { label: string; href: string };

export type DirectorChatResponse = { reply: string; action: DirectorAction; secondaryActions: DirectorAction[] };

const ACTIONS = {
  respond: { label: "Répondre", href: "/tableau-de-bord/prospects/nouvelle-demande" },
  prepare: { label: "Préparer", href: "/tableau-de-bord/actions/prepare-market-analysis" },
  followUps: { label: "Faire les suivis", href: "/tableau-de-bord/prospects" },
  prospect: { label: "Prospecter", href: "/tableau-de-bord/radar-prospection" },
} as const satisfies Record<string, DirectorAction>;

// Ordre de priorité officiel de l'agence : une seule action principale, toujours calculée
// à partir des données réelles (jamais devinée dans le texte généré par OpenAI).
function buildPrimaryAction(context: DirectorChatContext): DirectorAction {
  if (context.informationRequests > 0) return ACTIONS.respond;
  if (context.sellerAppointmentsToPrepare > 0 || context.marketAnalysesToPrepare > 0) return ACTIONS.prepare;
  if (context.followupsDue > 0) return ACTIONS.followUps;
  return ACTIONS.prospect;
}

function buildSecondaryActions(primary: DirectorAction): DirectorAction[] {
  return Object.values(ACTIONS).filter((action) => action.href !== primary.href);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DirectorChatRequest;
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    if (!body.context) {
      return Response.json({ error: "context is required" }, { status: 400 });
    }

    const reply = await generateDirectorReply(message, body.history || [], body.context);
    const action = buildPrimaryAction(body.context);
    const secondaryActions = buildSecondaryActions(action);
    return Response.json({ reply, action, secondaryActions } satisfies DirectorChatResponse);
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return Response.json(
        { error: openAIError.body.error, diagnostic: openAIError.body.diagnostic },
        { status: openAIError.status },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

function buildMentorBrief(context: DirectorChatContext, inspiration: string) {
  let observation: string;
  let analysis: string;
  let recommendation: string;

  if (context.informationRequests > 0) {
    const example = context.informationRequestExample;
    observation = `Tu as ${context.informationRequests} demande${context.informationRequests > 1 ? "s" : ""} d'information non traitée${context.informationRequests > 1 ? "s" : ""}${example ? `, dont celle de ${example.name} pour ${example.address}` : ""}.`;
    analysis = "Une demande entrante perd rapidement de sa valeur quand la première conversation tarde; elle est déjà plus engagée qu'un contact froid.";
    recommendation = example ? `Réponds maintenant à ${example.name} et termine par une question sur son projet et son échéancier.` : "Réponds maintenant à la demande la plus récente et termine par une question sur le projet et l'échéancier.";
  } else if (context.sellerAppointmentsToPrepare > 0) {
    observation = `Tu as ${context.sellerAppointmentsToPrepare} rendez-vous vendeur${context.sellerAppointmentsToPrepare > 1 ? "s" : ""} à préparer et ${context.marketAnalysesToPrepare} analyse${context.marketAnalysesToPrepare > 1 ? "s" : ""} de marché à finaliser.`;
    analysis = "La confiance du vendeur se gagne lorsque tes comparables mènent à une recommandation claire, pas lorsqu'ils restent une accumulation de données.";
    recommendation = "Prépare d'abord le prochain rendez-vous avec une fourchette défendable et une décision précise à faire prendre au vendeur.";
  } else if (context.followupsDue > 0) {
    observation = `Tu as ${context.followupsDue} suivi${context.followupsDue > 1 ? "s" : ""} en attente et ${context.callsToMake} appel${context.callsToMake > 1 ? "s" : ""} prévu${context.callsToMake > 1 ? "s" : ""}.`;
    analysis = "Un suivi protège une relation déjà amorcée; le reporter coûte généralement plus cher que démarrer une nouvelle conversation.";
    recommendation = "Commence par le suivi le plus ancien avec un rappel du contexte, une information utile et une prochaine étape simple.";
  } else if (context.marketAnalysesToPrepare > 0) {
    observation = `Tu as ${context.marketAnalysesToPrepare} analyse${context.marketAnalysesToPrepare > 1 ? "s" : ""} de marché incomplète${context.marketAnalysesToPrepare > 1 ? "s" : ""} avant tes prochaines actions commerciales.`;
    analysis = "Une analyse inachevée ralentit la décision du client et réduit ta capacité à défendre un positionnement de prix.";
    recommendation = "Finalise l'analyse la plus urgente et formule sa recommandation en une phrase avant de passer à autre chose.";
  } else if (context.callsToMake > 0 || context.radarProspectsToCall > 0) {
    observation = `Tu as ${context.callsToMake} appel${context.callsToMake > 1 ? "s" : ""} planifié${context.callsToMake > 1 ? "s" : ""} et ${context.radarProspectsToCall} prospect${context.radarProspectsToCall > 1 ? "s" : ""} Radar prêt${context.radarProspectsToCall > 1 ? "s" : ""} à être contacté${context.radarProspectsToCall > 1 ? "s" : ""}.`;
    analysis = "Ton pipeline progresse lorsque chaque appel clarifie une motivation, un échéancier ou une prochaine permission; la préparation seule ne produit aucun de ces signaux.";
    recommendation = "Fais maintenant le premier appel et note immédiatement la motivation, l'échéancier et la prochaine étape obtenue.";
  } else if (context.totalProspects === 0) {
    observation = "Ton pipeline ne contient actuellement aucun prospect réel et aucun appel n'est planifié.";
    analysis = "Sans volume minimal de conversations, tu ne peux ni mesurer ton approche ni créer assez d'occasions pour obtenir un mandat.";
    recommendation = "Ajoute tes cinq premiers prospects, puis appelle le premier sans attendre de perfectionner ton script.";
  } else {
    observation = `Ton pipeline contient ${context.totalProspects} prospect${context.totalProspects > 1 ? "s" : ""}, sans urgence commerciale détectée aujourd'hui.`;
    analysis = "L'absence d'urgence est le meilleur moment pour faire avancer volontairement le dossier le plus proche d'une décision.";
    recommendation = "Choisis le prospect le plus avancé et fixe avec lui une prochaine étape datée.";
  }

  return [
    `Observation — ${observation}`,
    `Analyse — ${analysis}`,
    `Recommandation — ${recommendation}`,
    `Inspiration — ${inspiration}`,
  ].join("\n");
}

function enforceMentorStructure(reply: string, fallback: string) {
  const normalized = reply.replace(/\r/g, "").trim();
  const match = normalized.match(
    /Observation\s*[—:-]\s*([\s\S]*?)\s*Analyse\s*[—:-]\s*([\s\S]*?)\s*Recommandation\s*[—:-]\s*([\s\S]*?)\s*Inspiration\s*[—:-]\s*([\s\S]*)/i,
  );
  if (!match) return fallback;

  const sections = match.slice(1, 5).map((section) => section.replace(/\s+/g, " ").trim());
  if (sections.some((section) => !section)) return fallback;
  return [
    `Observation — ${sections[0]}`,
    `Analyse — ${sections[1]}`,
    `Recommandation — ${sections[2]}`,
    `Inspiration — ${sections[3]}`,
  ].join("\n");
}

async function generateDirectorReply(message: string, history: DirectorChatTurn[], context: DirectorChatContext) {
  const userName = context.userName || "Sonia";
  const selectedMessage = selectDirectorMessage({ userMessage: message, context });
  const mentorBrief = buildMentorBrief(context, selectedMessage.text);

  const contextSummary = `
- Demandes d'information non traitées : ${context.informationRequests}${
    context.informationRequestExample ? ` (ex. ${context.informationRequestExample.name}, ${context.informationRequestExample.address})` : ""
  }
- Rendez-vous vendeurs à préparer : ${context.sellerAppointmentsToPrepare}
- Suivis dus : ${context.followupsDue}
- Analyses de marché à finaliser : ${context.marketAnalysesToPrepare}
- Prospects Radar à appeler : ${context.radarProspectsToCall}
- Appels à faire : ${context.callsToMake}
- Documents vendeur manquants : ${context.mandatesWithMissingDocuments}
- Actions marketing à générer : ${context.marketingActionsToGenerate}
- Nombre total de prospects actifs : ${context.totalProspects}
  `.trim();

  const priorityRules = `Ordre de priorité officiel de l'agence, du plus urgent au moins urgent :
1. Demande d'information non traitée -> créer le prospect et préparer le premier appel.
2. Rendez-vous vendeur prévu -> préparer le rendez-vous / l'évaluation.
3. Suivis dus -> les compléter avant tout le reste.
4. Analyse de marché à terminer -> la finaliser avant le prochain rendez-vous.
5. Sinon -> prospecter (Radar).`;

  const systemPrompt = `Tu es le Directeur des opérations d'IACourtier, une agence immobilière au Québec. Tu n'es PAS un assistant généraliste et tu ne dois jamais répondre comme ChatGPT. Tu es le directeur d'agence de ${userName}, un courtier immobilier.

Ton style :
- Professionnel, direct, orienté action.
- Toujours en français, jamais en anglais.
- Jamais "en tant qu'IA" ni "je suis un assistant" : tu es un directeur d'agence.
- Maximum 6 lignes, concret et actionnable.
- Chaque réponse contient exactement quatre lignes, dans cet ordre : "Observation —", "Analyse —", "Recommandation —", "Inspiration —".
- Observation décrit uniquement les chiffres et faits réels du contexte.
- Analyse explique l'enjeu commercial ou comportemental précis.
- Recommandation contient UNE seule action prioritaire, jamais une liste.
- Inspiration reprend le message sélectionné dans la bibliothèque, sans citation inventée ni attribution à une personnalité.
- Tu t'appuies UNIQUEMENT sur le contexte réel fourni ci-dessous, jamais sur des suppositions.
- Tu ne modifies aucune donnée toi-même : tu conseilles seulement, tu ne dis jamais avoir exécuté une action.
- Tu respectes l'ordre de priorité officiel de l'agence ci-dessous quand tu recommandes une action.

${priorityRules}

Message de coaching sélectionné dans la bibliothèque interne (référence ${selectedMessage.id}, ${selectedMessage.discipline}, humeur ${selectedMessage.mood}). Tu dois t'en servir comme ancrage concret et préserver son conseil principal :
"${selectedMessage.text}"

Contexte actuel de l'agence pour ${userName} :
${contextSummary}`;

  const historyText = history
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? userName : "Directeur"} : ${turn.content}`)
    .join("\n");

  const userPrompt = `${historyText ? `Historique récent de la conversation :\n${historyText}\n\n` : ""}Nouveau message de ${userName} : "${message}"

Réponds directement à ${userName}, comme le ferait un directeur d'agence immobilière expérimenté qui connaît son dossier. Respecte exactement les quatre lignes obligatoires et ne donne qu'une seule recommandation. Ne réponds jamais de façon générique.`;

  const reply = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.6,
  });

  return enforceMentorStructure(reply, mentorBrief);
}
