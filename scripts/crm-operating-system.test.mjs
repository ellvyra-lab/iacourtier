import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "src/lib/crm-operating-system.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const crm = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("pipelines — définit exactement 14 étapes vendeur et 16 étapes acheteur", () => {
  const seller = crm.crmPipelineStages("seller");
  const buyer = crm.crmPipelineStages("buyer");
  assert.equal(seller.length, 14);
  assert.equal(buyer.length, 16);
  assert.deepEqual(seller.map((item) => item.id), [
    "new_seller_lead", "contact_established", "evaluation_appointment", "evaluation_completed", "mandate_to_obtain",
    "mandate_signed", "listing_preparation", "ready_for_marketing", "on_market", "offer_received", "offer_accepted",
    "conditions_satisfied", "sold", "post_sale",
  ]);
  assert.deepEqual(buyer.map((item) => item.id), [
    "new_buyer_lead", "contact_established", "qualification", "prequalification", "buyer_brokerage_contract",
    "criteria_complete", "active_search", "visits", "offer_preparation", "offer_submitted", "offer_accepted",
    "conditions", "conditions_satisfied", "notary", "purchase_completed", "post_sale",
  ]);
});

test("compatibilité — convertit les anciennes étapes sans créer un deuxième pipeline", () => {
  assert.equal(crm.canonicalCrmStage("seller", "lead"), "new_seller_lead");
  assert.equal(crm.canonicalCrmStage("seller", "mandate_signed"), "mandate_signed");
  assert.equal(crm.canonicalCrmStage("buyer", "financing"), "prequalification");
  assert.equal(crm.canonicalCrmStage("buyer", "completed"), "purchase_completed");
});

test("moteur — sépare progression, complétude, santé, priorité et prochaine action", () => {
  const state = crm.computeCrmOperatingState(snapshot({
    currentStage: "prequalification",
    openTasks: [{ title: "Rappeler Karelle", dueAt: "2026-08-20T12:00:00.000Z" }],
    pendingConflicts: 1,
  }), new Date("2026-08-25T12:00:00.000Z"));
  assert.ok(state.pipelineProgress > 0 && state.pipelineProgress < 100);
  assert.ok(state.completionScore < 100);
  assert.ok(state.healthScore < 100);
  assert.ok(state.priorityScore > 20);
  assert.equal(state.nextAction, "Rappeler Karelle");
  assert.match(state.nextActionReason, /retard/);
});

test("déduplication — courriel et téléphone sont certains; nom seul demeure ambigu", () => {
  const existing = { firstName: "Karelle", lastName: "Sauvageau", email: "karelle@example.com", phone: "(514) 555-0101", address: "10 rue Test" };
  assert.equal(crm.scoreCentralClientMatch({ email: "KARELLE@example.com" }, existing).confidence, "certain");
  assert.equal(crm.scoreCentralClientMatch({ phone: "5145550101" }, existing).confidence, "certain");
  assert.equal(crm.scoreCentralClientMatch({ firstName: "Karelle", lastName: "Sauvageau" }, existing).confidence, "ambiguous");
  assert.equal(crm.scoreCentralClientMatch({ firstName: "Julie", lastName: "Roy" }, existing).confidence, "none");
});

test("migration — reste idempotente, active RLS et ne détruit aucune donnée", () => {
  const sql = readFileSync(join(root, "supabase/migrations/202608251200_crm_operating_system.sql"), "utf8");
  for (const column of ["pipeline_type", "current_stage", "stage_entered_at", "completion_score", "priority_score", "health_score"]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`));
  }
  for (const table of ["crm_events", "case_requirements", "case_dependencies", "client_relationships", "data_corrections", "opportunities"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(sql, /disable row level security|service_role|drop table|truncate table|delete from/i);
});

test("intégration — import, dossier, cockpit et journal utilisent le moteur central", () => {
  const confirm = readFileSync(join(root, "src/app/api/universal-import/confirm/route.ts"), "utf8");
  const dossier = readFileSync(join(root, "src/app/api/client-cases/[id]/route.ts"), "utf8");
  const day = readFileSync(join(root, "src/app/api/crm/day/route.ts"), "utf8");
  assert.match(confirm, /recalculateCaseOperatingState/);
  assert.match(confirm, /eventType: "document_uploaded"/);
  assert.match(dossier, /transitionCentralCaseStage/);
  assert.match(day, /priority_score/);
});

function snapshot(overrides = {}) {
  return {
    caseType: "buyer",
    currentStage: "qualification",
    clients: [{ firstName: "Karelle", lastName: "Sauvageau", email: "karelle@example.com", phone: "5145550101" }],
    hasProperty: false,
    documentCategories: [],
    openTasks: [],
    pendingConflicts: 0,
    hasFinancing: false,
    hasBuyerContract: false,
    hasBuyerCriteria: false,
    hasEvaluation: false,
    hasMandate: false,
    hasListingAssets: false,
    hasMarketingPlan: false,
    hasOffer: false,
    conditionsSatisfied: false,
    hasNotaryAppointment: false,
    transactionClosed: false,
    lastActivityAt: "2026-08-25T10:00:00.000Z",
    ...overrides,
  };
}

