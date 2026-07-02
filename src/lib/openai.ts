// Server-only wrapper around the OpenAI Chat Completions API.
// Client components must call an API route instead of importing this file.

export type OpenAIDiagnostic =
  | "missing_api_key"
  | "empty_api_key"
  | "invalid_api_key_format"
  | "invalid_api_key"
  | "openai_rate_limited"
  | "openai_api_error"
  | "openai_network_error"
  | "openai_empty_response";

export class AIUnavailableError extends Error {
  diagnostic: OpenAIDiagnostic;
  statusCode: number;
  publicMessage: string;
  publicDetail?: string;

  constructor({
    diagnostic,
    message,
    publicMessage,
    publicDetail,
    statusCode = 503,
  }: {
    diagnostic: OpenAIDiagnostic;
    message: string;
    publicMessage: string;
    publicDetail?: string;
    statusCode?: number;
  }) {
    super(message);
    this.name = "AIUnavailableError";
    this.diagnostic = diagnostic;
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.publicDetail = publicDetail;
  }
}

export function getOpenAIErrorPayload(error: unknown) {
  if (!(error instanceof AIUnavailableError)) return null;

  return {
    status: error.statusCode,
    body: {
      error: error.publicMessage,
      diagnostic: error.diagnostic,
      detail: error.publicDetail,
    },
  };
}

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
  const apiKey = readOpenAIKey();
  const model = readOpenAIModel();

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new AIUnavailableError({
      diagnostic: "openai_network_error",
      message: err instanceof Error ? err.message : "Network error calling OpenAI",
      publicMessage: "L'appel OpenAI a echoue avant de recevoir une reponse.",
      publicDetail: "Verifiez la connectivite reseau du serveur ou reessayez dans quelques instants.",
      statusCode: 503,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const diagnostic = response.status === 401 ? "invalid_api_key" : response.status === 429 ? "openai_rate_limited" : "openai_api_error";

    throw new AIUnavailableError({
      diagnostic,
      message: `OpenAI API error ${response.status}: ${detail.slice(0, 500)}`,
      publicMessage: response.status === 401 ? "La cle OpenAI configuree est invalide ou refusee par OpenAI." : "L'appel OpenAI a echoue.",
      publicDetail: `Statut OpenAI: ${response.status}`,
      statusCode: response.status === 401 ? 500 : 503,
    });
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new AIUnavailableError({
      diagnostic: "openai_empty_response",
      message: "Empty response from OpenAI",
      publicMessage: "OpenAI a repondu, mais sans texte exploitable.",
      statusCode: 502,
    });
  }

  return text.trim();
}

function readOpenAIKey() {
  const rawApiKey = process.env.OPENAI_API_KEY;

  if (typeof rawApiKey === "undefined") {
    throw new AIUnavailableError({
      diagnostic: "missing_api_key",
      message: "OPENAI_API_KEY is missing from process.env",
      publicMessage: "La variable OPENAI_API_KEY est absente de l'environnement serveur.",
      publicDetail: "Ajoutez OPENAI_API_KEY dans Vercel pour l'environnement utilise, puis redeployez.",
      statusCode: 500,
    });
  }

  const apiKey = rawApiKey.trim();

  if (!apiKey) {
    throw new AIUnavailableError({
      diagnostic: "empty_api_key",
      message: "OPENAI_API_KEY is present but empty",
      publicMessage: "La variable OPENAI_API_KEY est presente, mais vide.",
      publicDetail: "Remplissez OPENAI_API_KEY dans Vercel, puis redeployez.",
      statusCode: 500,
    });
  }

  if (!apiKey.startsWith("sk-")) {
    throw new AIUnavailableError({
      diagnostic: "invalid_api_key_format",
      message: "OPENAI_API_KEY does not look like an OpenAI API key",
      publicMessage: "La variable OPENAI_API_KEY est presente, mais son format ne ressemble pas a une cle OpenAI.",
      publicDetail: "La cle doit normalement commencer par sk-. Verifiez qu'aucune autre valeur n'a ete collee.",
      statusCode: 500,
    });
  }

  return apiKey;
}

function readOpenAIModel() {
  const model = process.env.OPENAI_MODEL?.trim();
  return model || "gpt-4o-mini";
}
