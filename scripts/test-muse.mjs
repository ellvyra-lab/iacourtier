// Local Node-only diagnostic: no public route, CRM access, or OpenAI fallback.
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

const envFile = process.argv[2];
loadEnvFile(resolve(envFile || '.env.local'));
const key = process.env.MODEL_API_KEY?.trim();
const model = process.env.META_MODEL?.trim();
const base = process.env.META_BASE_URL?.trim();
const redact = (value) => key ? String(value).split(key).join('[REDACTED]') : String(value);
const report = (value) => console.log(redact(JSON.stringify(value, null, 2)));

try {
  if (!key || !model || !base) throw new Error('MODEL_API_KEY, META_MODEL et META_BASE_URL sont requis.');
  const url = new URL(base);
  if (url.origin !== 'https://api.meta.ai' || url.pathname.replace(/\/$/, '') !== '/v1' || url.search || url.hash || url.username || url.password) {
    throw new Error('META_BASE_URL doit cibler https://api.meta.ai/v1. Aucun secret envoyé.');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Réponds uniquement : Muse connecté à IACourtier.' }] }),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  if (!response.ok) {
    report({ success: false, requestedModel: model, status: response.status, metaError: raw });
    process.exitCode = 1;
  } else {
    const data = JSON.parse(raw);
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('Meta a répondu sans contenu texte exploitable.');
    report({ success: true, status: response.status, requestedModel: model, returnedModel: data.model ?? null, response: answer });
  }
} catch (error) {
  report({ success: false, requestedModel: model ?? null, error: error.message, networkCode: error.cause?.code ?? null });
  process.exitCode = 1;
}
