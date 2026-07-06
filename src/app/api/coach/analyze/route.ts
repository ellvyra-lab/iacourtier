import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import { getCoachScenario, type CoachScenarioId } from "@/lib/prospecting-coach";
import type { CoachFeedback } from "@/lib/prospecting-coach/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { response, scenarioId } = body as {
      response?: string;
      scenarioId?: string;
    };

    if (!response || typeof response !== "string") {
      return Response.json(
        { error: "response is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (!scenarioId || typeof scenarioId !== "string") {
      return Response.json({ error: "scenarioId is required" }, { status: 400 });
    }

    const scenario = getCoachScenario(scenarioId as CoachScenarioId);
    const feedback = await generateCoachFeedbackWithOpenAI(response, scenario, scenarioId as CoachScenarioId);

    return Response.json({ feedback });
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

async function generateCoachFeedbackWithOpenAI(
  userResponse: string,
  scenario: ReturnType<typeof getCoachScenario>,
  scenarioId: CoachScenarioId,
): Promise<CoachFeedback> {
  const systemPrompt = `You are an expert sales coach evaluating a real estate agent's prospecting response.

Evaluate the response based on these criteria:
1. Natural tone and professionalism (not robotic or too aggressive)
2. Open questions that make the owner talk
3. Creates curiosity around value, market, options, or timing
4. Clear ask for an appointment/meeting/call/estimation
5. Avoids aggressive language (must sell now, last chance, grave error)
6. Avoids being too soft (too short, apologetic, uncertain)
7. Never reveals: Radar, AI, algorithm, data source, scoring signals

The scenario is: "${scenario.label}"
The owner says: "${scenario.ownerOpening}"
Context: ${scenario.context}

Respond ONLY with a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "score": <number 1-10>,
  "good": "<string of positive observations>",
  "weak": "<string of areas to improve>",
  "topSellerAnswer": "<example of excellent response>",
  "nextBestQuestion": "<next question the agent should ask>",
  "checks": {
    "natural": <boolean>,
    "strongQuestion": <boolean>,
    "curiosity": <boolean>,
    "appointment": <boolean>,
    "tooAggressive": <boolean>,
    "tooSoft": <boolean>
  }
}`;

  const userPrompt = `Analyze this prospecting response:
"${userResponse}"

Provide feedback as JSON only.`;

  const responseText = await generateWithOpenAI({
    systemPrompt,
    userPrompt,
    maxTokens: 600,
    temperature: 0.3,
  });

  // Parse the response
  try {
    // Try to extract JSON from the response in case there's surrounding text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    const feedback = JSON.parse(jsonMatch[0]) as CoachFeedback;

    // Validate structure
    if (
      typeof feedback.score !== "number" ||
      typeof feedback.good !== "string" ||
      typeof feedback.weak !== "string" ||
      typeof feedback.topSellerAnswer !== "string" ||
      typeof feedback.nextBestQuestion !== "string" ||
      !feedback.checks ||
      typeof feedback.checks.natural !== "boolean"
    ) {
      throw new Error("Invalid feedback structure");
    }

    // Clamp score to 1-10
    feedback.score = Math.max(1, Math.min(10, feedback.score));

    return feedback;
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", responseText, parseError);
    throw new Error(`Invalid response from OpenAI: ${parseError instanceof Error ? parseError.message : "Parse error"}`);
  }
}
