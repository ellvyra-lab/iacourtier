import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("Radar — prépare les recherches publiques sans présumer l’identité", () => {
  const component = read("src/components/prospection-radar.tsx");
  assert.match(component, /site:facebook\.com/);
  assert.match(component, /Google \/ Maps/);
  assert.match(component, /Web \/ IA/);
  assert.match(component, /Correspondance possible — non confirmée/);
  assert.match(component, /C’est la bonne personne — enregistrer dans le CRM/);
  assert.match(component, /Passer au prochain prospect/);
});

test("Radar — enregistre les coordonnées dans le CRM central", () => {
  const route = read("src/app/api/radar/reachability/route.ts");
  assert.match(route, /from\("clients"\)/);
  assert.match(route, /from\("client_contact_methods"\)/);
  assert.match(route, /from\("client_public_links"\)/);
  assert.match(route, /ensureCentralCase/);
  assert.match(route, /identityConfirmed/);
  assert.match(route, /manual_public_search/);
  assert.doesNotMatch(route, /SERVICE_ROLE|service_role/);
});

test("Radar — versionne la liaison, la provenance et les politiques RLS", () => {
  const migration = read("supabase/migrations/202609151200_radar_reachability.sql");
  assert.match(migration, /create table if not exists public\.radar_crm_links/);
  assert.match(migration, /create table if not exists public\.radar_contact_research_events/);
  assert.match(migration, /create table if not exists public\.client_public_links/);
  assert.match(migration, /alter table public\.radar_crm_links enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /c\.user_id = auth\.uid\(\)/);
  assert.match(migration, /d\.user_id = auth\.uid\(\)/);
});

