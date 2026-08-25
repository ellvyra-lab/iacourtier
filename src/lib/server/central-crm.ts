import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalCrmStage, pipelineProgress, stageDefinition, type CrmPipelineType } from "@/lib/crm-operating-system";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type CentralCaseType = "buyer" | "seller" | "buy_sell" | "prospect" | "renewal" | "post_transaction" | "other";

type EnsureCaseInput = {
  userId: string;
  primaryClientId: string;
  participantIds?: string[];
  propertyId?: string | null;
  caseType: CentralCaseType;
  title: string;
  status: string;
  pipelineStage: string;
  source: string;
  buyerCaseId?: string | null;
  sellerListingId?: string | null;
  nextAction?: string;
  centralCaseId?: string | null;
};

export async function ensureCentralCase(supabase: Supabase, input: EnsureCaseInput) {
  const linkedIds: string[] = input.centralCaseId ? [input.centralCaseId] : [];
  if (input.buyerCaseId) {
    const { data, error } = await supabase.from("buyer_cases").select("client_case_id").eq("id", input.buyerCaseId).eq("user_id", input.userId).maybeSingle();
    if (error) throw error;
    if (data?.client_case_id) linkedIds.push(data.client_case_id);
  }
  if (input.sellerListingId) {
    const { data, error } = await supabase.from("seller_listings").select("client_case_id").eq("id", input.sellerListingId).eq("user_id", input.userId).maybeSingle();
    if (error) throw error;
    if (data?.client_case_id) linkedIds.push(data.client_case_id);
  }

  let caseId = linkedIds[0];
  const canonicalStage = canonicalCrmStage(input.caseType, input.pipelineStage);
  const progress = caseProgress(input.caseType, canonicalStage);
  const nextAction = input.nextAction || nextActionFor(input.caseType, canonicalStage);
  if (!caseId) {
    const { data, error } = await supabase.from("client_cases").insert({
      user_id: input.userId, primary_client_id: input.primaryClientId, property_id: input.propertyId || null,
      case_type: input.caseType, pipeline_type: input.caseType, title: input.title, status: input.status,
      pipeline_stage: canonicalStage, current_stage: canonicalStage, pipeline_progress: progress, progress,
      next_action: nextAction, next_action_reason: `Action recommandée pour ${stageDefinition(input.caseType, canonicalStage).label}`,
      source: input.source,
    }).select("id").single();
    if (error || !data) throw error || new Error("Création du dossier CRM central impossible.");
    caseId = data.id;
  } else {
    const { error } = await supabase.from("client_cases").update({
      primary_client_id: input.primaryClientId, property_id: input.propertyId || null, case_type: input.caseType,
      title: input.title, status: input.status, pipeline_type: input.caseType,
      pipeline_stage: canonicalStage, current_stage: canonicalStage, pipeline_progress: progress, progress,
      next_action: nextAction, updated_at: new Date().toISOString(),
    }).eq("id", caseId).eq("user_id", input.userId);
    if (error) throw error;
  }

  if (input.buyerCaseId) {
    const { error } = await supabase.from("buyer_cases").update({ client_case_id: caseId }).eq("id", input.buyerCaseId).eq("user_id", input.userId);
    if (error) throw error;
  }
  if (input.sellerListingId) {
    const { error } = await supabase.from("seller_listings").update({ client_case_id: caseId }).eq("id", input.sellerListingId).eq("user_id", input.userId);
    if (error) throw error;
  }

  const participants = [...new Set([input.primaryClientId, ...(input.participantIds || [])])];
  const { error: participantsError } = await supabase.from("client_case_clients").upsert(participants.map((clientId) => ({
    user_id: input.userId, case_id: caseId, client_id: clientId,
    role: input.caseType === "seller" ? "seller" : input.caseType === "buyer" ? "buyer" : "client",
  })), { onConflict: "case_id,client_id,role", ignoreDuplicates: true });
  if (participantsError) throw participantsError;

  if (input.propertyId) {
    const relationship = input.caseType === "seller" ? "seller" : input.caseType === "buyer" ? "interested" : "owner";
    const { error } = await supabase.from("client_properties").upsert(participants.map((clientId) => ({
      user_id: input.userId, client_id: clientId, property_id: input.propertyId, relationship, case_id: caseId,
    })), { onConflict: "client_id,property_id,relationship,case_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  return caseId as string;
}

export async function updateCentralCaseStage(supabase: Supabase, input: { userId: string; caseId: string; caseType: CentralCaseType; status: string; pipelineStage: string; nextAction?: string }) {
  const canonicalStage = canonicalCrmStage(input.caseType, input.pipelineStage);
  const { error } = await supabase.from("client_cases").update({
    status: input.status, pipeline_stage: canonicalStage, current_stage: canonicalStage,
    pipeline_progress: caseProgress(input.caseType, canonicalStage), progress: caseProgress(input.caseType, canonicalStage),
    next_action: input.nextAction || nextActionFor(input.caseType, canonicalStage), updated_at: new Date().toISOString(),
  }).eq("id", input.caseId).eq("user_id", input.userId);
  if (error) throw error;
}

export async function syncCentralDocument(supabase: Supabase, input: {
  userId: string; clientId: string | null; caseId: string; propertyId?: string | null;
  document: Record<string, unknown>; legacySource: "buyer_case_documents" | "seller_listing_documents";
}) {
  const { data, error } = await supabase.from("documents").upsert({
    user_id: input.userId, client_id: input.clientId, case_id: input.caseId, property_id: input.propertyId || null,
    name: input.document.name, category: input.document.document_type || "Autre", document_type: input.document.document_type || "Autre", mime_type: input.document.mime_type || null,
    size_bytes: input.document.size_bytes || 0, storage_path: input.document.storage_path,
    source_type: input.document.source_type || "file", analysis_status: input.document.analysis_status || "analyzed",
    analysis_metadata: input.document.analysis_metadata || {}, extracted_facts: input.document.extracted_facts || [],
    source_date: input.document.source_date || null, legacy_source: input.legacySource, legacy_id: input.document.id,
    is_sensitive: Boolean(input.document.is_sensitive), subject_client_id: input.document.subject_client_id || input.clientId,
    created_at: input.document.created_at || new Date().toISOString(),
  }, { onConflict: "user_id,legacy_source,legacy_id" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function syncCentralWorkflow(supabase: Supabase, input: { userId: string; clientId: string | null; caseId: string; buyerCaseId?: string | null; sellerListingId?: string | null }) {
  if (input.buyerCaseId) {
    const [tasks, automations] = await Promise.all([
      supabase.from("buyer_case_tasks").select("*").eq("case_id", input.buyerCaseId).eq("user_id", input.userId),
      supabase.from("buyer_case_automations").select("*").eq("case_id", input.buyerCaseId).eq("user_id", input.userId),
    ]);
    if (tasks.error || automations.error) throw tasks.error || automations.error;
    if (tasks.data?.length) {
      const { error } = await supabase.from("tasks").upsert(tasks.data.map((task) => ({ user_id: input.userId, client_id: input.clientId, case_id: input.caseId, category: task.category, title: task.title, status: task.status, validation_required: task.validation_required, legacy_source: "buyer_case_tasks", legacy_id: task.id, created_at: task.created_at, updated_at: task.updated_at })), { onConflict: "user_id,legacy_source,legacy_id" });
      if (error) throw error;
    }
    if (automations.data?.length) {
      const { error } = await supabase.from("automations").upsert(automations.data.map((automation) => ({ user_id: input.userId, client_id: input.clientId, case_id: input.caseId, name: automation.name, status: automation.status, external_delivery_enabled: false, legacy_source: "buyer_case_automations", legacy_id: automation.id, created_at: automation.created_at, updated_at: automation.updated_at })), { onConflict: "user_id,legacy_source,legacy_id" });
      if (error) throw error;
    }
  }
  if (input.sellerListingId) {
    const [tasks, automations] = await Promise.all([
      supabase.from("seller_listing_tasks").select("*").eq("listing_id", input.sellerListingId).eq("user_id", input.userId),
      supabase.from("seller_listing_automations").select("*").eq("listing_id", input.sellerListingId).eq("user_id", input.userId),
    ]);
    if (tasks.error || automations.error) throw tasks.error || automations.error;
    if (tasks.data?.length) {
      const { error } = await supabase.from("tasks").upsert(tasks.data.map((task) => ({ user_id: input.userId, client_id: input.clientId, case_id: input.caseId, category: task.category, title: task.title, status: task.status, validation_required: task.validation_required, legacy_source: "seller_listing_tasks", legacy_id: task.id, created_at: task.created_at, updated_at: task.updated_at })), { onConflict: "user_id,legacy_source,legacy_id" });
      if (error) throw error;
    }
    if (automations.data?.length) {
      const { error } = await supabase.from("automations").upsert(automations.data.map((automation) => ({ user_id: input.userId, client_id: input.clientId, case_id: input.caseId, name: automation.name, status: automation.status, external_delivery_enabled: false, legacy_source: "seller_listing_automations", legacy_id: automation.id, created_at: automation.created_at, updated_at: automation.updated_at })), { onConflict: "user_id,legacy_source,legacy_id" });
      if (error) throw error;
    }
  }
}

export async function recordCentralActivity(supabase: Supabase, input: { userId: string; clientId: string | null; caseId: string; eventType: string; title: string; details?: string | null }) {
  const { error } = await supabase.from("activity_events").insert({ user_id: input.userId, client_id: input.clientId, case_id: input.caseId, event_type: input.eventType, title: input.title, details: input.details || null });
  if (error) throw error;
}

export function caseProgress(type: CentralCaseType, stage: string) {
  return pipelineProgress(type as CrmPipelineType, stage);
}

export function nextActionFor(type: CentralCaseType, stage: string) {
  return stageDefinition(type as CrmPipelineType, stage).nextAction;
}

