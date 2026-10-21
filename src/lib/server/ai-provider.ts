import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateWithOpenAI } from "@/lib/openai";

export type AIRequest = Parameters<typeof generateWithOpenAI>[0];
export interface AIProvider {
  readonly id: "openai" | "meta";
  generate(request: AIRequest): Promise<string>;
}
export type AIProviderId = AIProvider["id"];
const coachProvider = new AsyncLocalStorage<AIProviderId>();
export function currentCoachProvider(): AIProviderId { return coachProvider.getStore() || "openai"; }
export function parseAIProvider(value: unknown): AIProviderId {
  if (value === undefined || value === null || value === "openai") return "openai";
  if (value === "meta") return "meta";
  throw new Error("Fournisseur IA invalide.");
}
export function metaConfigured() {
  return Boolean(process.env.MODEL_API_KEY?.trim() && process.env.META_MODEL?.trim() && process.env.META_BASE_URL?.trim() === "https://api.meta.ai/v1");
}
export function withCoachAI<T>(provider: AIProviderId, work: () => Promise<T>): Promise<T> {
  return coachProvider.run(provider, work);
}
// Request-scoped selection: simultaneous brokers never share a global provider.
export function generateWithCoachAI(request: AIRequest): Promise<string> {
  return getAIProvider(currentCoachProvider()).generate(request);
}
export function metaPublicError(error: unknown): string | null {
  if (!(error instanceof MetaProviderError)) return null;
  if (error.status === 402) return "Meta refuse l’appel pour un problème de facturation (HTTP 402). Aucune réponse générée ni bascule vers OpenAI.";
  if (error.status === 401 || error.status === 403) return `Meta refuse l’autorisation (HTTP ${error.status}). Vérifie la configuration serveur.`;
  return `L’appel Meta a échoué${error.status ? ` (HTTP ${error.status})` : ""}. Aucune réponse générée ni bascule vers OpenAI.`;
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
    const metrics = { provider: "meta", model: redact(model).slice(0, 100), inputBytes: Buffer.byteLength(systemPrompt + userPrompt, "utf8"), maxOutputTokens: maxTokens ?? null };
    console.info("[coach.ai.attempt]", metrics);
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
    if (!response.ok) {
      console.info("[coach.ai.result]", { ...metrics, status: response.status });
      throw new MetaProviderError(`Meta HTTP ${response.status}: ${redact(raw).slice(0, 2000)}`, response.status);
    }
    let data;
    try { data = JSON.parse(raw); } catch { throw new MetaProviderError("Réponse Meta JSON invalide.", response.status); }
    const tokenCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    console.info("[coach.ai.result]", { ...metrics, status: response.status, inputTokens: tokenCount(data?.usage?.prompt_tokens), outputTokens: tokenCount(data?.usage?.completion_tokens) });
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
