import assert from 'node:assert/strict';
import test from 'node:test';
import { loader } from './helpers/connected-test-harness.mjs';

// Synthetic transport fixtures; the real acceptance call is scripts/test-muse.mjs.
test('OpenAI remains default; Meta is explicit and errors never fall back or reveal keys', async () => {
  let openAICalls = 0;
  const { getAIProvider } = loader({ '@/lib/openai': { generateWithOpenAI: async () => { openAICalls++; return 'openai-fixture'; } } })('@/lib/server/ai-provider');
  assert.equal(getAIProvider().id, 'openai');
  assert.equal(await getAIProvider().generate({}), 'openai-fixture');
  const saved = { MODEL_API_KEY: process.env.MODEL_API_KEY, META_MODEL: process.env.META_MODEL, META_BASE_URL: process.env.META_BASE_URL };
  const originalFetch = global.fetch;
  Object.assign(process.env, { MODEL_API_KEY: 'synthetic-secret', META_MODEL: 'test-model', META_BASE_URL: 'https://api.meta.ai/v1' });
  const request = { systemPrompt: 'system', userPrompt: 'hello' };
  try {
    global.fetch = async (url, init) => {
      assert.equal(url, 'https://api.meta.ai/v1/chat/completions');
      assert.equal(init.redirect, 'error');
      assert.equal(JSON.parse(init.body).model, 'test-model');
      return Response.json({ choices: [{ message: { content: 'meta-fixture' } }] });
    };
    assert.equal(await getAIProvider('meta').generate(request), 'meta-fixture');
    global.fetch = async () => new Response('billing synthetic-secret', { status: 402 });
    await assert.rejects(getAIProvider('meta').generate(request), error => error.status === 402 && error.message.includes('[REDACTED]') && !error.message.includes('synthetic-secret'));
    global.fetch = async () => Response.json({ choices: [] });
    await assert.rejects(getAIProvider('meta').generate(request), /sans texte/);
    global.fetch = async () => { throw new Error('network synthetic-secret'); };
    await assert.rejects(getAIProvider('meta').generate(request), /erreur réseau/);
    process.env.META_BASE_URL = 'https://example.com/v1';
    await assert.rejects(getAIProvider('meta').generate(request), /doit cibler/);
    assert.equal(openAICalls, 1);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
