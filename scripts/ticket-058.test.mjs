import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ticket 058 — les documents enrichissent une personne centrale sans confondre son adresse et la propriété", () => {
  const universal = read("src/lib/universal-import.ts");
  const confirm = read("src/app/api/universal-import/confirm/route.ts");
  assert.match(universal, /personalAddress: UniversalPersonalAddress/);
  assert.match(universal, /birthDate: string/);
  assert.match(universal, /knownCities: Record<string, string> = \{ J5T: "Lavaltrie" \}/);
  assert.match(confirm, /person\.personalAddress\.city/);
  assert.match(confirm, /person\.personalAddress\.postalCode/);
  assert.doesNotMatch(confirm, /seller_contacts/);
});

test("ticket 058 — le pipeline est transactionnel, déplaçable et optimiste", () => {
  const pipeline = read("src/components/central-pipeline-dashboard.tsx");
  assert.match(pipeline, /dataTransfer\.setData\("text\/plain", item\.id\)/);
  assert.match(pipeline, /onDrop=\{/);
  assert.match(pipeline, /setPayload\(\(current\)/);
  assert.match(pipeline, /setPayload\(previous\)/);
});

test("ticket 058 — le dossier central expose le cockpit et les mises à jour optimistes", () => {
  const workspace = read("src/components/client-case-workspace.tsx");
  assert.match(workspace, /Cockpit du dossier/);
  assert.match(workspace, /Personnes et rôles/);
  assert.match(workspace, /Prochaine échéance/);
  assert.match(workspace, /Alertes actives/);
  assert.match(workspace, /setData\(previous\)/);
});

test("ticket 058 — le marketing immobilier exclut les données administratives et couvre les événements clés", () => {
  const marketing = read("src/lib/property-marketing.ts");
  const types = read("src/lib/seller-listings.ts");
  assert.match(marketing, /ADMINISTRATIVE_FACTS/);
  for (const key of ["acquisitionDate", "acquisitionPrice", "mortgage", "owners", "notary", "sellerDeclaration"]) assert.match(marketing, new RegExp(key));
  for (const key of ["priceReduction", "acceptedOffer", "sold", "backOnMarket", "featured"]) {
    assert.match(marketing, new RegExp(key));
    assert.match(types, new RegExp(key));
  }
  assert.match(marketing, /BROUILLON|validationPoints|publicitaire/);
});

test("ticket 058 — Centris reste protégé derrière une préparation sans transmission non autorisée", () => {
  const connector = read("src/lib/centris/connector.ts");
  const api = read("src/app/api/seller-listings/[id]/centris/route.ts");
  const ui = read("src/components/centris-preparation-workspace.tsx");
  assert.match(connector, /connected: false/);
  assert.match(connector, /connexion Centris autorisée/);
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /body\.action === "transmit"/);
  assert.match(ui, /disabled title=\{data\.transmissionMessage\}/);
  assert.doesNotMatch(connector + api + ui, /password|mot de passe|SERVICE_ROLE_KEY/i);
});

test("ticket 058 — Radar conserve un accès clair à l’adresse et Google Maps", () => {
  const radar = read("src/components/prospection-radar.tsx");
  assert.match(radar, /📍 Voir l’adresse/);
  assert.match(radar, /Google \/ Maps/);
});
