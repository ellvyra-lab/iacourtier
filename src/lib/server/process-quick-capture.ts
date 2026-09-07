import { normalizePhone } from "@/lib/crm-phone";
import type { InboxAnalysis, InboxCaseType, InboxTask } from "@/lib/server/ai-inbox";
import { ensureCentralCase, recordCentralActivity, type CentralCaseType } from "@/lib/server/central-crm";
import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type QuickCaptureResult = {
  clientId: string;
  caseId: string;
  propertyId: string | null;
  clientName: string;
  caseLabel: string;
  createdClient: boolean;
  createdCase: boolean;
  taskCount: number;
  tasks: Array<{ title: string; dueAt: string | null; dueOn: string | null; dueLabel: string | null }>;
  updated: string[];
};

export async function processQuickCapture(supabase: Supabase, userId: string, input: { captureId: string; selectedClientId?: string | null }): Promise<QuickCaptureResult> {
  const { data: capture, error: captureError } = await supabase.from("inbox_captures").select("*").eq("id", input.captureId).eq("user_id", userId).maybeSingle();
  if (captureError) throw captureError;
  if (!capture) throw new Error("Capture introuvable.");
  const stored = processingResult(capture.analysis);
  if (capture.status === "confirmed" && stored) return stored;
  if (Array.isArray(capture.ambiguity) && capture.ambiguity.length > 0 && !input.selectedClientId) throw new Error("Choisis la bonne fiche avant de continuer. Aucun doublon ne sera créé.");

  const analysis = capture.analysis as InboxAnalysis & { engine?: string };
  let client = input.selectedClientId ? await ownedClient(supabase, userId, input.selectedClientId) : await findCertainClient(supabase, userId, analysis);
  if (input.selectedClientId && !client) throw new Error("Le client choisi n’appartient pas à ce compte.");
  if (!client && !analysis.person.firstName) throw new Error("Je n’ai pas reconnu la personne. Corrige la transcription et réessaie.");

  const createdClient = !client;
  if (!client) {
    const roles = caseRoles(analysis.caseType);
    const { data, error } = await supabase.from("clients").insert({
      user_id: userId,
      first_name: analysis.person.firstName,
      last_name: analysis.person.lastName || "",
      email: analysis.person.email || null,
      phone: analysis.person.phone || null,
      city: analysis.property.city || analysis.buyerCriteria.sectors[0] || null,
      roles,
      tags: roleTags(roles),
      source: `Capture IA · ${capture.source_type}`,
      notes: capture.raw_text,
      last_contact_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !data) throw error || new Error("Création de la fiche client impossible.");
    client = data;
  } else {
    const updates: Record<string, unknown> = { roles: [...new Set([...(client.roles || []), ...caseRoles(analysis.caseType)])], updated_at: new Date().toISOString(), last_contact_at: new Date().toISOString() };
    if (!client.email && analysis.person.email) updates.email = analysis.person.email;
    if (!client.phone && analysis.person.phone) updates.phone = analysis.person.phone;
    if (!client.last_name && analysis.person.lastName) updates.last_name = analysis.person.lastName;
    if (!client.city && (analysis.property.city || analysis.buyerCriteria.sectors[0])) updates.city = analysis.property.city || analysis.buyerCriteria.sectors[0];
    const { data, error } = await supabase.from("clients").update(updates).eq("id", client.id).eq("user_id", userId).select("*").single();
    if (error || !data) throw error || new Error("Mise à jour du client impossible.");
    client = data;
  }
  if (analysis.person.phone) await persistPhone(supabase, userId, client.id, analysis.person.phone);

  let propertyId = await resolveProperty(supabase, userId, client.id, analysis);
  let contextCase = await findContextCase(supabase, userId, client.id, propertyId, analysis.caseType);
  if (!propertyId && contextCase?.property_id) propertyId = contextCase.property_id;
  const effectiveType = ((contextCase?.case_type && analysis.caseType === "prospect") ? contextCase.case_type : analysis.caseType) as InboxCaseType;
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim();

  let buyerCaseId: string | null = null;
  let sellerListingId: string | null = null;
  if (effectiveType === "buyer" || effectiveType === "buy_sell") buyerCaseId = await upsertBuyerCase(supabase, userId, client.id, contextCase?.id || null, analysis) || null;
  if ((effectiveType === "seller" || effectiveType === "buy_sell") && propertyId) sellerListingId = await upsertSellerListing(supabase, userId, client.id, propertyId, contextCase?.id || null) || null;

  const nextAction = nextBestAction(analysis, clientName);
  const createdCase = !contextCase;
  const caseId = await ensureCentralCase(supabase, {
    userId,
    primaryClientId: client.id,
    propertyId,
    caseType: effectiveType as CentralCaseType,
    title: caseTitle(effectiveType, analysis, clientName),
    status: "active",
    pipelineStage: initialStage(effectiveType, analysis),
    source: `voice_capture:${capture.id}`,
    nextAction,
    buyerCaseId,
    sellerListingId,
    centralCaseId: contextCase?.id || null,
  });
  await persistCaseFacts(supabase, userId, caseId, capture, analysis);
  const tasks = usefulTasks(analysis, clientName, Boolean(client.phone || analysis.person.phone), Boolean(client.email || analysis.person.email));
  if (tasks.length) {
    const { error } = await supabase.from("tasks").upsert(tasks.map((task) => ({
      user_id: userId,
      client_id: client.id,
      case_id: caseId,
      property_id: propertyId,
      category: task.actionType === "call" ? "followup" : task.actionType,
      title: task.title,
      description: task.description || capture.raw_text,
      due_at: task.dueAt,
      due_on: task.dueOn,
      due_context: task.dueLabel,
      status: "pending",
      validation_required: false,
      source: `voice_capture:${capture.id}`,
      action_type: task.actionType,
      priority_score: task.priorityScore,
      updated_at: new Date().toISOString(),
    })), { onConflict: "case_id,title", ignoreDuplicates: false });
    if (error) throw error;
  }

  const { error: noteError } = await supabase.from("communications").insert({ user_id: userId, client_id: client.id, case_id: caseId, property_id: propertyId, communication_type: "note", direction: "internal", subject: "Capture IA vocale", body: capture.raw_text, metadata: { capture_id: capture.id, source: "voice_capture", engine: analysis.engine } });
  if (noteError) throw noteError;
  await recordCentralActivity(supabase, { userId, clientId: client.id, caseId, eventType: analysis.correction ? "voice_capture_corrected" : "voice_capture_processed", title: analysis.correction ? "Information corrigée par capture vocale" : "Capture vocale organisée", details: `${tasks.length} action(s) créée(s). Transcription originale conservée.` });

  const result: QuickCaptureResult = {
    clientId: client.id,
    caseId,
    propertyId,
    clientName,
    caseLabel: roleLabel(effectiveType),
    createdClient,
    createdCase,
    taskCount: tasks.length,
    tasks: tasks.map((task) => ({ title: task.title, dueAt: task.dueAt, dueOn: task.dueOn, dueLabel: task.dueLabel })),
    updated: updatedLabels(analysis),
  };
  const nextAnalysis = { ...analysis, processing: result };
  const { error: captureUpdateError } = await supabase.from("inbox_captures").update({ client_id: client.id, case_id: caseId, property_id: propertyId, status: "confirmed", analysis: nextAnalysis, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", capture.id).eq("user_id", userId);
  if (captureUpdateError) throw captureUpdateError;
  await recalculateCaseOperatingState(supabase, userId, caseId);
  return result;
}

async function ownedClient(supabase: Supabase, userId: string, clientId: string) { const { data } = await supabase.from("clients").select("*").eq("id", clientId).eq("user_id", userId).maybeSingle(); return data; }
async function findCertainClient(supabase: Supabase, userId: string, analysis: InboxAnalysis) {
  const { data, error } = await supabase.from("clients").select("*").eq("user_id", userId).limit(5000);
  if (error) throw error;
  const email = analysis.person.email.toLowerCase(); const phone = normalizePhone(analysis.person.phone);
  const exact = (data || []).filter((item) => (email && String(item.email || "").toLowerCase() === email) || (phone && normalizePhone(item.phone) === phone));
  if (exact.length === 1) return exact[0];
  const names = (data || []).filter((item) => analysis.person.firstName && fold(item.first_name) === fold(analysis.person.firstName) && (!analysis.person.lastName || fold(item.last_name) === fold(analysis.person.lastName)));
  return names.length === 1 ? names[0] : null;
}

async function resolveProperty(supabase: Supabase, userId: string, clientId: string, analysis: InboxAnalysis) {
  if (!analysis.property.address && analysis.caseType !== "seller" && analysis.caseType !== "buy_sell") return null;
  if (!analysis.property.address && !analysis.property.city) return null;
  const { data: properties, error } = await supabase.from("properties").select("id,address,city,property_type").eq("user_id", userId).limit(3000);
  if (error) throw error;
  const exact = (properties || []).find((item) => analysis.property.address && addressKey(item.address) === addressKey(analysis.property.address));
  if (exact) return exact.id as string;
  if (!analysis.property.address) {
    const { data: relations } = await supabase.from("client_properties").select("property_id").eq("user_id", userId).eq("client_id", clientId);
    const ownedIds = new Set((relations || []).map((item) => item.property_id));
    const related = (properties || []).find((item) => ownedIds.has(item.id) && fold(item.city) === fold(analysis.property.city));
    if (related) return related.id as string;
  }
  const { data, error: insertError } = await supabase.from("properties").insert({ user_id: userId, address: analysis.property.address || "", city: analysis.property.city || "", property_type: analysis.property.propertyType || null }).select("id").single();
  if (insertError || !data) throw insertError || new Error("Création de la propriété impossible.");
  return data.id as string;
}

async function findContextCase(supabase: Supabase, userId: string, clientId: string, propertyId: string | null, type: InboxCaseType) {
  let query = supabase.from("client_cases").select("id,case_type,property_id,status").eq("user_id", userId).eq("primary_client_id", clientId).eq("status", "active");
  if (propertyId) query = query.eq("property_id", propertyId);
  else if (type !== "prospect") query = query.eq("case_type", type);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(2);
  if (error) throw error;
  return data?.length === 1 ? data[0] : null;
}

async function upsertBuyerCase(supabase: Supabase, userId: string, clientId: string, centralCaseId: string | null, analysis: InboxAnalysis) {
  let query = supabase.from("buyer_cases").select("*").eq("user_id", userId).eq("contact_id", clientId).neq("status", "completed");
  if (centralCaseId) query = query.eq("client_case_id", centralCaseId);
  const { data: existing, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const patch: Record<string, unknown> = { status: analysis.financing.prequalified ? "financing" : "qualification", pipeline_stage: analysis.financing.prequalified ? "financing" : "qualification", validation_required: false, source: "voice_capture", updated_at: new Date().toISOString() };
  if (analysis.buyerCriteria.budgetMax) patch.budget = String(analysis.buyerCriteria.budgetMax);
  if (analysis.buyerCriteria.sectors.length) patch.sectors = analysis.buyerCriteria.sectors;
  if (analysis.property.propertyType) patch.property_type = analysis.property.propertyType;
  if (analysis.buyerCriteria.bedroomsMin) patch.bedrooms = String(analysis.buyerCriteria.bedroomsMin);
  const needs = [...analysis.buyerCriteria.mustHaves, ...analysis.buyerCriteria.preferences]; if (needs.length) patch.important_needs = needs.join(" · ");
  if (analysis.financing.prequalified !== null) patch.preapproval_status = analysis.financing.prequalified ? "confirmed" : "missing";
  let buyerCaseId = existing?.id as string | undefined;
  if (buyerCaseId) { const { error: updateError } = await supabase.from("buyer_cases").update(patch).eq("id", buyerCaseId).eq("user_id", userId); if (updateError) throw updateError; }
  else { const { data, error: insertError } = await supabase.from("buyer_cases").insert({ user_id: userId, contact_id: clientId, ...patch }).select("id").single(); if (insertError || !data) throw insertError || new Error("Création du dossier acheteur impossible."); buyerCaseId = data.id; }
  if (analysis.financing.prequalified !== null || analysis.buyerCriteria.budgetMax) {
    const { error: financeError } = await supabase.from("buyer_financing").upsert({ user_id: userId, case_id: buyerCaseId, status: analysis.financing.prequalified ? "confirmed" : "missing", maximum_purchase_price: analysis.financing.amount || analysis.buyerCriteria.budgetMax, raw_data: { source: "voice_capture" }, updated_at: new Date().toISOString() }, { onConflict: "case_id" });
    if (financeError) throw financeError;
  }
  return buyerCaseId;
}

async function upsertSellerListing(supabase: Supabase, userId: string, clientId: string, propertyId: string, centralCaseId: string | null) {
  let query = supabase.from("seller_listings").select("id").eq("user_id", userId).eq("property_id", propertyId).neq("status", "completed");
  if (centralCaseId) query = query.eq("client_case_id", centralCaseId);
  const { data: existing, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  let listingId = existing?.id as string | undefined;
  if (!listingId) { const { data, error: insertError } = await supabase.from("seller_listings").insert({ user_id: userId, property_id: propertyId, status: "draft", pipeline_stage: "qualification", validation_required: false }).select("id").single(); if (insertError || !data) throw insertError || new Error("Création du dossier vendeur impossible."); listingId = data.id; }
  const { error: partyError } = await supabase.from("seller_listing_parties").upsert({ user_id: userId, listing_id: listingId, contact_id: clientId, role: "seller" }, { onConflict: "listing_id,contact_id,role" });
  if (partyError) throw partyError;
  return listingId;
}

async function persistCaseFacts(supabase: Supabase, userId: string, caseId: string, capture: any, analysis: InboxAnalysis) {
  const { data, error } = await supabase.from("client_cases").select("metadata").eq("id", caseId).eq("user_id", userId).single();
  if (error) throw error;
  const previous = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const history = Array.isArray(previous.quick_captures) ? previous.quick_captures.slice(-9) : [];
  const quickCapture = { capture_id: capture.id, captured_at: capture.captured_at, source: "voice_capture", project: analysis.project, property: analysis.property, buyer_criteria: analysis.buyerCriteria, financing: analysis.financing, correction: analysis.correction };
  const { error: updateError } = await supabase.from("client_cases").update({ metadata: { ...previous, latest_quick_capture: quickCapture, quick_captures: [...history, quickCapture] }, updated_at: new Date().toISOString() }).eq("id", caseId).eq("user_id", userId);
  if (updateError) throw updateError;
}

async function persistPhone(supabase: Supabase, userId: string, clientId: string, value: string) { const normalized = normalizePhone(value); if (!normalized) return; const { error } = await supabase.from("client_contact_methods").upsert({ user_id: userId, client_id: clientId, method_type: "phone", label: "primary", value, normalized_value: normalized.replace(/\D/g, ""), is_primary: true, confidence: 1, status: "confirmed", updated_at: new Date().toISOString() }, { onConflict: "client_id,method_type,normalized_value" }); if (error) throw error; }
function usefulTasks(analysis: InboxAnalysis, name: string, hasPhone: boolean, hasEmail: boolean) { const tasks = [...analysis.tasks]; if (!hasPhone && !hasEmail) tasks.push({ title: `Compléter le téléphone ou le courriel de ${name}`, description: "Coordonnée manquante détectée pendant la capture.", dueAt: null, dueOn: null, dueLabel: null, actionType: "follow_up", priorityScore: 55 }); return [...new Map(tasks.map((task) => [fold(task.title), task])).values()].slice(0, 6); }
function nextBestAction(analysis: InboxAnalysis, name: string) { return analysis.financing.prequalified === false ? `Obtenir la préqualification de ${name}` : analysis.tasks[0]?.title || `Faire le suivi avec ${name}`; }
function initialStage(type: InboxCaseType, analysis: InboxAnalysis) { if (type === "buyer" || type === "buy_sell") return analysis.financing.prequalified ? "prequalification" : "qualification"; if (type === "seller") return "qualification"; return "new_contact"; }
function caseRoles(type: InboxCaseType) { return type === "buy_sell" ? ["buyer", "seller"] : type === "seller" ? ["seller"] : type === "buyer" ? ["buyer"] : ["prospect"]; }
function roleTags(roles: string[]) { return roles.map((role) => role === "seller" ? "Vendeur" : role === "buyer" ? "Acheteur" : "Prospect"); }
function roleLabel(type: InboxCaseType) { return type === "seller" ? "Vendeuse / vendeur" : type === "buyer" ? "Acheteuse / acheteur" : type === "buy_sell" ? "Acheteur + vendeur" : "Prospect"; }
function caseTitle(type: InboxCaseType, analysis: InboxAnalysis, name: string) { const prefix = type === "seller" ? "Vente" : type === "buyer" ? "Achat" : type === "buy_sell" ? "Achat + vente" : "Suivi"; return `${prefix} — ${analysis.property.address || analysis.property.city || analysis.buyerCriteria.sectors.join(" / ") || name}`; }
function updatedLabels(analysis: InboxAnalysis) { const output = ["Fiche client", "Dossier CRM", "Pipeline et prochaine action"]; if (analysis.buyerCriteria.budgetMax) output.push(`Budget ${new Intl.NumberFormat("fr-CA").format(analysis.buyerCriteria.budgetMax)} $`); if (analysis.buyerCriteria.sectors.length) output.push(`Secteurs ${analysis.buyerCriteria.sectors.join(" / ")}`); if (analysis.buyerCriteria.bedroomsMin) output.push(`${analysis.buyerCriteria.bedroomsMin} chambres minimum`); if (analysis.buyerCriteria.garageRequired) output.push("Garage obligatoire"); if (analysis.financing.prequalified === false) output.push("Préqualification à obtenir"); if (analysis.financing.prequalified === true) output.push("Préqualification confirmée"); return output; }
function processingResult(value: unknown) { const result = value && typeof value === "object" ? (value as Record<string, unknown>).processing : null; return result && typeof result === "object" ? result as QuickCaptureResult : null; }
function addressKey(value: string) { return fold(value).replace(/\b(rue|avenue|av|chemin|boulevard|boul)\b/g, "").replace(/[^a-z0-9]/g, ""); }
function fold(value: string) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

