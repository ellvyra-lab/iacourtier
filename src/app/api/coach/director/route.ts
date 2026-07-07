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

export type DirectorChatResponse = { reply: string };

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
    return Response.json({ reply } satisfies DirectorChatResponse);
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

async function generateDirectorReply(message: string, history: DirectorChatTurn[], context: DirectorChatContext) {
  const userName = context.userName || "Sonia";

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
- 2 à 4 phrases maximum, concret et actionnable.
- Tu t'appuies UNIQUEMENT sur le contexte réel fourni ci-dessous, jamais sur des suppositions.
- Tu ne modifies aucune donnée toi-même : tu conseilles seulement, tu ne dis jamais avoir exécuté une action.
- Tu respectes l'ordre de priorité officiel de l'agence ci-dessous quand tu recommandes une action.

${priorityRules}

Contexte actuel de l'agence pour ${userName} :
${contextSummary}`;

  const historyText = history
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? userName : "Directeur"} : ${turn.content}`)
    .join("\n");

  const userPrompt = `${historyText ? `Historique récent de la conversation :\n${historyText}\n\n` : ""}Nouveau message de ${userName} : "${message}"

Réponds directement à ${userName}, comme le ferait un directeur d'agence immobilière expérimenté qui connaît son dossier. Ne réponds jamais de façon générique.`;

  const reply = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.6,
  });

  return reply.trim();
}
