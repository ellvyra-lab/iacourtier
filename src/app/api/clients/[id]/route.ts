import { NextResponse } from "next/server";

import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

type PatchBody = {
  action?: "profile" | "note" | "task";
  values?: Record<string, unknown>;
  caseId?: string | null;
  body?: string;
  title?: string;
};

const PROFILE_FIELDS = {
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  mailingAddress: "mailing_address",
  city: "city",
  postalCode: "postal_code",
  birthDate: "birth_date",
  language: "language",
  source: "source",
  notes: "notes",
  tags: "tags",
} as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: client, error: clientError } = await supabase.from("clients").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

    const { data: relations, error: relationsError } = await supabase.from("client_case_clients").select("case_id,role").eq("client_id", id).eq("user_id", user.id);
    if (relationsError) return NextResponse.json({ error: relationsError.message }, { status: 500 });
    const caseIds = Array.from(new Set((relations || []).map((item) => item.case_id)));
    const queryIds = caseIds.length ? caseIds : [EMPTY_UUID];

    const [casesResult, propertiesResult, documentsResult, tasksResult, automationsResult, communicationsResult, appointmentsResult, activityResult, contactMethodsResult, addressesResult, correctionsResult, crmEventsResult] = await Promise.all([
      supabase.from("client_cases").select("*,property:properties(id,address,city,postal_code,property_type,lot_number)").eq("user_id", user.id).in("id", queryIds).order("updated_at", { ascending: false }),
      supabase.from("client_properties").select("relationship,case_id,property:properties(id,address,city,postal_code,property_type,lot_number)").eq("user_id", user.id).eq("client_id", id),
      supabase.from("documents").select("*").eq("user_id", user.id).in("case_id", queryIds).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("user_id", user.id).in("case_id", queryIds).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("automations").select("*").eq("user_id", user.id).in("case_id", queryIds).order("updated_at", { ascending: false }),
      supabase.from("communications").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("occurred_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("starts_at", { ascending: true }),
      supabase.from("activity_events").select("*").eq("user_id", user.id).or(`client_id.eq.${id},case_id.in.(${queryIds.join(",")})`).order("created_at", { ascending: false }).limit(100),
      supabase.from("client_contact_methods").select("*").eq("user_id", user.id).eq("client_id", id).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }),
      supabase.from("client_addresses").select("*").eq("user_id", user.id).eq("client_id", id).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }),
      supabase.from("data_corrections").select("*").eq("user_id", user.id).eq("client_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.from("crm_events").select("*").eq("user_id", user.id).eq("client_id", id).order("occurred_at", { ascending: false }).limit(100),
    ]);

    const error = casesResult.error || propertiesResult.error || documentsResult.error || tasksResult.error || automationsResult.error || communicationsResult.error || appointmentsResult.error || activityResult.error || contactMethodsResult.error || addressesResult.error || correctionsResult.error || crmEventsResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ client, cases: casesResult.data || [], caseRoles: relations || [], properties: propertiesResult.data || [], documents: documentsResult.data || [], tasks: tasksResult.data || [], automations: automationsResult.data || [], communications: communicationsResult.data || [], appointments: appointmentsResult.data || [], activity: activityResult.data || [], contactMethods: contactMethodsResult.data || [], addresses: addressesResult.data || [], corrections: correctionsResult.data || [], crmEvents: crmEventsResult.data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger la fiche client." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as PatchBody;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return expiredSession();

    const { data: currentClient, error: clientError } = await supabase.from("clients").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
    if (!currentClient) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

    const ownedCaseId = body.caseId ? await resolveOwnedClientCase(supabase, user.id, id, body.caseId) : null;
    if (body.caseId && !ownedCaseId) return NextResponse.json({ error: "Ce dossier n’est pas relié à ce client." }, { status: 403 });

    if (body.action === "profile") {
      const values = body.values || {};
      const updates: Record<string, unknown> = {};
      for (const [inputKey, column] of Object.entries(PROFILE_FIELDS)) {
        if (inputKey in values) updates[column] = sanitizeProfileValue(inputKey, values[inputKey]);
      }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "Aucune information à enregistrer." }, { status: 400 });
      if (typeof updates.email === "string" && updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) return NextResponse.json({ error: "Le courriel n’est pas valide." }, { status: 400 });
      if (typeof updates.birth_date === "string" && updates.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.birth_date)) return NextResponse.json({ error: "La date de naissance n’est pas valide." }, { status: 400 });

      const now = new Date().toISOString();
      const { data: updatedClient, error: updateError } = await supabase.from("clients").update({ ...updates, updated_at: now }).eq("id", id).eq("user_id", user.id).select("*").single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      if ("email" in updates) await persistContactMethod(supabase, user.id, id, "email", updates.email, now);
      if ("phone" in updates) await persistContactMethod(supabase, user.id, id, "phone", updates.phone, now);
      if ("mailing_address" in updates || "city" in updates || "postal_code" in updates) await persistPersonalAddress(supabase, user.id, id, ownedCaseId, updatedClient, now);

      const corrections = Object.entries(updates).filter(([column, value]) => comparable(currentClient[column]) !== comparable(value)).map(([column, value]) => ({ user_id: user.id, case_id: ownedCaseId, client_id: id, entity_type: "client", entity_id: id, field_key: column, previous_value: comparable(currentClient[column]), corrected_value: comparable(value), reason: "Modification rapide par le courtier", corrected_by: user.id, source_priority: 100 }));
      if (corrections.length) {
        const { error } = await supabase.from("data_corrections").insert(corrections);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await recordActivity(supabase, user.id, id, ownedCaseId, "client_profile_updated", "Fiche client mise à jour", corrections.map((item) => profileFieldLabel(item.field_key)).join(", "));
      await recalculateLinkedCases(supabase, user.id, id);
      return NextResponse.json({ ok: true, client: updatedClient });
    }

    if (body.action === "note") {
      const note = cleanText(body.body, 5000);
      if (!note) return NextResponse.json({ error: "Écris une note avant de l’enregistrer." }, { status: 400 });
      const { error } = await supabase.from("communications").insert({ user_id: user.id, client_id: id, case_id: ownedCaseId, communication_type: "note", direction: "internal", subject: "Note client", body: note });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await recordActivity(supabase, user.id, id, ownedCaseId, "client_note_added", "Note ajoutée à la fiche client", note.slice(0, 180));
      return NextResponse.json({ ok: true });
    }

    if (body.action === "task") {
      if (!ownedCaseId) return NextResponse.json({ error: "Choisis un dossier relié pour ajouter cette tâche." }, { status: 400 });
      const title = cleanText(body.title, 240);
      if (!title) return NextResponse.json({ error: "Donne un titre à la tâche." }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await supabase.from("tasks").upsert({ user_id: user.id, client_id: id, case_id: ownedCaseId, category: "followup", title, status: "pending", validation_required: false, updated_at: now }, { onConflict: "case_id,title", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await recordActivity(supabase, user.id, id, ownedCaseId, "client_task_added", "Tâche ajoutée à la fiche client", title);
      await recalculateCaseOperatingState(supabase, user.id, ownedCaseId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: 500 });
  }
}

async function resolveOwnedClientCase(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clientId: string, caseId: string) {
  const { data: ownerCase } = await supabase.from("client_cases").select("id,primary_client_id").eq("id", caseId).eq("user_id", userId).maybeSingle();
  if (!ownerCase) return null;
  if (ownerCase.primary_client_id === clientId) return ownerCase.id;
  const { data: relation } = await supabase.from("client_case_clients").select("id").eq("case_id", caseId).eq("client_id", clientId).eq("user_id", userId).limit(1).maybeSingle();
  return relation ? ownerCase.id : null;
}

async function persistContactMethod(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clientId: string, type: "email" | "phone", rawValue: unknown, now: string) {
  const value = cleanText(rawValue, 320);
  const { error: resetError } = await supabase.from("client_contact_methods").update({ is_primary: false, updated_at: now }).eq("user_id", userId).eq("client_id", clientId).eq("method_type", type).eq("is_primary", true);
  if (resetError) throw resetError;
  if (!value) return;
  const normalized = type === "email" ? value.toLowerCase() : value.replace(/\D/g, "");
  if (!normalized) return;
  const { error } = await supabase.from("client_contact_methods").upsert({ user_id: userId, client_id: clientId, method_type: type, label: "primary", value, normalized_value: normalized, is_primary: true, confidence: 1, status: "confirmed", updated_at: now }, { onConflict: "client_id,method_type,normalized_value" });
  if (error) throw error;
}

async function persistPersonalAddress(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clientId: string, caseId: string | null, client: Record<string, any>, now: string) {
  const line = cleanText(client.mailing_address, 500);
  const { error: resetError } = await supabase.from("client_addresses").update({ is_primary: false, updated_at: now }).eq("user_id", userId).eq("client_id", clientId).eq("address_type", "personal").eq("is_primary", true);
  if (resetError) throw resetError;
  if (!line) return;
  const normalized = normalizeAddress([line, client.city, client.postal_code].filter(Boolean).join(" "));
  const { error } = await supabase.from("client_addresses").upsert({ user_id: userId, client_id: clientId, case_id: caseId, property_id: null, address_type: "personal", address_line: line, city: cleanText(client.city, 160), postal_code: cleanText(client.postal_code, 20), normalized_address: normalized, is_primary: true, source_label: "Modification rapide par le courtier", confidence: 1, status: "confirmed", updated_at: now }, { onConflict: "client_id,address_type,normalized_address" });
  if (error) throw error;
}

async function recordActivity(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clientId: string, caseId: string | null, eventType: string, title: string, details: string) {
  const { error } = await supabase.from("activity_events").insert({ user_id: userId, client_id: clientId, case_id: caseId, event_type: eventType, title, details: details || null });
  if (error) throw error;
}

async function recalculateLinkedCases(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clientId: string) {
  const [{ data: relations, error: relationError }, { data: primaryCases, error: primaryError }] = await Promise.all([
    supabase.from("client_case_clients").select("case_id").eq("client_id", clientId).eq("user_id", userId),
    supabase.from("client_cases").select("id").eq("primary_client_id", clientId).eq("user_id", userId),
  ]);
  if (relationError || primaryError) throw relationError || primaryError;
  const caseIds = [...new Set([...(relations || []).map((item) => item.case_id), ...(primaryCases || []).map((item) => item.id)])];
  for (const caseId of caseIds) await recalculateCaseOperatingState(supabase, userId, caseId);
}

function sanitizeProfileValue(key: string, value: unknown) {
  if (key === "tags") return Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item, 80)).filter(Boolean))].slice(0, 30) : [];
  const max = key === "notes" || key === "mailingAddress" ? 5000 : 320;
  const text = cleanText(value, max);
  if (key === "email") return text?.toLowerCase() || null;
  if (key === "firstName" || key === "lastName") return text || "";
  return text || null;
}

function cleanText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function normalizeAddress(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function comparable(value: unknown) { if (value == null) return ""; return Array.isArray(value) ? value.join(", ") : String(value); }
function profileFieldLabel(field: string) { return ({ first_name: "prénom", last_name: "nom", email: "courriel", phone: "téléphone", mailing_address: "adresse personnelle", city: "ville", postal_code: "code postal", birth_date: "date de naissance", language: "langue", source: "source", notes: "notes", tags: "tags" } as Record<string, string>)[field] || field; }
function expiredSession() { return NextResponse.json({ error: "Ta session a expiré.", reconnectUrl: "/connexion" }, { status: 401 }); }
