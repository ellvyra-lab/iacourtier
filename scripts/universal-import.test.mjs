import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOMATIC_INGESTION_PIPELINE,
  automaticIngestionBlockers,
  automaticMergeAction,
  automaticReviewItems,
  buildAutomaticPersonDecisions,
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

test("H — une adresse de pièce d’identité reste une donnée personne, jamais une propriété", () => {
  const name = "permis-jean-tremblay.jpg";
  const analysis = normalizeUniversalPartial({
    projectType: "seller",
    documents: [source(name, "Pièce d’identité")],
    people: [{ firstName: "Jean", lastName: "Tremblay", mailingAddress: "125 rue ABC", roles: ["seller"], sourceName: name, confidence: 0.98 }],
    property: { address: "", city: "", postalCode: "", propertyType: "", lotNumber: "" },
  }, []);
  assert.equal(analysis.people[0].mailingAddress, "125 rue ABC");
  assert.equal(analysis.property.address, "");
  const addressFact = analysis.facts.find((fact) => fact.field === "mailingAddress");
  assert.equal(addressFact?.entity, "person");
  assert.equal(addressFact?.value, "125 rue ABC");
});

test("I — le mode automatique crée deux vendeurs distincts sans demander une confirmation inutile", () => {
  const ccv = normalizeUniversalPartial({
    projectType: "seller",
    documents: [source("CCV.pdf", "Contrat de courtage vente", "pdf")],
    people: [
      { id: "seller-a", firstName: "Julie", lastName: "Roy", roles: ["seller"], sourceName: "CCV.pdf", confidence: 0.98 },
      { id: "seller-b", firstName: "Marc", lastName: "Roy", roles: ["seller"], sourceName: "CCV.pdf", confidence: 0.98 },
    ],
    property: { address: "145 rue des Hirondelles", city: "Repentigny", propertyType: "Maison" },
  }, []);
  const certificate = normalizeUniversalPartial({
    projectType: "seller",
    documents: [source("certificat.pdf", "Certificat de localisation", "pdf")],
    property: { address: "145 rue des Hirondelles", city: "Repentigny", lotNumber: "1 234 567" },
  }, []);
  const identityA = normalizeUniversalPartial({
    projectType: "seller",
    documents: [source("permis-julie.jpg", "Pièce d’identité")],
    people: [{ id: "seller-a", firstName: "Julie", lastName: "Roy", mailingAddress: "125 rue A", roles: ["seller"], sourceName: "permis-julie.jpg", confidence: 0.99 }],
  }, []);
  const identityB = normalizeUniversalPartial({
    projectType: "seller",
    documents: [source("permis-marc.jpg", "Pièce d’identité")],
    people: [{ id: "seller-b", firstName: "Marc", lastName: "Roy", mailingAddress: "456 rue B", roles: ["seller"], sourceName: "permis-marc.jpg", confidence: 0.99 }],
  }, []);
  const deed = normalizeUniversalPartial({ projectType: "seller", documents: [source("acte.pdf", "Acte de vente", "pdf")], property: { address: "145 rue des Hirondelles", city: "Repentigny" } }, []);
  const analysis = mergeUniversalAnalyses([ccv, identityA, identityB, certificate, deed]);
  const plan = buildAutomaticPersonDecisions(analysis);

  assert.equal(analysis.people.length, 2);
  assert.equal(analysis.property.address, "145 rue des Hirondelles");
  assert.deepEqual(new Set(analysis.people.map((person) => person.mailingAddress)), new Set(["125 rue A", "456 rue B"]));
  assert.equal(plan.decisions.filter((decision) => decision.action === "create").length, 2);
  assert.deepEqual(plan.ambiguousPersonIds, []);
  assert.deepEqual(automaticIngestionBlockers(analysis), []);
  assert.deepEqual(AUTOMATIC_INGESTION_PIPELINE, ["ingest", "extract", "resolve_entities", "merge", "classify", "update_workflow"]);
});

test("J — seule une identité réellement ambiguë interrompt le parcours automatique", () => {
  const analysis = normalizeUniversalPartial({
    projectType: "buyer",
    documents: [source("prequalification.pdf", "Préapprobation", "pdf")],
    people: [{ id: "karelle", firstName: "Karelle", lastName: "Sauvageau", roles: ["buyer"], sourceName: "prequalification.pdf", confidence: 0.98 }],
  }, []);
  const personId = analysis.people[0].id;
  analysis.duplicates = [{ personId, matches: [
    { id: "one", name: "Karelle Sauvageau", email: "", phone: "", roles: ["buyer"], matchedOn: ["nom"] },
    { id: "two", name: "Karelle Sauvageau", email: "", phone: "", roles: ["prospect"], matchedOn: ["nom"] },
  ] }];
  const plan = buildAutomaticPersonDecisions(analysis);
  assert.deepEqual(plan.ambiguousPersonIds, [personId]);
  assert.match(automaticIngestionBlockers(analysis).join(" "), /plusieurs fiches/);
});

test("K — une contradiction personnelle va dans À vérifier, une modification contractuelle fiable peut être appliquée", () => {
  const base = {
    id: "proposal", entityId: "entity", personId: "person", currentValue: "125 rue A", incomingValue: "456 rue B",
    sourceName: "permis.jpg", sourceType: "image", sourcePriority: 95, currentSourcePriority: 40, confidence: 0.99,
    status: "conflict", recommendedAction: "replace", reason: "Valeur différente.",
  };
  assert.equal(automaticMergeAction({ ...base, entityType: "client", field: "mailingAddress", label: "Adresse personnelle" }), "queue_review");
  assert.equal(automaticMergeAction({ ...base, personId: undefined, entityType: "mandate", field: "askingPrice", label: "Prix demandé", sourceName: "MO.pdf", sourceType: "pdf", sourcePriority: 90, currentSourcePriority: 80 }), "replace");
});

test("L — les informations manquantes deviennent une file non bloquante", () => {
  const analysis = normalizeUniversalPartial({
    projectType: "buyer",
    documents: [source("texto.png", "Conversation client", "screenshot")],
    people: [{ firstName: "Alex", lastName: "Roy", roles: ["buyer"], sourceName: "texto.png", confidence: 0.9 }],
  }, []);
  const review = automaticReviewItems(analysis);
  assert.ok(review.some((item) => item.includes("Courriel manquant")));
  assert.ok(review.some((item) => item.includes("Téléphone manquant")));
  assert.ok(review.includes("Budget maximal manquant"));
  assert.equal(automaticIngestionBlockers(analysis).length, 0);
});

