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
      assert.equal(JSON.parse(init.body).reasoning_effort, 'minimal');
      return Response.json({ choices: [{ message: { content: 'meta-fixture' } }] });
    };
    assert.equal(await getAIProvider('meta').generate(request), 'meta-fixture');
    global.fetch = async () => new Response('billing synthetic-secret', { status: 402 });
    await assert.rejects(getAIProvider('meta').generate(request), error => error.status === 402 && error.message.includes('[REDACTED]') && !error.message.includes('synthetic-secret'));
    global.fetch = async () => Response.json({ choices: [] });
    await assert.rejects(getAIProvider('meta').generate(request), /sans texte/);
    global.fetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'partial answer' } }] });
    await assert.rejects(getAIProvider('meta').generate(request), error => error.diagnostic === 'output_limit');
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

test('Meta distinguishes a successful HTTP response with exhausted output from a network failure', () => {
  const { MetaProviderError, metaPublicError } = loader()('@/lib/server/ai-provider');
  assert.match(metaPublicError(new MetaProviderError('fixture', 200, 'output_limit')), /limite de génération/);
  assert.doesNotMatch(metaPublicError(new MetaProviderError('fixture', 200, 'output_limit')), /HTTP 200/);
  assert.match(metaPublicError(new MetaProviderError('fixture', 200, 'empty_response')), /sans texte exploitable/);
});

test('Meta usage telemetry counts tokens without logging prompts, responses or secrets', async () => {
  const { getAIProvider } = loader()('@/lib/server/ai-provider');
  const saved = { MODEL_API_KEY: process.env.MODEL_API_KEY, META_MODEL: process.env.META_MODEL, META_BASE_URL: process.env.META_BASE_URL };
  const originalFetch = global.fetch, originalInfo = console.info, logs = [];
  Object.assign(process.env, { MODEL_API_KEY: 'synthetic-secret', META_MODEL: 'test-model', META_BASE_URL: 'https://api.meta.ai/v1' });
  console.info = (...values) => logs.push(values);
  global.fetch = async () => Response.json({ usage: { prompt_tokens: 230, completion_tokens: 17 }, choices: [{ message: { content: 'private-answer' } }] });
  try {
    await getAIProvider('meta').generate({ systemPrompt: 'private-system', userPrompt: 'private-user', maxTokens: 100 });
    assert.equal(logs.length, 2);
    assert.equal(logs[1][1].inputTokens, 230); assert.equal(logs[1][1].outputTokens, 17);
    assert.equal(logs[1][1].maxOutputTokens, 100);
    assert.doesNotMatch(JSON.stringify(logs), /synthetic-secret|private-system|private-user|private-answer/);
  } finally {
    global.fetch = originalFetch; console.info = originalInfo;
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
