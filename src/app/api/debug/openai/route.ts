import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";

export const runtime = "nodejs";

export async function GET() {
  const result: {
    hasKey: boolean;
    model: string | null;
    status: "ok" | "error";
    message?: string;
    diagnostic?: string;
    test?: string;
  } = {
    hasKey: false,
    model: null,
    status: "error",
  };

  // Check if API key exists
  const hasKey = !!process.env.OPENAI_API_KEY;
  result.hasKey = hasKey;

  if (!hasKey) {
    result.message = "OPENAI_API_KEY not configured";
    result.diagnostic = "missing_api_key";
    return Response.json(result, { status: 500 });
  }

  // Get model
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  result.model = model;

  try {
    // Test API call
    const testResponse = await generateWithOpenAI({
      systemPrompt: "You are a helpful assistant. Respond briefly in French.",
      userPrompt: "Say 'OpenAI integration working' in one sentence.",
      maxTokens: 100,
      temperature: 0.5,
    });

    result.status = "ok";
    result.test = testResponse;
    return Response.json(result);
  } catch (error) {
    const openAIError = getOpenAIErrorPayload(error);
    if (openAIError) {
      result.status = "error";
      result.message = openAIError.body.error;
      result.diagnostic = openAIError.body.diagnostic;
      return Response.json(result, { status: openAIError.status });
    }

    result.message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(result, { status: 503 });
  }
}
