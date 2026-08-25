import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const clientApi = read("src/app/api/clients/[id]/route.ts");
const quickPanel = read("src/components/client-quick-panel.tsx");
const seller = read("src/components/seller-listing-workspace.tsx");
const buyer = read("src/components/buyer-case-workspace.tsx");
const centralCase = read("src/components/client-case-workspace.tsx");
const client360 = read("src/components/client-360-workspace.tsx");
const propertyApi = read("src/app/api/properties/[id]/route.ts");

test("la modification rapide écrit dans le client central avec portée propriétaire", () => {
  assert.match(clientApi, /from\("clients"\)\.update/);
  assert.match(clientApi, /\.eq\("id", id\)\.eq\("user_id", user\.id\)/);
  assert.match(clientApi, /from\("client_contact_methods"\)/);
  assert.match(clientApi, /from\("client_addresses"\)/);
  assert.match(clientApi, /property_id: null/);
  assert.doesNotMatch(clientApi, /from\("properties"\)\.update/);
});

test("chaque co-vendeur possède un panneau indépendant et les manquants sont actionnables", () => {
  assert.match(seller, /data\.parties\.map/);
  assert.match(seller, /<ClientQuickPanel key=\{party\.id\}/);
  assert.match(quickPanel, /Courriel à compléter/);
  assert.match(quickPanel, /Téléphone à compléter/);
  assert.match(quickPanel, /show\("profile", "email"\)/);
  assert.match(quickPanel, /show\("profile", "phone"\)/);
});

test("le même panneau central est utilisé par les parcours acheteur, vendeur et dossier", () => {
  assert.match(buyer, /<ClientQuickPanel/);
  assert.match(seller, /<ClientQuickPanel/);
  assert.match(centralCase, /<ClientQuickPanel/);
  assert.match(client360, /<ClientQuickPanel/);
});

test("la navigation contextuelle relie client, dossier, propriété, documents et pipeline", () => {
  assert.match(quickPanel, /fromLabel/);
  assert.match(quickPanel, /ajouter-source/);
  assert.match(centralCase, /id="pipeline"/);
  assert.match(centralCase, /<PropertyQuickCard/);
  assert.match(client360, /<PropertyQuickCard/);
});

test("la propriété a sa propre API sécurisée et ne partage pas l'écriture client", () => {
  assert.match(propertyApi, /from\("properties"\)\.update/);
  assert.match(propertyApi, /\.eq\("id", id\)\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(propertyApi, /from\("clients"\)\.update/);
});

