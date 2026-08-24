import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import {
  buildClientImportPlan,
  mergeClientData,
  normalizeExistingClient,
} from "../src/lib/client-list-import.ts";
import { parseClientSpreadsheet } from "../src/lib/server/client-spreadsheet.ts";

const headers = ["Prénom", "Nom", "Mobile", "Email", "Adresse", "City", "Postal Code", "Date de naissance", "Date d’achat", "Date de renouvellement hypothécaire", "Type de client", "Source", "Notes", "Tags"];

function sourceRows(count = 2_188) {
  return Array.from({ length: count }, (_, index) => {
    const id = index === 137 ? 137 : index + 1;
    return [
      index % 37 === 0 ? "Élodie Anne" : `Client${id}`,
      index % 53 === 0 ? "Roy-Leblanc" : `Test${id}`,
      `514555${String(id).padStart(4, "0")}`,
      `CONTACT${id}@EXAMPLE.TEST`,
      `${id} rue de l’Érable`,
      index % 2 ? "Montréal" : "Québec",
      "H2X1Y4",
      index % 3 ? "" : "1985-04-12",
      index % 5 ? "" : "2020-06-15",
      index % 7 ? "" : "2027-01-15",
      index % 4 === 0 ? "Acheteur" : index % 4 === 1 ? "Vendeur" : index % 4 === 2 ? "Ancien client" : "Investisseur",
      "Google Contacts",
      index === 25 ? "Nom composé et accent conservés" : "",
      index % 11 === 0 ? "Prioritaire;VIP" : "",
    ];
  });
}

function workbookBuffer(rows, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Contacts");
  return XLSX.write(workbook, { type: "buffer", bookType });
}

test("CSV — reconnaît les variantes FR/EN, accents et plus de 2 000 contacts", () => {
  const csv = `\uFEFF${[headers, ...sourceRows()].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
  const table = parseClientSpreadsheet(Buffer.from(csv, "utf8"));
  const plan = buildClientImportPlan(table, []);
  assert.equal(plan.summary.rowsDetected, 2_188);
  assert.equal(plan.summary.certainDuplicates, 1);
  assert.equal(plan.summary.newClients, 2_186);
  assert.equal(plan.summary.ambiguousDuplicates, 1);
  assert.ok(plan.mappings.some((mapping) => mapping.source === "Mobile" && mapping.field === "phone"));
  assert.ok(plan.mappings.some((mapping) => mapping.source === "City" && mapping.field === "city"));
  assert.equal(plan.groups[0].incomingData.postalCode, "H2X 1Y4");
  assert.match(plan.groups[0].incomingData.phone, /^\+1 514 555 /);
  assert.equal(plan.groups[0].incomingData.email, "contact1@example.test");
});

test("XLSX — lit les 2 188 lignes et les colonnes absentes sans bloquer", () => {
  const table = parseClientSpreadsheet(workbookBuffer(sourceRows()));
  const reduced = { headers: table.headers.filter((header) => header !== "Date de naissance"), rows: table.rows.map((row) => row.filter((_, index) => headers[index] !== "Date de naissance")) };
  const plan = buildClientImportPlan(reduced, []);
  assert.equal(plan.summary.rowsDetected, 2_188);
  assert.equal(plan.summary.incompleteLines, 2_188);
  assert.ok(plan.tagCounts["Anniversaire manquant"] > 2_000);
});

test("XLS — l’ancien format Excel est supporté", () => {
  const table = parseClientSpreadsheet(workbookBuffer(sourceRows(12), "biff8"));
  assert.equal(buildClientImportPlan(table, []).summary.rowsDetected, 12);
});

test("Doublon existant — complète les champs manquants et conserve les conflits CRM", () => {
  const existing = normalizeExistingClient({ id: "00000000-0000-0000-0000-000000000001", first_name: "Julie", last_name: "Roy", phone: "5145551212", mailing_address: "10 rue Principale", email: null, roles: ["seller"], tags: ["Vendeur"], client_status: "active" });
  const table = { headers, rows: [["Julie", "Roy", "", "julie@example.test", "10 rue Principale", "Laval", "H7A1A1", "", "", "", "Acheteur", "Référence", "Nouveau courriel", "VIP"]] };
  const plan = buildClientImportPlan(table, [existing]);
  assert.equal(plan.summary.existingClients, 1);
  assert.equal(plan.summary.newClients, 0);
  const merged = mergeClientData(existing, plan.groups[0].incomingData);
  assert.equal(merged.data.phone, "+1 514 555 1212");
  assert.equal(merged.data.email, "julie@example.test");
  assert.deepEqual(new Set(merged.data.roles), new Set(["seller", "buyer"]));
});

test("Import répété — une liste déjà présente ne recrée pas les contacts", () => {
  const rows = sourceRows(20);
  const table = parseClientSpreadsheet(workbookBuffer(rows));
  const first = buildClientImportPlan(table, []);
  const existing = first.groups.map((group, index) => normalizeExistingClient({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    first_name: group.incomingData.firstName,
    last_name: group.incomingData.lastName,
    email: group.incomingData.email,
    phone: group.incomingData.phone,
    mailing_address: group.incomingData.mailingAddress,
    roles: group.incomingData.roles,
    tags: group.incomingData.tags,
  }));
  const repeated = buildClientImportPlan(table, existing);
  assert.equal(repeated.summary.newClients, 0);
  assert.equal(repeated.summary.existingClients, 20);
});

test("Nom seul — classe la correspondance comme ambiguë, sans fusion silencieuse", () => {
  const existing = normalizeExistingClient({ id: "00000000-0000-0000-0000-000000000002", first_name: "Jean Pierre", last_name: "Dubé", email: "ancien@example.test" });
  const table = { headers: ["Full Name", "Email"], rows: [["Jean Pierre Dubé", "nouveau@example.test"]] };
  const plan = buildClientImportPlan(table, [existing]);
  assert.equal(plan.summary.ambiguousDuplicates, 1);
  assert.equal(plan.summary.newClients, 0);
});
