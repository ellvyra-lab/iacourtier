import { buildContinuousMergePreview, type ContinuousMergeContext } from "@/lib/continuous-merge";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeUniversalValue,
  type ExistingCaseContext,
  type MergeDecision,
  type MergeProposal,
  type PersonDecision,
  type UniversalAnalysis,
} from "@/lib/universal-import";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type LoadedMergeContext = ContinuousMergeContext & {
  buyerCaseId: string | null;
  sellerListingId: string | null;
};

export async function loadContinuousMergeContext(supabase: Supabase, userId: string, caseId: string): Promise<LoadedMergeContext> {
  const { data: clientCase, error: caseError } = await supabase
    .from("client_cases")
    .select("id,title,case_type,property_id,primary_client_id,property:properties(*)")
    .eq("id", caseId).eq("user_id", userId).maybeSingle();
  if (caseError) throw caseError;
  if (!clientCase) throw new Error("Le dossier existant est introuvable ou ne t’appartient pas.");

  const [relations, buyer, seller, activeFacts] = await Promise.all([
    supabase.from("client_case_clients").select("client_id").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("buyer_cases").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
    supabase.from("seller_listings").select("*").eq("client_case_id", caseId).eq("user_id", userId).maybeSingle(),
    supabase.from("crm_facts").select("id,entity_type,entity_id,field_key,value_text,source_priority").eq("case_id", caseId).eq("user_id", userId).eq("is_active", true),
  ]);
  const firstError = relations.error || buyer.error || seller.error || activeFacts.error;
  if (firstError) throw firstError;
  const clientIds = [...new Set([clientCase.primary_client_id, ...(relations.data || []).map((item) => item.client_id)].filter(Boolean))] as string[];
  const clientsResult = clientIds.length
    ? await supabase.from("clients").select("id,first_name,last_name,email,phone,mailing_address,birth_date,language,communication_preference").eq("user_id", userId).in("id", clientIds)
    : { data: [], error: null };
  if (clientsResult.error) throw clientsResult.error;

  let financing: Record<string, unknown> | null = null;
  if (buyer.data?.id) {
    const result = await supabase.from("buyer_financing").select("*").eq("case_id", buyer.data.id).eq("user_id", userId).maybeSingle();
    if (result.error) throw result.error;
    financing = result.data;
  }
  const property = Array.isArray(clientCase.property) ? clientCase.property[0] : clientCase.property;
  return {
    id: clientCase.id,
    title: clientCase.title,
    caseType: caseType(clientCase.case_type),
    propertyId: clientCase.property_id,
    clients: (clientsResult.data || []).map((client) => ({
      id: client.id, firstName: client.first_name || "", lastName: client.last_name || "",
      email: client.email || "", phone: client.phone || "", mailingAddress: client.mailing_address || "",
      birthDate: client.birth_date || "", language: client.language || "", communicationPreference: client.communication_preference || "",
    })),
    property: property || null,
    buyer: buyer.data || null,
    seller: seller.data || null,
    financing,
    activeFacts: (activeFacts.data || []).map((fact) => ({
      id: fact.id, entityType: fact.entity_type, entityId: fact.entity_id, field: fact.field_key,
      value: fact.value_text, sourcePriority: fact.source_priority,
    })),
    buyerCaseId: buyer.data?.id || null,
    sellerListingId: seller.data?.id || null,
  };
}

export function publicCaseContext(context: LoadedMergeContext): ExistingCaseContext {
  return { id: context.id, title: context.title, caseType: context.caseType, propertyId: context.propertyId, clients: context.clients };
}

export async function applyContinuousMerge(supabase: Supabase, input: {
  userId: string;
  analysis: UniversalAnalysis;
  context: LoadedMergeContext;
  personDecisions: PersonDecision[];
  mergeDecisions: MergeDecision[];
  centralDocumentIds: Map<string, string>;
}) {
  const assignments = Object.fromEntries(input.personDecisions
    .filter((item) => item.action === "use" && item.existingContactId)
    .map((item) => [item.personId, item.existingContactId as string]));
  const preview = buildContinuousMergePreview(input.analysis, input.context, assignments);
  const decisions = new Map(input.mergeDecisions.map((decision) => [decision.proposalId, decision.action]));
  const unresolvedAssignment = preview.proposals.find((proposal) => proposal.status === "needs_assignment");
  if (unresolvedAssignment) throw new MergeValidationError(`Choisis à quelle personne du dossier appartient « ${unresolvedAssignment.sourceName} » avant d’enregistrer.`);
  const unresolvedConflict = preview.proposals.find((proposal) => proposal.status === "conflict" && !decisions.has(proposal.id));
  if (unresolvedConflict) throw new MergeValidationError(`Une décision est requise pour ${unresolvedConflict.label} : conserver, remplacer, ajouter ou ignorer.`);

  let added = 0;
  let confirmed = 0;
  let conflicts = 0;
  let resolved = 0;
  for (const proposal of preview.proposals) {
    const requested = proposal.status === "conflict" ? decisions.get(proposal.id)! : proposal.status === "same" ? "keep_existing" : "replace";
    const sourceDocumentId = input.centralDocumentIds.get(proposal.sourceName) || null;
    const becomesActive = requested === "replace" || requested === "add_secondary" || proposal.status === "same";
    const factStatus = requested === "ignore" ? "rejected" : proposal.status === "conflict" && requested === "keep_existing" ? "rejected" : "confirmed";
    if (requested === "replace" && proposal.entityId) {
      const { error } = await supabase.from("crm_facts").update({ is_active: false, status: "superseded", updated_at: new Date().toISOString() })
        .eq("user_id", input.userId).eq("case_id", input.context.id).eq("entity_type", proposal.entityType)
        .eq("entity_id", proposal.entityId).eq("field_key", proposal.field).eq("is_active", true);
      if (error) throw error;
    }
    const { data: fact, error: factError } = await supabase.from("crm_facts").insert({
      user_id: input.userId, case_id: input.context.id, entity_type: proposal.entityType, entity_id: proposal.entityId,
      field_key: proposal.field, label: proposal.label, value_text: proposal.incomingValue,
      normalized_value: normalizeUniversalValue(proposal.incomingValue), source_document_id: sourceDocumentId,
      source_label: proposal.sourceName, source_type: proposal.sourceType, source_priority: proposal.sourcePriority,
      confidence: proposal.confidence, status: factStatus, is_active: becomesActive && factStatus === "confirmed",
      resolution_note: resolutionNote(proposal, requested),
    }).select("id").single();
    if (factError || !fact) throw factError || new Error("La provenance d’une information n’a pas pu être enregistrée.");

    if (proposal.status === "conflict") {
      conflicts += 1;
      const active = input.context.activeFacts.find((item) => item.entityType === proposal.entityType && item.entityId === proposal.entityId && item.field === proposal.field);
      const { error } = await supabase.from("data_conflicts").insert({
        user_id: input.userId, case_id: input.context.id, entity_type: proposal.entityType, entity_id: proposal.entityId,
        field_key: proposal.field, label: proposal.label, current_fact_id: active?.id || null, proposed_fact_id: fact.id,
        current_value: proposal.currentValue, proposed_value: proposal.incomingValue,
        status: requested === "ignore" ? "ignored" : "resolved", resolution: requested,
        resolved_by: input.userId, resolved_at: new Date().toISOString(),
      });
      if (error) throw error;
      resolved += 1;
    }

    if (proposal.status === "new") added += 1;
    if (proposal.status === "same") confirmed += 1;
    if (requested === "replace" || requested === "add_secondary" || proposal.status === "same") {
      const canonicalAction: "replace" | "add_secondary" = requested === "add_secondary" ? "add_secondary" : "replace";
      await applyCanonicalValue(supabase, input.userId, input.context, proposal, canonicalAction, sourceDocumentId);
    }
  }

  const readiness = await recalculateReadiness(supabase, input.userId, input.context.id);
  return { preview, added, confirmed, conflicts, resolved, ...readiness };
}

async function applyCanonicalValue(supabase: Supabase, userId: string, context: LoadedMergeContext, proposal: MergeProposal, action: "replace" | "add_secondary", sourceDocumentId: string | null) {
  if (proposal.entityType === "client" && proposal.entityId) {
    if (proposal.field === "phone" || proposal.field === "email") {
      const methodType = proposal.field;
      if (action === "replace" && proposal.currentValue && !equivalentContact(methodType, proposal.currentValue, proposal.incomingValue)) {
        await upsertContactMethod(supabase, userId, proposal.entityId, methodType, proposal.currentValue, false, null, proposal.confidence);
      }
      await upsertContactMethod(supabase, userId, proposal.entityId, methodType, proposal.incomingValue, action === "replace", sourceDocumentId, proposal.confidence);
      if (action === "replace") {
        const { error } = await supabase.from("clients").update({ [proposal.field]: proposal.incomingValue, updated_at: new Date().toISOString() }).eq("id", proposal.entityId).eq("user_id", userId);
        if (error) throw error;
      }
      return;
    }
    if (proposal.field === "mailingAddress") {
      await upsertAddress(supabase, userId, context.id, proposal.entityId, proposal.incomingValue, action === "replace", sourceDocumentId, proposal);
      if (action === "replace") {
        const { error } = await supabase.from("clients").update({ mailing_address: proposal.incomingValue, updated_at: new Date().toISOString() }).eq("id", proposal.entityId).eq("user_id", userId);
        if (error) throw error;
      }
      return;
    }
    const column = ({ firstName: "first_name", lastName: "last_name", birthDate: "birth_date", dateOfBirth: "birth_date", language: "language", communicationPreference: "communication_preference" } as Record<string, string>)[proposal.field];
    if (column && action === "replace") {
      const { error } = await supabase.from("clients").update({ [column]: proposal.incomingValue, updated_at: new Date().toISOString() }).eq("id", proposal.entityId).eq("user_id", userId);
      if (error) throw error;
    }
    return;
  }

  if (proposal.entityType === "property" && proposal.entityId && action === "replace") {
    const column = ({ address: "address", city: "city", postalCode: "postal_code", propertyType: "property_type", lotNumber: "lot_number" } as Record<string, string>)[proposal.field];
    if (column) {
      const { error } = await supabase.from("properties").update({ [column]: proposal.incomingValue, updated_at: new Date().toISOString() }).eq("id", proposal.entityId).eq("user_id", userId);
      if (error) throw error;
    }
    return;
  }

  if (proposal.entityType === "case" && context.buyerCaseId && action === "replace") {
    const column = ({ sectors: "sectors", propertyType: "property_type", bedrooms: "bedrooms", importantNeeds: "important_needs", timeline: "timeline", propertyToSell: "property_to_sell" } as Record<string, string>)[proposal.field];
    if (column) {
      const value = proposal.field === "sectors" ? proposal.incomingValue.split(",").map((item) => item.trim()).filter(Boolean)
        : proposal.field === "propertyToSell" ? /^oui$/i.test(proposal.incomingValue) : proposal.incomingValue;
      const { error } = await supabase.from("buyer_cases").update({ [column]: value, updated_at: new Date().toISOString() }).eq("id", context.buyerCaseId).eq("user_id", userId);
      if (error) throw error;
    }
    return;
  }

  if (proposal.entityType === "financing" && context.buyerCaseId && action === "replace") {
    const column = ({ budget: "maximum_purchase_price", preapprovalStatus: "status", downPayment: "down_payment", mortgageAmount: "mortgage_amount", occupancyType: "occupancy_type", lender: "lender", preapprovalDate: "preapproval_date", expiryDate: "expiry_date" } as Record<string, string>)[proposal.field];
    if (column) {
      const monetary = ["budget", "downPayment", "mortgageAmount"].includes(proposal.field);
      const value = monetary ? moneyValue(proposal.incomingValue) : proposal.incomingValue || null;
      const { error } = await supabase.from("buyer_financing").upsert({ user_id: userId, case_id: context.buyerCaseId, [column]: value, updated_at: new Date().toISOString() }, { onConflict: "case_id" });
      if (error) throw error;
    }
  }
}

async function upsertContactMethod(supabase: Supabase, userId: string, clientId: string, methodType: "phone" | "email", value: string, isPrimary: boolean, documentId: string | null, confidence: number | null) {
  const normalized = methodType === "phone" ? value.replace(/\D/g, "") : value.trim().toLowerCase();
  const { error } = await supabase.from("client_contact_methods").upsert({
    user_id: userId, client_id: clientId, method_type: methodType, label: isPrimary ? "primary" : "other",
    value, normalized_value: normalized, is_primary: isPrimary, source_document_id: documentId, confidence, status: "confirmed", updated_at: new Date().toISOString(),
  }, { onConflict: "client_id,method_type,normalized_value" });
  if (error) throw error;
}

async function upsertAddress(supabase: Supabase, userId: string, caseId: string, clientId: string, value: string, primary: boolean, documentId: string | null, proposal: MergeProposal) {
  const { error } = await supabase.from("client_addresses").upsert({
    user_id: userId, client_id: clientId, case_id: caseId, address_type: primary ? "personal" : "mailing",
    address_line: value, normalized_address: normalizeUniversalValue(value), is_primary: primary,
    source_document_id: documentId, source_label: proposal.sourceName, confidence: proposal.confidence, status: "confirmed", updated_at: new Date().toISOString(),
  }, { onConflict: "client_id,address_type,normalized_address" });
  if (error) throw error;
}

async function recalculateReadiness(supabase: Supabase, userId: string, caseId: string) {
  const [caseResult, relations, documents, conflicts] = await Promise.all([
    supabase.from("client_cases").select("case_type,primary_client_id,property_id").eq("id", caseId).eq("user_id", userId).single(),
    supabase.from("client_case_clients").select("client_id").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("documents").select("id").eq("case_id", caseId).eq("user_id", userId),
    supabase.from("data_conflicts").select("id").eq("case_id", caseId).eq("user_id", userId).eq("status", "pending"),
  ]);
  const firstError = caseResult.error || relations.error || documents.error || conflicts.error;
  if (firstError) throw firstError;
  const clientIds = [...new Set([caseResult.data.primary_client_id, ...(relations.data || []).map((row) => row.client_id)].filter(Boolean))] as string[];
  const clients = clientIds.length ? await supabase.from("clients").select("first_name,last_name,email,phone").eq("user_id", userId).in("id", clientIds) : { data: [], error: null };
  if (clients.error) throw clients.error;
  const rows = clients.data || [];
  let score = 0;
  if (rows.length) score += 15;
  if (rows.every((client) => client.first_name || client.last_name)) score += 15;
  if (rows.every((client) => client.email)) score += 10;
  if (rows.every((client) => client.phone)) score += 10;
  if (caseResult.data.case_type === "seller" || caseResult.data.case_type === "buy_sell") score += caseResult.data.property_id ? 25 : 0;
  else score += 15;
  score += Math.min(20, (documents.data || []).length * 10);
  if (!(conflicts.data || []).length) score += 15;
  const progress = Math.min(100, score);
  const nextAction = (conflicts.data || []).length ? "Résoudre les informations contradictoires"
    : !(documents.data || []).length ? "Ajouter les documents du dossier"
      : progress < 80 ? "Compléter les renseignements manquants" : "Valider la prochaine étape du parcours";
  const { error } = await supabase.from("client_cases").update({ progress, next_action: nextAction, updated_at: new Date().toISOString() }).eq("id", caseId).eq("user_id", userId);
  if (error) throw error;
  return { progress, nextAction };
}

function resolutionNote(proposal: MergeProposal, action: string) { return `${proposal.reason} Décision : ${action}.`; }
function equivalentContact(type: "phone" | "email", first: string, second: string) { return type === "phone" ? first.replace(/\D/g, "") === second.replace(/\D/g, "") : first.trim().toLowerCase() === second.trim().toLowerCase(); }
function moneyValue(value: string) { const normalized = value.replace(/[^\d,.-]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""); const number = Number(normalized); return Number.isFinite(number) ? number : null; }
function caseType(value: string): ExistingCaseContext["caseType"] { return (["buyer", "seller", "buy_sell", "prospect", "other"].includes(value) ? value : "other") as ExistingCaseContext["caseType"]; }

export class MergeValidationError extends Error {}

