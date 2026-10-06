import { loadEnvFile } from 'node:process';
import { loader } from './helpers/connected-test-harness.mjs';
loadEnvFile('.env.local');
const load = loader();
const { understandCoachMessage } = load('@/lib/server/coach-intent');
const { emptyCoachContext } = load('@/lib/coach/conversation');
for (const text of [
  "peux-tu ajouter comme tâche aujourd'hui de contacter Martin pour son certificat de localisation et notaire",
  'Rappelle-moi demain de demander le certificat de localisation à Jacques.',
  "Je dois appeler le notaire aujourd'hui.",
  "Appelle Martin aujourd'hui.",
  'Ajoute à ma journée de préparer les documents.',
]) {
  try {
    const intent = await understandCoachMessage(emptyCoachContext(), [], text);
    console.log(JSON.stringify({ text, intent }));
    if (intent.tool !== 'create_task' || !intent.title) process.exitCode = 1;
  } catch (error) { console.log({ error: error.name }); process.exitCode = 1; }
}
