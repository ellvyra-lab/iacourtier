// Thin wrapper around the OpenAI Chat Completions API. Kept deliberately
// simple — one model, one call shape — because the product only needs
// "system prompt + user inputs → text result" for every assistant.

export class AIUnavailableError extends Error {}

export async function generateWithOpenAI({
  systemPrompt,
  userPrompt,
  maxTokens = 900,
  temperature = 0.7,
}: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // No key configured yet — fail in a way the API route can catch and
    // turn into the friendly "service temporairement indisponible" message,
    // rather than a raw network error.
    throw new AIUnavailableError("OPENAI_API_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      // Generous but bounded — a hung request shouldn't hang the whole UI.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new AIUnavailableError(
      err instanceof Error ? err.message : "Network error calling OpenAI"
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AIUnavailableError(
      `OpenAI API error ${response.status}: ${detail.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new AIUnavailableError("Empty response from OpenAI");
  }

  return text.trim();
}
