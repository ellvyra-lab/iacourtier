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

test("téléphone — normalise et affiche les numéros québécois sans Twilio", () => {
  assert.equal(phone.normalizePhone("514 555-1234"), "+15145551234");
  assert.equal(phone.telHref("(514) 555-1234"), "tel:+15145551234");
  assert.equal(phone.formatPhone("+1 514 555 1234"), "514 555-1234");
  assert.equal(phone.telHref("123"), null);
});

test("capture — analyse avant confirmation et protège les doublons", () => {
  const analyze = read("src/app/api/crm/inbox/analyze/route.ts");
  const confirm = read("src/app/api/crm/inbox/confirm/route.ts");
  assert.match(analyze, /from\("inbox_captures"\)\.insert/);
  assert.doesNotMatch(analyze, /from\("clients"\)\.insert/);
  assert.match(confirm, /findCertainClient/);
  assert.match(confirm, /ensureCentralCase/);
  assert.match(confirm, /from\("tasks"\)\.upsert/);
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
  assert.match(read("src/app/tableau-de-bord/layout.tsx"), /<UniversalQuickCapture floating/);
  assert.match(read("src/components/guided-home-dashboard.tsx"), /<UniversalQuickCapture/);
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
});

