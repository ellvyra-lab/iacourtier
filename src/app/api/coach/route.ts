import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import type { SoniaBattlePlan } from "@/lib/sonia-beta";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type CoachDataRequest = {
  userName?: string;
  battlePlan: SoniaBattlePlan;
};

export type CoachDataResponse = {
  message: string;
  focus: string;
  nextAction: string;
  status: "success" | "error";
};

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });

    const body = (await request.json()) as CoachDataRequest;
    const { userName = "Sonia", battlePlan } = body;

    if (!battlePlan) {
      return Response.json(
        {
          message: "Plan de bataille manquant",
          focus: "Vérifiez les données envoyées",
          nextAction: "Rechargez la page",
          status: "error",
        },
        { status: 400 },
      );
    }

    const coachData = await generateCoachData(userName, battlePlan);
    return Response.json(coachData);
  } catch (error) {
    console.error("[/api/coach] Error:", error);
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      return Response.json(
        {
          message: openAIError.body.error || "Erreur OpenAI",
          focus: "Une erreur s'est produite",
          nextAction: "Réessayez",
          status: "error" as const,
        },
        { status: openAIError.status },
      );
    }

    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json(
      {
        message: errorMsg,
        focus: "Une erreur s'est produite",
        nextAction: "Réessayez",
        status: "error" as const,
      },
      { status: 500 },
    );
  }
}


async function generateCoachData(
  userName: string,
  battlePlan: SoniaBattlePlan,
): Promise<CoachDataResponse> {
  const planSummary = `
Today's workload for ${userName}:
- ${battlePlan.radarProspectsToCall.length} Radar prospects to call: ${battlePlan.radarProspectsToCall.map((p) => p.name).join(", ") || "none"}
- ${battlePlan.callsToMake.length} total calls to make
- ${battlePlan.followupsDue.length} follow-ups due: ${battlePlan.followupsDue.map((p) => p.name).join(", ") || "none"}
- ${battlePlan.sellerAppointmentsToPrepare.length} seller appointments to prepare
- ${battlePlan.marketAnalysesToPrepare.length} market analyses to finalize
- ${battlePlan.mandatesWithMissingDocuments.length} mandates with missing documents
- ${battlePlan.marketingActionsToGenerate.length} marketing actions to generate
  `.trim();

  const systemPrompt = `You are a real estate sales coach for ${userName}. Generate motivational and actionable daily coaching messages in French.

Always respond ONLY with a valid JSON object (no markdown, no code blocks, no extra text). Never include backticks or json markers.`;

  const userPrompt = `Generate today's coaching data for ${userName} based on this daily workload:

${planSummary}

Respond ONLY with a JSON object (no markdown or code blocks) with exactly these 4 fields:
{
  "message": "Main motivational message about today's objective (2-3 sentences max, in French)",
  "focus": "Today's focus line (1 sentence, inspirational and actionable, in French)",
  "nextAction": "First concrete action to take today (1 sentence, in French)",
  "status": "success"
}`;

  const responseText = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.7,
  });

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as CoachDataResponse;

    // Validate required fields
    if (
      typeof parsed.message !== "string" ||
      typeof parsed.focus !== "string" ||
      typeof parsed.nextAction !== "string"
    ) {
      throw new Error("Invalid response structure");
    }

    return {
      message: parsed.message.trim(),
      focus: parsed.focus.trim(),
      nextAction: parsed.nextAction.trim(),
      status: "success",
    };
  } catch (parseError) {
    console.error("[generateCoachData] Failed to parse response:", responseText, parseError);
    // Return fallback
    return {
      message: `Salut ${userName}! Aujourd'hui, focus sur la prospection et les appels. Un rendez-vous vendeur t'attend.`,
      focus: "Un appel vaut mieux que dix idées.",
      nextAction: "Commence par appeler tes prospects Radar.",
      status: "success",
    };
  }
}
