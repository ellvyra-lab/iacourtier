import assert from "node:assert/strict";
import test from "node:test";

import {
  inferDocumentType,
  mergeUniversalAnalyses,
  normalizeUniversalPartial,
} from "../src/lib/universal-import.ts";

function source(name, type, sourceType = "image") {
  return { name, type, sourceType, confidence: 0.95 };
}

test("A — contrat de courtage vendeur PDF -> mandat signé", () => {
  const name = "175 HIrondelles CCVE92475.pdf";
  assert.equal(inferDocumentType(name), "Contrat de courtage vente");
  const analysis = normalizeUniversalPartial({ projectType: "seller", documents: [source(name, "Contrat de courtage vente", "pdf")], people: [{ firstName: "Sonia", lastName: "Test", roles: ["seller"], sourceName: name, confidence: 0.95 }] }, []);
  assert.equal(analysis.sellerStage, "mandate_signed");
});

test("B — photo d’un document -> source image et classement conservé", () => {
  const name = "photo-certificat-localisation.jpg";
  const analysis = normalizeUniversalPartial({ projectType: "seller", documents: [source(name, "Certificat de localisation")] }, []);
  assert.equal(analysis.sources[0].sourceType, "image");
  assert.equal(analysis.sources[0].type, "Certificat de localisation");
});

test("C — capture acheteur demandant une visite -> étape visites", () => {
  const analysis = normalizeUniversalPartial({ projectType: "buyer", intentions: ["demande une visite"], documents: [source("capture-acheteur.png", "Conversation client", "screenshot")], people: [{ firstName: "Alex", lastName: "Roy", roles: ["buyer"], sourceName: "capture-acheteur.png" }] }, []);
  assert.equal(analysis.buyerStage, "visits");
});

test("D — capture vendeur -> vrai projet vendeur sans créer d’acheteur", () => {
  const analysis = normalizeUniversalPartial({ projectType: "seller", intentions: ["veut vendre"], documents: [source("texto-vendeur.png", "Conversation client", "screenshot")], people: [{ firstName: "Marie", lastName: "Fortin", roles: ["seller"], sourceName: "texto-vendeur.png" }] }, []);
  assert.equal(analysis.projectType, "seller");
  assert.equal(analysis.buyerStage, null);
});

test("E — promesse d’achat -> offre, jamais première étape", () => {
  const analysis = normalizeUniversalPartial({ projectType: "buy_sell", documents: [source("PA-123.pdf", "Promesse d’achat", "pdf")], people: [{ firstName: "Camille", lastName: "Dubé", roles: ["buyer", "seller"], sourceName: "PA-123.pdf" }] }, []);
  assert.equal(analysis.buyerStage, "offer");
  assert.equal(analysis.sellerStage, "offer_received");
});

test("F — plusieurs images fusionnent la même personne et ses deux rôles", () => {
  const first = normalizeUniversalPartial({ projectType: "buyer", documents: [source("capture-1.png", "Conversation client", "screenshot")], people: [{ firstName: "Jo", lastName: "Bouchard", phone: "514 555-1212", roles: ["buyer"], sourceName: "capture-1.png" }] }, []);
  const second = normalizeUniversalPartial({ projectType: "seller", documents: [source("capture-2.png", "Conversation client", "screenshot")], people: [{ firstName: "Jo", lastName: "Bouchard", phone: "(514) 555-1212", roles: ["seller"], sourceName: "capture-2.png" }] }, []);
  const merged = mergeUniversalAnalyses([first, second]);
  assert.equal(merged.people.length, 1);
  assert.deepEqual(new Set(merged.people[0].roles), new Set(["buyer", "seller"]));
  assert.equal(merged.projectType, "buy_sell");
});

test("G — préqualification -> cliente acheteuse, financement et courtier hypothécaire séparé", () => {
  const name = "prequalification-karelle-sauvageau.pdf";
  const analysis = normalizeUniversalPartial({
    projectType: "buyer",
    documents: [source(name, "Préapprobation", "pdf")],
    people: [{ firstName: "Karelle", lastName: "Sauvageau", roles: ["buyer"], sourceName: name, confidence: 0.98 }],
    partners: [{ firstName: "Mickael", lastName: "Bisson", partnerType: "mortgage_broker", sourceName: name, confidence: 0.97 }],
    buyerCriteria: {
      budget: "375 000 $", downPayment: "35 000 $", mortgageAmount: "353 600 $", preapprovalStatus: "approved",
      propertyType: "maison", occupancyType: "propriétaire occupant",
    },
  }, []);

  assert.equal(analysis.projectType, "buyer");
  assert.equal(analysis.buyerStage, "financing");
  assert.equal(analysis.people.length, 1);
  assert.equal(`${analysis.people[0].firstName} ${analysis.people[0].lastName}`, "Karelle Sauvageau");
  assert.equal(analysis.buyerCriteria.budget, "375 000 $");
  assert.equal(analysis.buyerCriteria.downPayment, "35 000 $");
  assert.equal(analysis.buyerCriteria.mortgageAmount, "353 600 $");
  assert.equal(analysis.buyerCriteria.preapprovalStatus, "approved");
  assert.equal(analysis.buyerCriteria.propertyType, "maison");
  assert.equal(analysis.buyerCriteria.occupancyType, "propriétaire occupant");
  assert.equal(analysis.partners.length, 1);
  assert.equal(`${analysis.partners[0].firstName} ${analysis.partners[0].lastName}`, "Mickael Bisson");
  assert.equal(analysis.partners[0].partnerType, "mortgage_broker");
});
