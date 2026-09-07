import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const phoneSource = read("src/lib/crm-phone.ts");
const phoneCompiled = ts.transpileModule(phoneSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const phone = await import(`data:text/javascript;base64,${Buffer.from(phoneCompiled).toString("base64")}`);
const inboxSource = read("src/lib/server/ai-inbox.ts").replace('import { generateWithOpenAI } from "@/lib/openai";', 'const generateWithOpenAI = async () => { throw new Error("offline"); };');
const inboxCompiled = ts.transpileModule(inboxSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const inbox = await import(`data:text/javascript;base64,${Buffer.from(inboxCompiled).toString("base64")}`);

test("téléphone — normalise et affiche les numéros québécois sans Twilio", () => {
  assert.equal(phone.normalizePhone("514 555-1234"), "+15145551234");
  assert.equal(phone.telHref("(514) 555-1234"), "tel:+15145551234");
  assert.equal(phone.formatPhone("+1 514 555 1234"), "514 555-1234");
  assert.equal(phone.telHref("123"), null);
});

test("capture — exécute automatiquement le moteur central et protège les doublons", () => {
  const analyze = read("src/app/api/crm/inbox/analyze/route.ts");
  const confirm = read("src/app/api/crm/inbox/confirm/route.ts");
  const processor = read("src/lib/server/process-quick-capture.ts");
  assert.match(analyze, /from\("inbox_captures"\)\.insert/);
  assert.doesNotMatch(analyze, /from\("clients"\)\.insert/);
  assert.match(analyze, /shouldAutoProcess/);
  assert.match(confirm, /processQuickCapture/);
  assert.match(processor, /findCertainClient/);
  assert.match(processor, /capture\.ambiguity/);
  assert.match(processor, /ensureCentralCase/);
  assert.match(processor, /from\("tasks"\)\.upsert/);
});

test("dictée Chantal — extrait le projet acheteur, les critères, le financement et le rappel", () => {
  const now = new Date("2026-09-05T14:00:00.000Z");
  const analysis = inbox.deterministicAnalysis("Je viens de parler à Chantal Beaulieu. Elle cherche une maison à Repentigny ou L'Assomption jusqu'à 550 000 $. Elle veut trois chambres et absolument un garage. Elle n'est pas préqualifiée. Je dois la rappeler mardi.", now);
  assert.deepEqual(analysis.person, { firstName: "Chantal", lastName: "Beaulieu", email: "", phone: "" });
  assert.equal(analysis.caseType, "buyer");
  assert.deepEqual(analysis.buyerCriteria.sectors, ["Repentigny", "L'Assomption"]);
  assert.equal(analysis.buyerCriteria.budgetMax, 550000);
  assert.equal(analysis.buyerCriteria.bedroomsMin, 3);
  assert.equal(analysis.buyerCriteria.garageRequired, true);
  assert.equal(analysis.financing.prequalified, false);
  assert.ok(analysis.tasks.some((task) => task.title === "Rappeler Chantal" && task.dueOn === "2026-09-08" && task.dueAt === null));
  assert.ok(analysis.tasks.some((task) => task.title === "Obtenir la préqualification de Chantal"));
});

test("dictée Jacques — conserve le contexte propriété et crée trois actions distinctes", () => {
  const analysis = inbox.deterministicAnalysis("J'ai parlé à Jacques au sujet du 175 Hirondelles. Il faut que je lui demande son adresse courriel, que j'appelle le photographe et que je récupère le certificat de localisation.", new Date("2026-09-05T14:00:00.000Z"));
  assert.equal(analysis.person.firstName, "Jacques");
  assert.equal(analysis.property.address, "175 Hirondelles");
  assert.deepEqual(analysis.tasks.map((task) => task.title), ["Appeler le photographe", "Récupérer le certificat de localisation", "Demander l’adresse courriel de Jacques"]);
});

test("appels — journalise le départ et transforme le résultat en actions CRM", () => {
  const start = read("src/app/api/crm/calls/route.ts");
  const result = read("src/app/api/crm/calls/[id]/result/route.ts");
  assert.match(start, /call_started/);
  assert.match(start, /telHref\(phone\)/);
  assert.doesNotMatch(start, /twilio|TWILIO/i);
  assert.match(result, /call_completed/);
  assert.match(result, /from\("tasks"\)\.upsert/);
  assert.match(result, /from\("appointments"\)\.insert/);
  assert.match(result, /do_not_contact: true/);
  assert.match(result, /phone_status: "invalid"/);
});

test("interface — capture globale, page appels et bouton central sont branchés", () => {
  const capture = read("src/components/universal-quick-capture.tsx");
  assert.match(read("src/app/tableau-de-bord/layout.tsx"), /<UniversalQuickCapture floating/);
  assert.match(read("src/components/guided-home-dashboard.tsx"), /<UniversalQuickCapture/);
  assert.match(capture, /Dire à IACourtier/i);
  assert.match(capture, /bg-red-600/);
  assert.match(capture, /autoStart/);
  assert.match(capture, /Captures récentes/);
  assert.match(read("src/components/client-quick-panel.tsx"), /<CrmCallButton/);
  assert.match(read("src/components/client-360-workspace.tsx"), /<CrmCallButton/);
  assert.match(read("src/app/tableau-de-bord/appels/page.tsx"), /CallsToMakeDashboard/);
});

test("migration — étend les tâches centrales et applique les politiques propriétaire", () => {
  const migration = read("supabase/migrations/202609021100_ai_inbox_native_calls.sql");
  assert.match(migration, /alter table public\.tasks/);
  assert.match(migration, /action_type text not null/);
  assert.match(migration, /create table if not exists public\.call_activities/);
  assert.match(migration, /create table if not exists public\.inbox_captures/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /p\.user_id=auth\.uid\(\)/);
  const voiceMigration = read("supabase/migrations/202609051100_voice_quick_capture.sql");
  assert.match(voiceMigration, /add column if not exists due_on date/);
  assert.match(voiceMigration, /add column if not exists due_context text/);
});

