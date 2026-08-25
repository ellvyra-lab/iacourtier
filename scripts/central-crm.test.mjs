import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("migration — crée le dossier maître, les objets partagés et quatre policies RLS par table", () => {
  const sql = read("supabase/migrations/202608241900_central_crm_cases.sql");
  for (const table of ["client_cases", "client_case_clients", "client_properties", "documents", "tasks", "automations", "communications", "appointments", "activity_events"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /alter table public\.buyer_cases add column if not exists client_case_id/);
  assert.match(sql, /alter table public\.seller_listings add column if not exists client_case_id/);
  assert.match(sql, /enable row level security/);
  for (const policy of ["owner_select", "owner_insert", "owner_update", "owner_delete"]) assert.match(sql, new RegExp(`create policy "${policy}"`));
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.clients/i);
  const hardening = read("supabase/migrations/202608242030_central_crm_rls_hardening.sql");
  assert.match(hardening, /exists \(select 1 from public\.client_cases/);
  assert.match(hardening, /exists \(select 1 from public\.clients/);
  assert.match(hardening, /exists \(select 1 from public\.properties/);
});

test("import universel — respecte personne → dossier → tâches → documents → automatisations", () => {
  const route = read("src/app/api/universal-import/confirm/route.ts");
  const person = route.indexOf("const contactIds");
  const dossier = route.indexOf("const centralCaseId = await ensureCentralCase");
  const tasks = route.indexOf("ensureSellerTasks", dossier);
  const documents = route.indexOf("for (const item of stored)", tasks);
  const automations = route.indexOf("ensureSellerAutomations", documents);
  assert.ok(person >= 0 && person < dossier && dossier < tasks && tasks < documents && documents < automations);
  assert.match(route, /primaryHref = `\/tableau-de-bord\/dossiers\/\$\{centralCaseId\}`/);
});

test("parcours acheteur et vendeur — créent le dossier central avant le workflow", () => {
  for (const path of ["src/app/api/buyer-cases/route.ts", "src/app/api/seller-listings/route.ts"]) {
    const route = read(path);
    assert.ok(route.indexOf("const centralCaseId = await ensureCentralCase") < route.indexOf("_TASK_TEMPLATES.map"));
    assert.match(route, /primaryHref: `\/tableau-de-bord\/dossiers\/\$\{centralCaseId\}`/);
  }
});

test("ancien seller_contacts — aucune requête applicative ne subsiste", () => {
  const source = collect(join(root, "src")).filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(source, /\.from\(["']seller_contacts["']\)/);
  assert.doesNotMatch(source, /\.from\(["']buyer_contacts["']\)/);
});

test("navigation — Client 360, dossier unifié, Documents et Automatisations utilisent le CRM", () => {
  assert.match(read("src/components/clients-cases-dashboard.tsx"), /<ClientQuickPanel/);
  assert.match(read("src/components/client-quick-panel.tsx"), /\/tableau-de-bord\/clients\/\$\{current\.id\}/);
  assert.match(read("src/components/client-360-workspace.tsx"), /\/tableau-de-bord\/dossiers\/\$\{item\.id\}/);
  assert.match(read("src/components/client-case-workspace.tsx"), /Prochaine action/);
  assert.match(read("src/app/tableau-de-bord/automatisations/page.tsx"), /CentralResourcesDashboard/);
  assert.match(read("src/app/tableau-de-bord/telechargements/page.tsx"), /CentralResourcesDashboard/);
});

test("fusion continue — schéma versionné, multi-adresses, provenance, conflits et documents sensibles", () => {
  const sql = read("supabase/migrations/202608242300_continuous_document_merge.sql");
  for (const table of ["client_contact_methods", "client_addresses", "crm_facts", "data_conflicts", "document_access_logs"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /add column if not exists is_sensitive boolean not null default false/);
  assert.match(sql, /address_type in \('personal', 'mailing', 'sold_property', 'purchased_property', 'rental_property', 'former', 'other'\)/);
  assert.match(sql, /exists \(select 1 from public\.client_cases/);
  assert.match(sql, /exists \(select 1 from public\.documents/);
  assert.doesNotMatch(sql, /disable row level security|service_role|drop table|truncate table/i);
});

test("enrichissement documentaire — réutilise le dossier et exige une décision pour chaque conflit", () => {
  const analyze = read("src/app/api/universal-import/analyze/route.ts");
  const confirm = read("src/app/api/universal-import/confirm/route.ts");
  const workspace = read("src/components/client-case-workspace.tsx");
  assert.match(analyze, /loadContinuousMergeContext/);
  assert.match(analyze, /buildContinuousMergePreview/);
  assert.match(confirm, /centralCaseId: existingMergeContext\?\.id \|\| null/);
  assert.match(confirm, /applyContinuousMerge/);
  assert.match(confirm, /mergeDecisions/);
  assert.match(confirm, /isSensitive = source\?\.type === "Pièce d’identité"/);
  assert.match(workspace, /UniversalDocumentImporter caseId=\{caseId\}/);
  assert.match(workspace, /Adresses des clients/);
  assert.match(workspace, /Informations et provenance/);
  assert.match(workspace, /Conflits de données/);
});

function collect(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collect(path) : [path];
  });
}
