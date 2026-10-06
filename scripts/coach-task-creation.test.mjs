import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loader, database } from './helpers/connected-test-harness.mjs';
const load = loader({
  '@/app/api/clients/[id]/route': {}, '@/app/api/properties/[id]/route': {},
  '@/lib/server/ai-inbox': {}, '@/lib/server/process-quick-capture': {},
  '@/lib/server/crm-operating-system': { recalculateCaseOperatingState: async () => ({ missingItems: [] }) },
});
const { coachHandlers, CoachChoice, coachDate } = load('@/lib/server/coach-tools');
const { emptyCoachContext } = load('@/lib/coach/conversation');
function scope(clients = []) { return { db: database({ clients }), userId: 'owner', conversationId: randomUUID(), messageId: randomUUID(), text: '', context: emptyCoachContext() }; }
test('client unique sans dossier : tâche centrale persistée dans le contrat, sans doublon', async () => {
  const s = scope([{ id: 'martin', user_id: 'owner', first_name: 'Martin', last_name: 'Roy' }]);
  const intent = { tool: 'create_task', query: 'Martin', title: 'Contacter Martin — certificat de localisation et notaire', dateExpression: "aujourd’hui" };
  const result = await coachHandlers.create_task(s, intent);
  assert.equal(result.changed, true); assert.equal(result.cards[0].kind, 'task');
  assert.equal(s.db.tables.tasks[0].client_id, 'martin'); assert.equal(s.db.tables.tasks[0].case_id, null);
  assert.equal(s.db.tables.tasks[0].user_id, 'owner');
  await coachHandlers.create_task(s, intent); assert.equal(s.db.tables.tasks.length, 1);
});
test('plusieurs Martin : choix, sans écriture ni choix arbitraire', async () => {
  const s = scope(['Roy', 'Blanc'].map(last_name => ({ id: randomUUID(), user_id: 'owner', first_name: 'Martin', last_name })));
  await assert.rejects(coachHandlers.create_task(s, { tool: 'create_task', query: 'Martin', title: 'Appeler Martin' }), e => e instanceof CoachChoice && e.options.length === 2);
  assert.equal(s.db.tables.tasks, undefined);
});
test('client absent : confirmation obligatoire puis tâche personnelle', async () => {
  const s = scope(); const intent = { tool: 'create_task', query: 'Martin', title: 'Appeler Martin' };
  await assert.rejects(coachHandlers.create_task(s, intent), e => e instanceof CoachChoice && e.kind === 'task_without_client');
  s.selected = { kind: 'task_without_client', id: randomUUID() };
  await coachHandlers.create_task(s, intent); assert.equal(s.db.tables.tasks[0].client_id, null);
});
test('tâche personnelle indépendante du client précédent et de ses dossiers', async () => {
  const s = scope(); s.context.current_client_id = 'previous'; s.context.current_case_id = 'previous-case';
  await coachHandlers.create_task(s, { tool: 'create_task', title: 'Préparer les documents', dateExpression: "aujourd'hui", values: { personal: true } });
  assert.equal(s.db.tables.tasks[0].case_id, null); assert.equal(s.db.tables.tasks[0].client_id, null);
});
test('dates locales et expressions naturelles', () => {
  const now = new Date('2026-10-07T02:00:00Z');
  assert.equal(coachDate("aujourd'hui", now), '2026-10-06');
  assert.equal(coachDate('demain', now), '2026-10-07');
  assert.equal(coachDate('vendredi', now), '2026-10-09');
  assert.equal(coachDate('lundi prochain', now), '2026-10-12');
  assert.equal(coachDate('cet après-midi', now), '2026-10-06');
  assert.equal(coachDate('cette semaine', now), '2026-10-09');
  assert.equal(coachDate("aujourd'hui", now, 'Europe/Paris'), '2026-10-07');
});
