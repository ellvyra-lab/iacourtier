import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { recalculateCaseOperatingState } from "@/lib/server/crm-operating-system";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export async function changeCrmTask(db: Supabase, userId: string, input: { id?: string; clientId?: string | null; caseId?: string | null; propertyId?: string | null; title?: string; dueOn?: string | null; dueAt?: string; status?: "pending" | "completed"; source?: string }) {
  if (input.id) {
    const { data, error } = await db.from("tasks").select("case_id").eq("id", input.id).eq("user_id", userId).single();
    if (error || !data || (input.caseId && data.case_id !== input.caseId)) throw new Error("Cette tâche n’est pas accessible dans ce dossier.");
  } else if (!input.title?.trim()) throw new Error("Donne un titre à la tâche.");
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 240)) throw new Error("Donne un titre de moins de 240 caractères à la tâche.");
  if (input.dueOn && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || new Date(`${input.dueOn}T12:00:00Z`).toISOString().slice(0, 10) !== input.dueOn)) throw new Error("Date de tâche invalide.");
  if (input.caseId) {
    const { data, error } = await db.from("client_cases").select("primary_client_id,property_id").eq("id", input.caseId).eq("user_id", userId).single();
    if (error || !data) throw new Error("Ce dossier n’est pas accessible.");
    input.clientId = data.primary_client_id; input.propertyId = data.property_id;
  } else if (input.clientId) {
    const { data, error } = await db.from("clients").select("id").eq("id", input.clientId).eq("user_id", userId).single();
    if (error || !data) throw new Error("Ce client n’est pas accessible.");
  }
  if (input.dueAt && !Number.isFinite(Date.parse(input.dueAt))) throw new Error("Heure de tâche invalide.");
  const patch = { updated_at: new Date().toISOString(), ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.dueOn !== undefined ? { due_on: input.dueOn, due_at: input.dueAt || null } : {}), ...(input.status ? { status: input.status, completed_at: input.status === "completed" ? new Date().toISOString() : null } : {}) };
  const query = input.id ? db.from("tasks").update(patch).eq("id", input.id).eq("user_id", userId) : db.from("tasks").insert({ ...patch, user_id: userId, client_id: input.clientId || null, case_id: input.caseId || null, property_id: input.propertyId || null, title: input.title, category: "manual", status: "pending", validation_required: false, source: input.source || "manual" });
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error || new Error("La tâche n’a pas été enregistrée.");
  if (data.legacy_id && ["buyer_case_tasks", "seller_listing_tasks"].includes(data.legacy_source)) {
    const { error: syncError } = await db.from(data.legacy_source).update({ ...(input.status ? { status: input.status } : {}), ...(input.title ? { title: input.title } : {}), updated_at: patch.updated_at }).eq("id", data.legacy_id).eq("user_id", userId);
    if (syncError) throw syncError;
  }
  if (data.case_id) await recalculateCaseOperatingState(db, userId, data.case_id);
  if (!input.id && input.source?.startsWith("coach_ai:")) {
    const event = await db.from("activity_events").upsert({ user_id:userId,client_id:data.client_id,case_id:data.case_id,event_type:"task",title:`Tâche créée : ${data.title}`,details:data.due_at || data.due_on || "Sans échéance",legacy_source:"coach_task",legacy_id:data.id },{ onConflict:"user_id,legacy_source,legacy_id" });
    if (event.error) throw new Error("La tâche est créée, mais sa timeline n’a pas pu être enregistrée. Vérifie le dossier avant de recommencer.");
  }
  return data;
}

export async function changeBuyerCriteria(db: Supabase, userId: string, caseId: string, values: Record<string, unknown>) {
  const allowed = ["budget", "sectors", "addSectors", "removeSectors", "bedrooms", "importantNeeds", "propertyType", "prequalified"];
  if (!Object.keys(values).length || Object.keys(values).some(key => !allowed.includes(key))) throw new Error("Ce critère ne peut pas être modifié ici.");
  const { data: before, error } = await db.from("buyer_cases").select("*").eq("client_case_id", caseId).eq("user_id", userId).single();
  if (error || !before) throw new Error("Choisis un dossier acheteur pour modifier ses critères.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["budget", "bedrooms"] as const) if (values[key] !== undefined) {
    if (typeof values[key] !== "number" || !Number.isFinite(values[key]) || values[key] < 0 || values[key] > (key === "budget" ? 1e9 : 100)) throw new Error("Valeur numérique invalide.");
    patch[key] = String(values[key]);
  }
  let sectors: string[] = Array.isArray(before.sectors) ? before.sectors : [];
  for (const key of ["sectors", "addSectors", "removeSectors"] as const) if (values[key] !== undefined) {
    const items = values[key];
    if (!Array.isArray(items) || items.length > 40 || items.some(item => typeof item !== "string" || !item.trim() || item.length > 160)) throw new Error("Secteurs invalides.");
    sectors = key === "sectors" ? items : key === "addSectors" ? [...new Set([...sectors, ...items])] : sectors.filter(item => !items.includes(item));
    patch.sectors = sectors;
  }
  for (const [key, column] of [["importantNeeds", "important_needs"], ["propertyType", "property_type"]]) if (values[key] !== undefined) {
    if (typeof values[key] !== "string" || values[key].length > 3000) throw new Error("Critère invalide."); patch[column] = values[key];
  }
  if (values.prequalified !== undefined) {
    if (typeof values.prequalified !== "boolean") throw new Error("Préqualification invalide.");
    patch.preapproval_status = values.prequalified ? "confirmed" : "missing";
  }
  const { data: after, error: updateError } = await db.from("buyer_cases").update(patch).eq("id", before.id).eq("user_id", userId).select("*").single();
  if (updateError) throw updateError;
  if (values.prequalified !== undefined) {
    const { error: financeError } = await db.from("buyer_financing").upsert({ user_id: userId, case_id: before.id, status: patch.preapproval_status, updated_at: patch.updated_at }, { onConflict: "case_id" });
    if (financeError) throw financeError;
  }
  await recalculateCaseOperatingState(db, userId, caseId);
  return { before, after };
}
