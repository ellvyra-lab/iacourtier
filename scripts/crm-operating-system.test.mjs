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

test("pipelines — définit exactement 19 étapes vendeur, 16 acheteur et 10 après-vente", () => {
  const seller = crm.crmPipelineStages("seller");
  const buyer = crm.crmPipelineStages("buyer");
  const afterSale = crm.crmPipelineStages("post_transaction");
  assert.equal(seller.length, 19);
  assert.equal(buyer.length, 16);
  assert.equal(afterSale.length, 10);
  assert.deepEqual(seller.map((item) => item.id), [
    "new_seller_lead", "contact_established", "qualification", "evaluation_appointment", "evaluation_completed",
    "mandate_to_obtain", "mandate_signed", "documents_to_complete", "listing_preparation", "ready_to_publish",
    "on_market", "visits_followups", "offer_received", "offer_accepted", "conditions_in_progress",
    "conditions_satisfied", "notary", "sold", "post_sale",
  ]);
  assert.deepEqual(buyer.map((item) => item.id), [
    "new_buyer_lead", "contact_established", "qualification", "prequalification", "buyer_brokerage_contract",
    "criteria_to_complete", "active_search", "visits", "offer_preparation", "offer_submitted", "offer_accepted",
    "conditions_in_progress", "conditions_satisfied", "notary", "purchase_completed", "post_sale",
  ]);
  assert.deepEqual(afterSale.map((item) => item.id), [
    "transaction_completed", "thank_you", "google_review", "followup_30_days", "followup_3_months",
    "transaction_anniversary", "mortgage_renewal", "market_report", "referral", "new_opportunity",
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
  assert.equal(state.priorityLevel, "critical");
});

test("vendeur 145 Hirondelles — le mandat signé déclenche les documents puis les actifs de mise en marché", () => {
  const state = crm.evaluateCaseState(snapshot({
    caseType: "seller", currentStage: "mandate_signed", hasContactEstablished: true, hasQualification: true,
    hasProperty: true, hasEvaluationAppointment: true, hasEvaluation: true, hasMandate: true,
    hasEssentialDocuments: false, hasListingAssets: false, pipelineMode: "assisted",
  }));
  assert.equal(state.currentStage, "mandate_signed");
  assert.equal(state.suggestedStage, "documents_to_complete");
  assert.ok(state.alerts.some((item) => item.code === "listing_assets_missing"));
  assert.match(state.nextAction, /documents/i);
});

test("acheteuse Karelle — préqualification présente, contrat manquant et aucune fiche parallèle", () => {
  const state = crm.evaluateCaseState(snapshot({
    currentStage: "qualification", hasContactEstablished: true, hasQualification: true, hasFinancing: true,
    hasBuyerContract: false, hasBuyerCriteria: false, pipelineMode: "assisted",
  }));
  assert.equal(state.suggestedStage, "prequalification");
  assert.ok(state.alerts.some((item) => item.code === "buyer_contract_missing"));
  assert.ok(state.missingItems.includes("Contrat de courtage achat") === false);
});

test("transaction — une condition à 48 h devient prioritaire et suggère conditions en cours", () => {
  const state = crm.evaluateCaseState(snapshot({
    currentStage: "offer_accepted", hasQualification: true, hasFinancing: true, hasOffer: true,
    hasOfferAccepted: true, conditions: [{ title: "Financement", status: "pending", dueAt: "2026-08-27T12:00:00.000Z" }],
  }), new Date("2026-08-25T12:00:00.000Z"));
  assert.equal(state.suggestedStage, "conditions_in_progress");
  assert.equal(state.nextAction, "Réaliser la condition : Financement");
  assert.ok(state.alerts.some((item) => item.code.startsWith("condition:")));
});

test("mode automatique — avance sur preuve forte, mais ne régresse jamais sans action humaine", () => {
  const advanced = crm.evaluateCaseState(snapshot({ currentStage: "prequalification", pipelineMode: "automatic", hasFinancing: true, hasBuyerContract: true, hasBuyerCriteria: true }));
  assert.equal(advanced.currentStage, "active_search");
  const noRegression = crm.evaluateCaseState(snapshot({ currentStage: "conditions_satisfied", pipelineMode: "automatic" }));
  assert.equal(noRegression.currentStage, "conditions_satisfied");
});

test("déduplication — courriel et téléphone sont certains; nom seul demeure ambigu", () => {
  const existing = { firstName: "Karelle", lastName: "Sauvageau", email: "karelle@example.com", phone: "(514) 555-0101", address: "10 rue Test" };
  assert.equal(crm.scoreCentralClientMatch({ email: "KARELLE@example.com" }, existing).confidence, "certain");
  assert.equal(crm.scoreCentralClientMatch({ phone: "5145550101" }, existing).confidence, "certain");
  assert.equal(crm.scoreCentralClientMatch({ firstName: "Karelle", lastName: "Sauvageau" }, existing).confidence, "ambiguous");
  assert.equal(crm.scoreCentralClientMatch({ firstName: "Julie", lastName: "Roy" }, existing).confidence, "none");
});

test("migration — reste idempotente, active RLS et ne détruit aucune donnée", () => {
  const foundation = readFileSync(join(root, "supabase/migrations/202608251200_crm_operating_system.sql"), "utf8");
  const sql = readFileSync(join(root, "supabase/migrations/202608261100_intelligent_pipeline_engine.sql"), "utf8");
  for (const column of ["pipeline_mode", "suggested_stage", "next_best_action", "priority_level", "alerts", "missing_items"]) assert.match(sql, new RegExp(`add column if not exists ${column}`));
  for (const table of ["crm_events", "case_requirements", "case_dependencies", "client_relationships", "data_corrections", "opportunities"]) assert.match(foundation, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(sql, /create table if not exists public\.case_conditions/);
  assert.match(sql, /alter table public\.case_conditions enable row level security/);
  assert.doesNotMatch(sql, /disable row level security|service_role|drop table|truncate table|delete from/i);
});

test("intégration — import, dossier, cockpit et journal utilisent le moteur central", () => {
  const confirm = readFileSync(join(root, "src/app/api/universal-import/confirm/route.ts"), "utf8");
  const dossier = readFileSync(join(root, "src/app/api/client-cases/[id]/route.ts"), "utf8");
  const day = readFileSync(join(root, "src/app/api/crm/day/route.ts"), "utf8");
  const pipeline = readFileSync(join(root, "src/app/tableau-de-bord/pipeline/page.tsx"), "utf8");
  assert.match(confirm, /recalculateCaseOperatingState/);
  assert.match(confirm, /eventType: "document_uploaded"/);
  assert.match(dossier, /transitionCentralCaseStage/);
  assert.match(day, /priority_score/);
  assert.match(pipeline, /CentralPipelineDashboard/);
  assert.doesNotMatch(pipeline, /buildPipelineDashboardData|localStorage/);
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

