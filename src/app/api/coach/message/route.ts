import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import type { SoniaBattlePlan } from "@/lib/sonia-beta";

export const runtime = "nodejs";

export type CoachMessageRequest = {
  userName?: string;
  plan: {
    callsToMake: number;
    radarProspectsToCall: number;
    followupsDue: number;
    sellerAppointmentsToPrepare: number;
    marketAnalysesToPrepare: number;
    mandatesWithMissingDocuments: number;
    marketingActionsToGenerate: number;
  };
};

export type CoachMessageResponse = {
  greeting: string;
  mainMessage: string;
  focus: string;
  recommendation: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CoachMessageRequest;
    const { userName = "Sonia", plan } = body;

    if (!plan) {
      return Response.json({ error: "plan is required" }, { status: 400 });
    }

    const message = await generateCoachMessage(userName, plan);
    return Response.json(message);
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

async function generateCoachMessage(
  userName: string,
  plan: CoachMessageRequest["plan"],
): Promise<CoachMessageResponse> {
  const planSummary = `
- ${plan.radarProspectsToCall} prospects Radar à appeler
- ${plan.callsToMake} appels à faire
- ${plan.followupsDue} relances dues
- ${plan.sellerAppointmentsToPrepare} rendez-vous vendeurs à préparer
- ${plan.marketAnalysesToPrepare} analyses de marché à finaliser
- ${plan.mandatesWithMissingDocuments} documents vendeur manquants
- ${plan.marketingActionsToGenerate} actions marketing à générer
  `.trim();

  const systemPrompt = `You are a real estate sales coach for ${userName}. Generate motivational and actionable daily coaching messages in French.

The message should:
1. Be professional but warm and conversational
2. Reference the actual workload and priorities for today
3. Be concise but inspiring
4. Focus on action and results
5. Match the tone of a supportive mentor

Always respond ONLY with a valid JSON object (no markdown, no code blocks, no extra text). Never include backticks or json markers.`;

  const userPrompt = `Generate today's coaching messages for ${userName} based on this daily plan:

${planSummary}

Respond ONLY with a JSON object (no markdown or code blocks) with exactly these 4 fields:
{
  "greeting": "Brief greeting with emoji (e.g. 'Bonjour Sonia 👋')",
  "mainMessage": "Main message about today's objective (2-3 sentences max)",
  "focus": "Today's focus line (1 sentence, inspirational)",
  "recommendation": "First action recommendation (1-2 sentences, actionable)"
}

Respond in French.`;

  const responseText = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 400,
    temperature: 0.7,
  });

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as CoachMessageResponse;

    // Validate required fields
    if (
      typeof parsed.greeting !== "string" ||
      typeof parsed.mainMessage !== "string" ||
      typeof parsed.focus !== "string" ||
      typeof parsed.recommendation !== "string"
    ) {
      throw new Error("Invalid response structure");
    }

    return {
      greeting: parsed.greeting.trim(),
      mainMessage: parsed.mainMessage.trim(),
      focus: parsed.focus.trim(),
      recommendation: parsed.recommendation.trim(),
    };
  } catch (parseError) {
    console.error("Failed to parse Coach message from OpenAI:", responseText, parseError);
    // Return fallback
    return {
      greeting: `Bonjour ${userName} 👋`,
      mainMessage: "Aujourd'hui, on va avancer. Je t'ai préparé ton plan de bataille.",
      focus: "Un appel vaut mieux que dix idées.",
      recommendation: "On garde ça simple : appels, relances, rendez-vous vendeurs, analyses de marché avant la rencontre, puis documents et mise en marché quand le mandat est signé.",
    };
  }
}
