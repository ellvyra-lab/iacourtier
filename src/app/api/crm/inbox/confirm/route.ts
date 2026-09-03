import { NextResponse } from "next/server";

import { ensureCentralCase, recordCentralActivity, type CentralCaseType } from "@/lib/server/central-crm";
import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";
import type { InboxAnalysis } from "@/lib/server/ai-inbox";
import { normalizePhone } from "@/lib/crm-phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 });
    const body = await request.json() as { captureId?: string; clientId?: string | null };
    if (!body.captureId) return NextResponse.json({ error: "Analyse introuvable." }, { status: 400 });
    const { data: capture, error: captureError } = await supabase.from("inbox_captures").select("*").eq("id", body.captureId).eq("user_id", user.id).maybeSingle();
    if (captureError) return NextResponse.json({ error: captureError.message }, { status: 500 });
    if (!capture) return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
    if (capture.status === "confirmed" && capture.case_id) return NextResponse.json({ ok: true, clientId: capture.client_id, caseId: capture.case_id, reused: true });
    if (Array.isArray(capture.ambiguity) && capture.ambiguity.length > 0 && !body.clientId) return NextResponse.json({ error: "Choisis la fiche existante à relier avant de confirmer. Aucun doublon ne sera créé automatiquement." }, { status: 409 });
    const analysis = capture.analysis as InboxAnalysis & { engine?: string };
    let client = body.clientId ? await ownedClient(supabase, user.id, body.clientId) : null;
    if (body.clientId && !client) return NextResponse.json({ error: "Le client choisi n’appartient pas à ce compte." }, { status: 403 });
    if (!client) client = await findCertainClient(supabase, user.id, analysis);
    if (!client) {
      const roles = caseRoles(analysis.caseType);
      const { data, error } = await supabase.from("clients").insert({
        user_id: user.id,
        first_name: analysis.person.firstName || "À identifier",
        last_name: analysis.person.lastName || "",
        email: analysis.person.email || null,
        phone: analysis.person.phone || null,
        city: analysis.property.city || null,
        roles,
        tags: roles.map((role) => role === "seller" ? "Vendeur" : role === "buyer" ? "Acheteur" : "Prospect"),
        source: `Boîte d’entrée IA · ${capture.source_type}`,
        notes: analysis.request,
      }).select("*").single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Création de la fiche client impossible." }, { status: 500 });
      client = data;
      await persistPhone(supabase, user.id, client.id, analysis.person.phone);
    } else {
      const updates: Record<string, unknown> = {};
      if (!client.email && analysis.person.email) updates.email = analysis.person.email;
      if (!client.phone && analysis.person.phone) updates.phone = analysis.person.phone;
      if (!client.last_name && analysis.person.lastName) updates.last_name = analysis.person.lastName;
      const roles = [...new Set([...(client.roles || []), ...caseRoles(analysis.caseType)])];
      updates.roles = roles;
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from("clients").update(updates).eq("id", client.id).eq("user_id", user.id).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      client = data;
      if (analysis.person.phone) await persistPhone(supabase, user.id, client.id, analysis.person.phone);
    }

    let propertyId: string | null = null;
    if (analysis.property.address) {
      const { data: existing } = await supabase.from("properties").select("id").eq("user_id", user.id).eq("address", analysis.property.address).limit(1).maybeSingle();
      if (existing) propertyId = existing.id;
      else {
        const { data, error } = await supabase.from("properties").insert({ user_id: user.id, address: analysis.property.address, city: analysis.property.city || "", property_type: analysis.property.propertyType || null }).select("id").single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        propertyId = data.id;
      }
    }
    const existingCase = await findActiveCase(supabase, user.id, client.id, analysis.caseType);
    const title = caseTitle(analysis, client);
    const caseId = await ensureCentralCase(supabase, {
      userId: user.id, primaryClientId: client.id, propertyId, caseType: analysis.caseType as CentralCaseType,
      title, status: "active", pipelineStage: initialStage(analysis.caseType), source: `ai_inbox:${capture.source_type}`,
      nextAction: analysis.tasks[0]?.title || "Faire le suivi", centralCaseId: existingCase?.id || null,
    });
    const taskRows = analysis.tasks.map((task) => ({
      user_id: user.id, client_id: client.id, case_id: caseId, property_id: propertyId, category: task.actionType === "call" ? "followup" : task.actionType,
      title: task.title, description: task.description || analysis.request, due_at: task.dueAt, status: "pending", validation_required: false,
      source: `ai_inbox:${capture.source_type}`, action_type: task.actionType, priority_score: task.priorityScore,
    }));
    if (taskRows.length) {
      const { error } = await supabase.from("tasks").upsert(taskRows, { onConflict: "case_id,title", ignoreDuplicates: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { error: noteError } = await supabase.from("communications").insert({ user_id: user.id, client_id: client.id, case_id: caseId, property_id: propertyId, communication_type: "note", direction: "internal", subject: "Capture rapide analysée", body: analysis.request, metadata: { capture_id: capture.id, source_type: capture.source_type, engine: analysis.engine } });
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
    await recordCentralActivity(supabase, { userId: user.id, clientId: client.id, caseId, eventType: "ai_inbox_confirmed", title: "Capture rapide confirmée", details: `${analysis.tasks.length} action(s) reliée(s) au dossier central.` });
    await supabase.from("inbox_captures").update({ client_id: client.id, case_id: caseId, property_id: propertyId, status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", capture.id).eq("user_id", user.id);
    await recalculateCaseOperatingState(supabase, user.id, caseId);
    return NextResponse.json({ ok: true, clientId: client.id, caseId, createdClient: !body.clientId && !existingCase, taskCount: taskRows.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Confirmation impossible." }, { status: 500 });
  }
}

async function ownedClient(supabase: any, userId: string, clientId: string) { const { data } = await supabase.from("clients").select("*").eq("id", clientId).eq("user_id", userId).maybeSingle(); return data; }
async function findCertainClient(supabase: any, userId: string, analysis: InboxAnalysis) {
  const { data } = await supabase.from("clients").select("*").eq("user_id", userId).limit(5000);
  const email = analysis.person.email.toLowerCase(); const phone = normalizePhone(analysis.person.phone);
  const exact = (data || []).filter((client: any) => (email && String(client.email || "").toLowerCase() === email) || (phone && normalizePhone(client.phone) === phone));
  if (exact.length === 1) return exact[0];
  const names = (data || []).filter((client: any) => analysis.person.firstName && analysis.person.lastName && fold(client.first_name) === fold(analysis.person.firstName) && fold(client.last_name) === fold(analysis.person.lastName));
  return names.length === 1 ? names[0] : null;
}
async function findActiveCase(supabase: any, userId: string, clientId: string, caseType: string) { const { data } = await supabase.from("client_cases").select("id").eq("user_id", userId).eq("primary_client_id", clientId).eq("case_type", caseType).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(); return data; }
async function persistPhone(supabase: any, userId: string, clientId: string, value: string) { const normalized = normalizePhone(value); if (!normalized) return; const { error } = await supabase.from("client_contact_methods").upsert({ user_id: userId, client_id: clientId, method_type: "phone", label: "primary", value, normalized_value: normalized.replace(/\D/g, ""), is_primary: true, confidence: 1, status: "confirmed", updated_at: new Date().toISOString() }, { onConflict: "client_id,method_type,normalized_value" }); if (error) throw error; }
function caseRoles(type: string) { return type === "buy_sell" ? ["buyer", "seller"] : type === "seller" ? ["seller"] : type === "buyer" ? ["buyer"] : ["prospect"]; }
function initialStage(type: string) { return type === "seller" ? "prospect_detected" : type === "buyer" ? "prospect_detected" : "new_contact"; }
function caseTitle(analysis: InboxAnalysis, client: any) { const name = `${client.first_name || ""} ${client.last_name || ""}`.trim(); const prefix = analysis.caseType === "seller" ? "Vente" : analysis.caseType === "buyer" ? "Achat" : analysis.caseType === "buy_sell" ? "Achat + vente" : "Suivi"; return `${prefix} — ${analysis.property.address || analysis.property.city || name || "personne à identifier"}`; }
function fold(value: string) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

