import {
  normalizeUniversalValue,
  type ContinuousMergePreview,
  type ExistingCaseContext,
  type MergeProposal,
  type UniversalAnalysis,
  type UniversalDocumentType,
  type UniversalFact,
  type UniversalPerson,
} from "@/lib/universal-import";

export type ActiveFactValue = {
  id?: string;
  entityType: MergeProposal["entityType"];
  entityId: string | null;
  field: string;
  value: string;
  sourcePriority: number;
};

export type ContinuousMergeContext = ExistingCaseContext & {
  property: Record<string, unknown> | null;
  buyer: Record<string, unknown> | null;
  seller: Record<string, unknown> | null;
  financing: Record<string, unknown> | null;
  activeFacts: ActiveFactValue[];
};

export function sourcePriority(type: UniversalDocumentType) {
  if (type === "Pièce d’identité") return 95;
  if (["Certificat de localisation", "Acte de vente"].includes(type)) return 92;
  if (["Contrat de courtage vente", "Contrat de courtage achat", "Modification"].includes(type)) return 90;
  if (type === "Préapprobation") return 90;
  if (["Promesse d’achat", "Contre-proposition"].includes(type)) return 86;
  if (type === "Déclaration du vendeur") return 82;
  if (type === "Taxes") return 78;
  if (type === "Conversation client") return 45;
  return 30;
}

export function buildContinuousMergePreview(
  analysis: UniversalAnalysis,
  context: ContinuousMergeContext,
  assignments: Record<string, string> = {},
): ContinuousMergePreview {
  const proposals: MergeProposal[] = [];
  const sourceByName = new Map(analysis.sources.map((source) => [source.name, source]));
  const clientById = new Map(context.clients.map((client) => [client.id, client]));

  for (const person of analysis.people) {
    const targetId = assignments[person.id] || matchPerson(person, context.clients)?.id || null;
    const current = targetId ? clientById.get(targetId) : null;
    add(proposals, analysis, context, {
      personId: person.id, entityType: "client", entityId: targetId, field: "firstName", label: "Prénom",
      currentValue: current?.firstName || "", incomingValue: person.firstName, sourceName: person.sourceName, confidence: person.confidence,
    });
    add(proposals, analysis, context, {
      personId: person.id, entityType: "client", entityId: targetId, field: "lastName", label: "Nom",
      currentValue: current?.lastName || "", incomingValue: person.lastName, sourceName: person.sourceName, confidence: person.confidence,
    });
    add(proposals, analysis, context, {
      personId: person.id, entityType: "client", entityId: targetId, field: "email", label: "Courriel",
      currentValue: current?.email || "", incomingValue: person.email, sourceName: person.sourceName, confidence: person.confidence,
    });
    add(proposals, analysis, context, {
      personId: person.id, entityType: "client", entityId: targetId, field: "phone", label: "Téléphone",
      currentValue: current?.phone || "", incomingValue: person.phone, sourceName: person.sourceName, confidence: person.confidence,
    });
    add(proposals, analysis, context, {
      personId: person.id, entityType: "client", entityId: targetId, field: "mailingAddress", label: "Adresse personnelle ou postale",
      currentValue: current?.mailingAddress || "", incomingValue: person.mailingAddress, sourceName: person.sourceName, confidence: person.confidence,
    });
    const onlyPersonForSource = analysis.people.filter((candidate) => candidate.sourceName === person.sourceName).length === 1;
    const extraPersonFields = onlyPersonForSource ? analysis.facts.filter((fact) => fact.entity === "person" && fact.sourceName === person.sourceName && !["name", "firstName", "lastName", "email", "phone", "mailingAddress", "address"].includes(fact.field)) : [];
    for (const fact of extraPersonFields) {
      const clientValues: Record<string, string> = {
        birthDate: current?.birthDate || "", dateOfBirth: current?.birthDate || "", language: current?.language || "",
        communicationPreference: current?.communicationPreference || "",
      };
      const active = context.activeFacts.find((item) => item.entityType === "client" && item.entityId === targetId && item.field === fact.field);
      add(proposals, analysis, context, {
        personId: person.id, entityType: "client", entityId: targetId, field: fact.field, label: fact.label,
        currentValue: clientValues[fact.field] || active?.value || "", incomingValue: fact.value,
        sourceName: fact.sourceName, confidence: fact.confidence,
      });
    }
  }

  const propertyId = context.propertyId;
  const property = context.property || {};
  const propertyFields: Array<[keyof UniversalAnalysis["property"], string, string]> = [
    ["address", "address", "Adresse de la propriété"], ["city", "city", "Ville de la propriété"],
    ["postalCode", "postal_code", "Code postal de la propriété"], ["propertyType", "property_type", "Type de propriété"],
    ["lotNumber", "lot_number", "Numéro de lot"],
  ];
  for (const [incomingKey, currentKey, label] of propertyFields) {
    const fact = bestFact(analysis.facts, "property", incomingKey);
    add(proposals, analysis, context, {
      entityType: "property", entityId: propertyId, field: incomingKey, label,
      currentValue: text(property[currentKey]), incomingValue: analysis.property[incomingKey],
      sourceName: fact?.sourceName || analysis.sources[0]?.name || "Source à confirmer", confidence: fact?.confidence ?? null,
    });
  }

  const buyer = context.buyer || {};
  const financing = context.financing || {};
  const buyerFields: Array<[keyof UniversalAnalysis["buyerCriteria"], MergeProposal["entityType"], string, string]> = [
    ["budget", "financing", "maximum_purchase_price", "Budget maximal"],
    ["preapprovalStatus", "financing", "status", "Statut de préqualification"],
    ["downPayment", "financing", "down_payment", "Mise de fonds"],
    ["mortgageAmount", "financing", "mortgage_amount", "Montant hypothécaire"],
    ["occupancyType", "financing", "occupancy_type", "Occupation"],
    ["lender", "financing", "lender", "Prêteur"],
    ["preapprovalDate", "financing", "preapproval_date", "Date de préqualification"],
    ["expiryDate", "financing", "expiry_date", "Expiration de la préqualification"],
    ["sectors", "case", "sectors", "Secteurs recherchés"],
    ["propertyType", "case", "property_type", "Type recherché"],
    ["bedrooms", "case", "bedrooms", "Chambres recherchées"],
    ["importantNeeds", "case", "important_needs", "Besoins importants"],
    ["timeline", "case", "timeline", "Échéancier"],
    ["propertyToSell", "case", "property_to_sell", "Propriété à vendre"],
  ];
  for (const [incomingKey, entityType, currentKey, label] of buyerFields) {
    const rawIncoming = analysis.buyerCriteria[incomingKey];
    const incomingValue = Array.isArray(rawIncoming) ? rawIncoming.join(", ") : typeof rawIncoming === "boolean" ? (rawIncoming ? "Oui" : "Non") : text(rawIncoming);
    if (!incomingValue || (incomingKey === "preapprovalStatus" && incomingValue === "missing")) continue;
    const fact = bestFact(analysis.facts, entityType === "financing" ? "financing" : "buyer", incomingKey);
    const source = entityType === "financing" ? financing : buyer;
    add(proposals, analysis, context, {
      entityType, entityId: entityType === "financing" ? text(financing.id) || null : text(buyer.id) || context.id,
      field: incomingKey, label, currentValue: render(source[currentKey]), incomingValue,
      sourceName: fact?.sourceName || analysis.sources[0]?.name || "Source à confirmer", confidence: fact?.confidence ?? null,
    });
  }

  const canonicalKeys = new Set(proposals.map((proposal) => `${proposal.entityType}:${proposal.field}:${proposal.sourceName}:${normalizeUniversalValue(proposal.incomingValue)}`));
  for (const fact of analysis.facts) {
    const entityType = factEntity(fact);
    if (entityType === "client" || entityType === "property" || entityType === "financing" || entityType === "case") continue;
    const key = `${entityType}:${fact.field}:${fact.sourceName}:${normalizeUniversalValue(fact.value)}`;
    if (canonicalKeys.has(key)) continue;
    const active = context.activeFacts.find((item) => item.entityType === entityType && item.field === fact.field);
    add(proposals, analysis, context, {
      entityType, entityId: entityType === "mandate" ? text(context.seller?.id) || context.id : context.id,
      field: fact.field, label: fact.label, currentValue: active?.value || "", incomingValue: fact.value,
      sourceName: fact.sourceName, confidence: fact.confidence,
    });
  }

  const unique = dedupe(proposals);
  return {
    caseId: context.id,
    caseTitle: context.title,
    proposals: unique,
    newCount: unique.filter((item) => item.status === "new").length,
    unchangedCount: unique.filter((item) => item.status === "same").length,
    conflictCount: unique.filter((item) => item.status === "conflict").length,
    assignmentCount: unique.filter((item) => item.status === "needs_assignment").length,
  };
}

function add(proposals: MergeProposal[], analysis: UniversalAnalysis, context: ContinuousMergeContext, input: {
  personId?: string; entityType: MergeProposal["entityType"]; entityId: string | null; field: string; label: string;
  currentValue: string; incomingValue: string; sourceName: string; confidence: number | null;
}) {
  if (!input.incomingValue.trim()) return;
  const source = analysis.sources.find((item) => item.name === input.sourceName) || analysis.sources[0];
  const priority = source ? sourcePriority(source.type) : 10;
  const active = context.activeFacts.find((item) => item.entityType === input.entityType && item.entityId === input.entityId && item.field === input.field);
  const currentPriority = active?.sourcePriority || 0;
  const same = equivalent(input.field, input.currentValue, input.incomingValue);
  const status = input.personId && !input.entityId ? "needs_assignment" : !input.currentValue ? "new" : same ? "same" : "conflict";
  const recommendedAction = status !== "conflict" ? "replace" : priority > currentPriority ? "replace" : "keep_existing";
  const reason = status === "needs_assignment"
    ? "La personne doit être reliée à une fiche du dossier avant l’enregistrement."
    : status === "new" ? "Cette donnée complète un champ vide."
      : status === "same" ? "La nouvelle source confirme la valeur déjà enregistrée."
        : priority > currentPriority ? "La nouvelle source est plus fiable; une validation reste obligatoire."
          : "La valeur diffère de la fiche actuelle; aucun remplacement automatique n’est permis.";
  proposals.push({
    id: proposalId(input.entityType, input.personId || input.entityId || "case", input.field, input.sourceName, input.incomingValue),
    ...input, sourceType: source?.sourceType || "image", sourcePriority: priority, currentSourcePriority: currentPriority,
    status, recommendedAction, reason,
  });
}

function matchPerson(person: UniversalPerson, clients: ExistingCaseContext["clients"]) {
  const email = normalizeUniversalValue(person.email);
  const phone = person.phone.replace(/\D/g, "");
  const name = normalizeUniversalValue(`${person.firstName}${person.lastName}`);
  const matches = clients.filter((client) => Boolean(
    (email && email === normalizeUniversalValue(client.email))
    || (phone && phone === client.phone.replace(/\D/g, ""))
    || (name && name === normalizeUniversalValue(`${client.firstName}${client.lastName}`)),
  ));
  return matches.length === 1 ? matches[0] : null;
}

function bestFact(facts: UniversalFact[], entity: UniversalFact["entity"], field: string) {
  return facts.filter((fact) => fact.entity === entity && fact.field === field).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
}

function factEntity(fact: UniversalFact): MergeProposal["entityType"] {
  if (fact.entity === "person") return "client";
  if (fact.entity === "buyer") return "case";
  if (fact.entity === "mandate") return "mandate";
  return fact.entity;
}

function equivalent(field: string, first: string, second: string) {
  if (field === "phone") return first.replace(/\D/g, "") === second.replace(/\D/g, "");
  if (field === "email") return first.trim().toLowerCase() === second.trim().toLowerCase();
  if (["budget", "downPayment", "mortgageAmount"].includes(field)) return money(first) === money(second);
  return normalizeUniversalValue(first) === normalizeUniversalValue(second);
}

function money(value: string) { return value.replace(/[^\d]/g, ""); }
function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function render(value: unknown) { return Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Oui" : "Non") : text(value); }
function proposalId(entity: string, id: string, field: string, source: string, value: string) { return [entity, id, field, source, normalizeUniversalValue(value)].join("::"); }
function dedupe(proposals: MergeProposal[]) { const map = new Map<string, MergeProposal>(); proposals.forEach((item) => map.set(item.id, item)); return [...map.values()]; }

