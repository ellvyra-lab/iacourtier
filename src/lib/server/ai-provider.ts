import "server-only";
import { generateWithOpenAI } from "@/lib/openai";

export type AIRequest = Parameters<typeof generateWithOpenAI>[0];
export interface AIProvider {
  readonly id: "openai" | "meta";
  generate(request: AIRequest): Promise<string>;
}

export class MetaProviderError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = "MetaProviderError";
  }
}

const openAIProvider: AIProvider = { id: "openai", generate: generateWithOpenAI };
const metaProvider: AIProvider = {
  id: "meta",
  async generate({ systemPrompt, userPrompt, maxTokens, temperature, jsonMode }) {
    const key = process.env.MODEL_API_KEY?.trim();
    const model = process.env.META_MODEL?.trim();
    const base = process.env.META_BASE_URL?.trim();
    if (!key || !model || !base) throw new MetaProviderError("Configuration Meta incomplète.");
    let url: URL;
    try { url = new URL(base); } catch { throw new MetaProviderError("META_BASE_URL invalide."); }
    if (url.origin !== "https://api.meta.ai" || url.pathname.replace(/\/$/, "") !== "/v1" || url.username || url.password || url.search || url.hash) {
      throw new MetaProviderError("META_BASE_URL doit cibler https://api.meta.ai/v1.");
    }
    const redact = (text: string) => text.split(key).join("[REDACTED]");
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST", redirect: "error",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "developer", content: systemPrompt }, { role: "user", content: userPrompt }],
          ...(maxTokens === undefined ? {} : { max_completion_tokens: maxTokens }),
          ...(temperature === undefined ? {} : { temperature }),
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new MetaProviderError("Appel Meta interrompu : erreur réseau ou délai dépassé.");
    }
    let raw: string;
    try { raw = await response.text(); } catch { throw new MetaProviderError("Lecture de la réponse Meta interrompue.", response.status); }
    if (!response.ok) throw new MetaProviderError(`Meta HTTP ${response.status}: ${redact(raw).slice(0, 2000)}`, response.status);
    let data;
    try { data = JSON.parse(raw); } catch { throw new MetaProviderError("Réponse Meta JSON invalide.", response.status); }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new MetaProviderError("Meta a répondu sans texte exploitable.", response.status);
    return redact(content.trim());
  },
};

// Explicit opt-in only. Existing Coach callers remain untouched; no automatic fallback.
export function getAIProvider(id: AIProvider["id"] = "openai"): AIProvider {
  if (id === "openai") return openAIProvider;
  if (id === "meta") return metaProvider;
  throw new Error("Provider IA inconnu.");
}
