import { generateWithOpenAI, getOpenAIErrorPayload } from "@/lib/openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  const result: {
    hasKey: boolean;
    status: "ok" | "error";
    message?: string;
    diagnostic?: string;
    test?: string;
  } = {
    hasKey: false,
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

    result.message = "Le diagnostic OpenAI a échoué.";
    return Response.json(result, { status: 503 });
  }
}
